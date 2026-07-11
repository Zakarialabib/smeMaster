use async_imap::{Authenticator, Client, Session};
use rustls::pki_types::ServerName;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::bail;
use crate::error::{SerializedError, ERR_AUTH_FAILED, ERR_CONNECTION_TIMEOUT, ERR_INTERNAL, ERR_INVALID_INPUT, ERR_NETWORK};
use super::types::*;

pub(crate) const TCP_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
pub(crate) const TLS_HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(30);
pub(crate) const AUTH_TIMEOUT: Duration = Duration::from_secs(30);
pub(crate) const IMAP_CMD_TIMEOUT: Duration = Duration::from_secs(30);
pub(crate) const IMAP_FETCH_TIMEOUT: Duration = Duration::from_secs(120);
pub(crate) const IMAP_SEARCH_TIMEOUT: Duration = Duration::from_secs(60);
pub(crate) const OVERALL_CONNECT_TIMEOUT: Duration = Duration::from_secs(60);

pub(crate) fn quote_imap_string(s: &str) -> String {
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

fn configure_tcp_socket(stream: &TcpStream) {
    if let Err(e) = stream.set_nodelay(true) {
        log::warn!("Failed to set TCP_NODELAY: {e}");
    }
    let sock_ref = socket2::SockRef::from(stream);
    let keepalive = socket2::TcpKeepalive::new()
        .with_time(Duration::from_secs(60))
        .with_interval(Duration::from_secs(60));
    if let Err(e) = sock_ref.set_tcp_keepalive(&keepalive) {
        log::warn!("Failed to set TCP keepalive: {e}");
    }
}

struct XOAuth2 {
    response: Vec<u8>,
}

impl XOAuth2 {
    fn new(user: &str, access_token: &str) -> Self {
        let s = format!("user={}\x01auth=Bearer {}\x01\x01", user, access_token);
        Self { response: s.into_bytes() }
    }
}

impl Authenticator for XOAuth2 {
    type Response = Vec<u8>;
    fn process(&mut self, _challenge: &[u8]) -> Self::Response {
        std::mem::take(&mut self.response)
    }
}

pub(crate) enum ImapStream {
    #[cfg(feature = "rustls-tls")]
    Tls(tokio_rustls::TlsStream<TcpStream>),
    #[cfg(not(feature = "rustls-tls"))]
    Tls(tokio_native_tls::TlsStream<TcpStream>),
    Plain(TcpStream),
}

#[cfg(feature = "rustls-tls")]
use tokio_rustls::TlsConnector as RuntimeTlsConnector;
#[cfg(not(feature = "rustls-tls"))]
use tokio_native_tls::TlsConnector as RuntimeTlsConnector;

impl tokio::io::AsyncRead for ImapStream {
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            ImapStream::Tls(s) => std::pin::Pin::new(s).poll_read(cx, buf),
            ImapStream::Plain(s) => std::pin::Pin::new(s).poll_read(cx, buf),
        }
    }
}

impl tokio::io::AsyncWrite for ImapStream {
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        match self.get_mut() {
            ImapStream::Tls(s) => std::pin::Pin::new(s).poll_write(cx, buf),
            ImapStream::Plain(s) => std::pin::Pin::new(s).poll_write(cx, buf),
        }
    }

    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            ImapStream::Tls(s) => std::pin::Pin::new(s).poll_flush(cx),
            ImapStream::Plain(s) => std::pin::Pin::new(s).poll_flush(cx),
        }
    }

    fn poll_shutdown(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            ImapStream::Tls(s) => std::pin::Pin::new(s).poll_shutdown(cx),
            ImapStream::Plain(s) => std::pin::Pin::new(s).poll_shutdown(cx),
        }
    }
}

impl std::fmt::Debug for ImapStream {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ImapStream::Tls(_) => write!(f, "ImapStream::Tls"),
            ImapStream::Plain(_) => write!(f, "ImapStream::Plain"),
        }
    }
}

#[cfg(feature = "rustls-tls")]
#[derive(Debug)]
struct NoCertVerification;

#[cfg(feature = "rustls-tls")]
impl rustls::client::danger::ServerCertVerifier for NoCertVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
            rustls::SignatureScheme::ED25519,
        ]
    }
}

fn build_tls_connector(accept_invalid_certs: bool) -> Result<RuntimeTlsConnector, SerializedError> {
    #[cfg(feature = "rustls-tls")]
    {
        let mut root_store = rustls::RootCertStore::empty();
        root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let mut config = rustls::ClientConfig::builder()
            .with_root_certificates(root_store)
            .with_no_client_auth();
        if accept_invalid_certs {
            config.dangerous().set_certificate_verifier(Arc::new(
                crate::imap::connect::NoCertVerification,
            ));
        }
        Ok(Arc::new(config).into())
    }
    #[cfg(not(feature = "rustls-tls"))]
    {
        let mut builder = native_tls::TlsConnector::builder();
        if accept_invalid_certs {
            builder.danger_accept_invalid_certs(true);
            builder.danger_accept_invalid_hostnames(true);
        }
        builder.build().map_err(|e| SerializedError::new(ERR_INTERNAL, format!("Failed to create TLS connector: {e}")))
    }
}

pub(crate) type ImapSession = Session<ImapStream>;

pub async fn connect(config: &ImapConfig) -> Result<ImapSession, SerializedError> {
    tokio::time::timeout(OVERALL_CONNECT_TIMEOUT, connect_inner(config))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "IMAP connection to {}:{} timed out after {}s",
                config.host, config.port, OVERALL_CONNECT_TIMEOUT.as_secs()
            )
        ))?
}

async fn connect_inner(config: &ImapConfig) -> Result<ImapSession, SerializedError> {
    if config.security == "starttls" {
        return connect_starttls(config).await;
    }
    let stream = connect_stream(config).await?;
    let client = Client::new(stream);
    tokio::time::timeout(AUTH_TIMEOUT, authenticate(client, config))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "IMAP authentication timed out after {}s",
                AUTH_TIMEOUT.as_secs()
            )
        ))?
}

pub(crate) async fn connect_stream(config: &ImapConfig) -> Result<ImapStream, SerializedError> {
    let addr = (&*config.host, config.port);
    match config.security.as_str() {
        "tls" => {
            let tls_connector = build_tls_connector(config.accept_invalid_certs)?;
            let tcp = tokio::time::timeout(TCP_CONNECT_TIMEOUT, TcpStream::connect(addr))
                .await
                .map_err(|_| SerializedError::new(
                    ERR_CONNECTION_TIMEOUT,
                    format!(
                        "TCP connect to {}:{} timed out after {}s",
                        config.host, config.port, TCP_CONNECT_TIMEOUT.as_secs()
                    )
                ))?
                .map_err(|e| SerializedError::new(ERR_NETWORK, format!("TCP connect to {}:{} failed: {e}", config.host, config.port)))?;
            configure_tcp_socket(&tcp);
            let domain = ServerName::try_from(config.host.clone())
                .map_err(|_| SerializedError::new(ERR_INVALID_INPUT, format!("Invalid server name: {}", config.host)))?;
            let tls = tokio::time::timeout(TLS_HANDSHAKE_TIMEOUT, tls_connector.connect(domain, tcp))
                .await
                .map_err(|_| SerializedError::new(
                    ERR_CONNECTION_TIMEOUT,
                    format!(
                        "TLS handshake with {} timed out after {}s",
                        config.host, TLS_HANDSHAKE_TIMEOUT.as_secs()
                    )
                ))?
                .map_err(|e| SerializedError::new(ERR_NETWORK, format!("TLS handshake with {} failed: {e}", config.host)))?;
            Ok(ImapStream::Tls(tokio_rustls::TlsStream::Client(tls)))
        }
        "none" => {
            let tcp = tokio::time::timeout(TCP_CONNECT_TIMEOUT, TcpStream::connect(addr))
                .await
                .map_err(|_| SerializedError::new(
                    ERR_CONNECTION_TIMEOUT,
                    format!(
                        "TCP connect to {}:{} timed out after {}s",
                        config.host, config.port, TCP_CONNECT_TIMEOUT.as_secs()
                    )
                ))?
                .map_err(|e| SerializedError::new(ERR_NETWORK, format!("TCP connect to {}:{} failed: {e}", config.host, config.port)))?;
            configure_tcp_socket(&tcp);
            Ok(ImapStream::Plain(tcp))
        }
        other => {
            bail!(ERR_INVALID_INPUT, "Unknown security mode: {other}. Use \"tls\", \"starttls\", or \"none\".");
        }
    }
}

async fn connect_starttls(config: &ImapConfig) -> Result<ImapSession, SerializedError> {
    let addr = (&*config.host, config.port);
    let mut tcp = tokio::time::timeout(TCP_CONNECT_TIMEOUT, TcpStream::connect(addr))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "TCP connect to {}:{} timed out after {}s",
                config.host, config.port, TCP_CONNECT_TIMEOUT.as_secs()
            )
        ))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("TCP connect to {}:{} failed: {e}", config.host, config.port)))?;
    configure_tcp_socket(&tcp);

    let mut buf = vec![0u8; 4096];
    let n = tokio::time::timeout(IMAP_CMD_TIMEOUT, tcp.read(&mut buf))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "Reading server greeting timed out after {}s",
                IMAP_CMD_TIMEOUT.as_secs()
            )
        ))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("Failed to read server greeting: {e}")))?;
    let greeting = String::from_utf8_lossy(&buf[..n]);
    if !greeting.contains("OK") {
        return Err(SerializedError::new(ERR_INTERNAL, format!("Unexpected server greeting: {greeting}")));
    }

    tcp.write_all(b"a001 STARTTLS\r\n")
        .await
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("Failed to send STARTTLS: {e}")))?;

    let n = tokio::time::timeout(IMAP_CMD_TIMEOUT, tcp.read(&mut buf))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "STARTTLS response timed out after {}s",
                IMAP_CMD_TIMEOUT.as_secs()
            )
        ))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("Failed to read STARTTLS response: {e}")))?;
    let response = String::from_utf8_lossy(&buf[..n]);
    if !response.contains("OK") {
        return Err(SerializedError::new(ERR_INTERNAL, format!("STARTTLS rejected: {response}")));
    }

    let tls_connector = build_tls_connector(config.accept_invalid_certs)?;
    let domain = ServerName::try_from(config.host.clone())
        .map_err(|_| SerializedError::new(ERR_INVALID_INPUT, format!("Invalid server name: {}", config.host)))?;
    let tls = tokio::time::timeout(TLS_HANDSHAKE_TIMEOUT, tls_connector.connect(domain, tcp))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "TLS upgrade after STARTTLS timed out after {}s",
                TLS_HANDSHAKE_TIMEOUT.as_secs()
            )
        ))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("TLS upgrade after STARTTLS failed: {e}")))?;

    let client = Client::new(ImapStream::Tls(tokio_rustls::TlsStream::Client(tls)));
    tokio::time::timeout(AUTH_TIMEOUT, authenticate(client, config))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "IMAP authentication timed out after {}s",
                AUTH_TIMEOUT.as_secs()
            )
        ))?
}

pub(crate) async fn raw_connect_starttls(config: &ImapConfig) -> Result<ImapStream, SerializedError> {
    let addr = (&*config.host, config.port);
    let mut tcp = tokio::time::timeout(TCP_CONNECT_TIMEOUT, TcpStream::connect(addr))
        .await
        .map_err(|_| SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "TCP connect to {}:{} timed out after {}s",
                config.host, config.port, TCP_CONNECT_TIMEOUT.as_secs()
            )
        ))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("TCP: {e}")))?;
    configure_tcp_socket(&tcp);
    let mut tmp = vec![0u8; 4096];
    let _ = tokio::time::timeout(IMAP_CMD_TIMEOUT, tcp.read(&mut tmp)).await;
    tcp.write_all(b"a0 STARTTLS\r\n").await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("STARTTLS: {e}")))?;
    let n = tokio::time::timeout(IMAP_CMD_TIMEOUT, tcp.read(&mut tmp))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("STARTTLS response timed out after {}s", IMAP_CMD_TIMEOUT.as_secs())))? 
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("STARTTLS resp: {e}")))?;
    let resp = String::from_utf8_lossy(&tmp[..n]);
    if !resp.contains("OK") {
        return Err(SerializedError::new(ERR_INTERNAL, format!("STARTTLS rejected: {resp}")));
    }
    let nc = build_tls_connector(config.accept_invalid_certs)?;
    let domain = ServerName::try_from(config.host.clone())
        .map_err(|_| SerializedError::new(ERR_INVALID_INPUT, format!("Invalid server name: {}", config.host)))?;
    let tls = tokio::time::timeout(TLS_HANDSHAKE_TIMEOUT, nc.connect(domain, tcp))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("TLS handshake timed out after {}s", TLS_HANDSHAKE_TIMEOUT.as_secs())))? 
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("TLS: {e}")))?;
    Ok(ImapStream::Tls(tokio_rustls::TlsStream::Client(tls)))
}

async fn authenticate(
    client: Client<ImapStream>,
    config: &ImapConfig,
) -> Result<ImapSession, SerializedError> {
    match config.auth_method.as_str() {
        "oauth2" => {
            let auth = XOAuth2::new(&config.username, &config.password);
            client
                .authenticate("XOAUTH2", auth)
                .await
                .map_err(|(e, _)| SerializedError::new(ERR_AUTH_FAILED, format!("XOAUTH2 authentication failed: {e}")))
        }
        _ => client
            .login(&config.username, &config.password)
            .await
            .map_err(|(e, _)| SerializedError::new(ERR_AUTH_FAILED, format!("Login failed: {e}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quote_imap_string_normal() {
        assert_eq!(quote_imap_string("hello"), "\"hello\"");
    }

    #[test]
    fn test_quote_imap_string_with_quotes() {
        assert_eq!(quote_imap_string("he\"llo"), "\"he\\\"llo\"");
    }

    #[test]
    fn test_quote_imap_string_with_backslash() {
        assert_eq!(quote_imap_string("he\\llo"), "\"he\\\\llo\"");
    }

    #[test]
    fn test_quote_imap_string_empty() {
        assert_eq!(quote_imap_string(""), "\"\"");
    }

    #[test]
    fn test_quote_imap_string_mixed() {
        assert_eq!(quote_imap_string("a\"b\\c"), "\"a\\\"b\\\\c\"");
    }

    #[test]
    fn test_xoauth2_new_binary_format() {
        let auth = XOAuth2::new("user@example.com", "token123");
        let expected = b"user=user@example.com\x01auth=Bearer token123\x01\x01";
        assert_eq!(auth.response, expected);
    }

    #[test]
    fn test_xoauth2_process_returns_and_clears() {
        let mut auth = XOAuth2::new("u@e.com", "tok");
        let first = auth.process(b"");
        assert_eq!(first, b"user=u@e.com\x01auth=Bearer tok\x01\x01");
        let second = auth.process(b"");
        assert!(second.is_empty());
    }

    #[test]
    fn test_xoauth2_process_multiple_calls_all_empty_after_first() {
        let mut auth = XOAuth2::new("u@e.com", "tok");
        let _first = auth.process(b"");
        let second = auth.process(b"");
        let third = auth.process(b"");
        assert!(second.is_empty());
        assert!(third.is_empty());
    }

    #[test]
    fn test_timeout_constants_are_reasonable() {
        assert_eq!(TCP_CONNECT_TIMEOUT, Duration::from_secs(30));
        assert_eq!(TLS_HANDSHAKE_TIMEOUT, Duration::from_secs(30));
        assert_eq!(AUTH_TIMEOUT, Duration::from_secs(30));
        assert_eq!(IMAP_CMD_TIMEOUT, Duration::from_secs(30));
        assert_eq!(IMAP_FETCH_TIMEOUT, Duration::from_secs(120));
        assert_eq!(IMAP_SEARCH_TIMEOUT, Duration::from_secs(60));
        assert_eq!(OVERALL_CONNECT_TIMEOUT, Duration::from_secs(60));
    }
}