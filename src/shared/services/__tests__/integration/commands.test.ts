// src/shared/services/__tests__/integration/commands.test.ts
// Full integration tests for the Tauri IPC command layer.
// Uses mockInvoke (from the global setup) to simulate Rust-side responses
// for every major command group.
//
// Pattern: set mockInvoke.mockResolvedValueOnce(...) before calling our typed
// invoke(), then assert both the returned shape and the underlying call args.

import { describe, it, expect, beforeEach } from "vitest";
import { mockInvoke } from "@/test/mocks/tauri.mock";
import { invoke } from "@shared/services/commands";
import type {
  PlatformInfo,
  BiometricStatus,
  OAuthResult,
  TokenExchangeResult,
  ImapConfig,
  SmtpConfig,
  ImapFolder,
  ImapFolderStatus,
  ImapFetchResult,
  ImapMessage,
  ImapFolderSyncResult,
  ImapFolderSearchResult,
  DeltaCheckRequest,
  DeltaCheckResult,
  DnsCheckResult,
  DomainHealth,
  PgpKeyInfo,
  VaultEntry,
  BatchResult,
  PairingToken,
  PairedDevice,
  PairingEntry,
  SyncedChange,
  BackupConfig,
  SyncHealthSummary,
  SentinelAlert,
} from "@shared/services/commands";

// Shared minimal config objects reused across IMAP/SMTP tests
const imapConfig: ImapConfig = {
  host: "imap.example.com",
  port: 993,
  security: "tls",
  username: "user@example.com",
  password: "s3cret",
  auth_method: "password",
};

const smtpConfig: SmtpConfig = {
  host: "smtp.example.com",
  port: 587,
  security: "starttls",
  username: "user@example.com",
  password: "s3cret",
  auth_method: "password",
};

// ============================================================================
// 1. Platform
// ============================================================================

describe("Platform IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("get_platform returns a valid PlatformInfo", async () => {
    const fixture: PlatformInfo = {
      mobile: false,
      desktop: true,
      os: "windows",
      arch: "x86_64",
      is_tablet: false,
      is_phone: false,
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("get_platform");

    expect(result).toEqual(fixture);
    expect(result.desktop).toBe(true);
    expect(result.mobile).toBe(false);
    expect(result.os).toBe("windows");
    expect(result.arch).toBe("x86_64");
    expect(result.is_tablet).toBe(false);
    expect(result.is_phone).toBe(false);
    expect(mockInvoke).toHaveBeenCalledWith("get_platform", {});
  });

  it("get_platform errors gracefully when invoke fails", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("backend not ready"));

    await expect(invoke("get_platform")).rejects.toThrow("backend not ready");
  });

  it("get_platform handles missing fields gracefully", async () => {
    // Simulate older Rust backend that might omit newer fields
    mockInvoke.mockResolvedValueOnce({
      mobile: false,
      desktop: true,
      os: "linux",
      arch: "x86_64",
      // is_tablet and is_phone are missing
    } as PlatformInfo);

    const result = await invoke("get_platform");
    expect(result.desktop).toBe(true);
    expect((result as any).is_tablet).toBeUndefined();
  });
});

// ============================================================================
// 2. Biometric
// ============================================================================

describe("Biometric IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("check_biometric returns availability status", async () => {
    const fixture: BiometricStatus = {
      is_available: true,
      biometry_type: 1,
      error: null,
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("check_biometric");
    expect(result.is_available).toBe(true);
    expect(result.biometry_type).toBe(1);
    expect(result.error).toBeNull();
  });

  it("authenticate_biometric accepts a reason string", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await invoke("authenticate_biometric", { reason: "Unlock vault" });
    expect(mockInvoke).toHaveBeenCalledWith("authenticate_biometric", { reason: "Unlock vault" });
  });
});

// ============================================================================
// 3. OAuth
// ============================================================================

describe("OAuth IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("start_oauth_server returns OAuthResult with code and state", async () => {
    const fixture: OAuthResult = { code: "auth_code_xyz", state: "state_abc" };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("start_oauth_server", { port: 8080, state: "state_abc" });
    expect(result.code).toBe("auth_code_xyz");
    expect(result.state).toBe("state_abc");
  });

  it("oauth_exchange_token returns TokenExchangeResult", async () => {
    const fixture: TokenExchangeResult = {
      access_token: "ya29.xxx",
      refresh_token: "1//yyy",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "https://mail.google.com/",
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("oauth_exchange_token", {
      token_url: "https://oauth2.googleapis.com/token",
      code: "auth_code",
      client_id: "my-client-id",
      redirect_uri: "http://localhost:8080/callback",
    });
    expect(result.access_token).toBe("ya29.xxx");
    expect(result.refresh_token).toBe("1//yyy");
    expect(result.expires_in).toBe(3600);
    expect(result.token_type).toBe("Bearer");
  });

  it("oauth_refresh_token returns refreshed tokens", async () => {
    const fixture: TokenExchangeResult = {
      access_token: "ya29.refreshed",
      expires_in: 3600,
      token_type: "Bearer",
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("oauth_refresh_token", {
      token_url: "https://oauth2.googleapis.com/token",
      refresh_token: "1//old",
      client_id: "my-client-id",
    });
    expect(result.access_token).toBe("ya29.refreshed");
  });

  it("oauth_exchange_token errors with invalid grant", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("invalid_grant: code expired"));

    await expect(
      invoke("oauth_exchange_token", {
        token_url: "https://oauth2.googleapis.com/token",
        code: "expired_code",
        client_id: "my-client-id",
        redirect_uri: "http://localhost:8080/callback",
      }),
    ).rejects.toThrow("invalid_grant");
  });
});

// ============================================================================
// 4. Tray & Window
// ============================================================================

describe("Tray & Window IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("close_splashscreen resolves successfully", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await expect(invoke("close_splashscreen")).resolves.toBeUndefined();
  });

  it("set_tray_tooltip updates the tray tooltip text", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("set_tray_tooltip", { tooltip: "SME Master - 3 unread" });
    expect(mockInvoke).toHaveBeenCalledWith("set_tray_tooltip", { tooltip: "SME Master - 3 unread" });
  });

  it("open_devtools resolves successfully", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await expect(invoke("open_devtools")).resolves.toBeUndefined();
  });
});

// ============================================================================
// 5. IMAP — Core Commands
// ============================================================================

describe("IMAP IPC — Core", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("imap_test_connection returns a success message", async () => {
    mockInvoke.mockResolvedValueOnce("Connection successful — IMAP server ready");
    const result = await invoke("imap_test_connection", { config: imapConfig });
    expect(result).toContain("Connection successful");
  });

  it("imap_list_folders returns ImapFolder[]", async () => {
    const folders: ImapFolder[] = [
      { path: "INBOX", raw_path: "INBOX", name: "INBOX", delimiter: "/", special_use: "\\Inbox", exists: 150, unseen: 3 },
      { path: "Sent", raw_path: "Sent", name: "Sent", delimiter: "/", special_use: "\\Sent", exists: 42, unseen: 0 },
    ];
    mockInvoke.mockResolvedValueOnce(folders);

    const result = await invoke("imap_list_folders", { config: imapConfig });
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("INBOX");
    expect(result[0].exists).toBe(150);
    expect(result[0].unseen).toBe(3);
    expect(result[1].special_use).toBe("\\Sent");
  });

  it("imap_get_folder_status returns ImapFolderStatus", async () => {
    const status: ImapFolderStatus = { uidvalidity: 1, uidnext: 200, exists: 150, unseen: 3, highest_modseq: 54321 };
    mockInvoke.mockResolvedValueOnce(status);

    const result = await invoke("imap_get_folder_status", { config: imapConfig, folder: "INBOX" });
    expect(result.uidvalidity).toBe(1);
    expect(result.uidnext).toBe(200);
    expect(result.exists).toBe(150);
    expect(result.unseen).toBe(3);
    expect(result.highest_modseq).toBe(54321);
  });

  it("imap_fetch_messages returns ImapFetchResult with messages", async () => {
    const msg: ImapMessage = {
      uid: 42,
      folder: "INBOX",
      message_id: "<abc@example.com>",
      from_address: "alice@example.com",
      from_name: "Alice",
      to_addresses: "bob@example.com",
      subject: "Hello",
      date: 1700000000,
      is_read: false,
      is_starred: false,
      is_draft: false,
      body_text: "Hello Bob!",
      snippet: "Hello Bob!",
      raw_size: 512,
      attachments: [],
    };
    const fixture: ImapFetchResult = {
      messages: [msg],
      folder_status: { uidvalidity: 1, uidnext: 200, exists: 150, unseen: 3 },
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("imap_fetch_messages", {
      config: imapConfig,
      folder: "INBOX",
      uids: [42],
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].uid).toBe(42);
    expect(result.messages[0].subject).toBe("Hello");
    expect(result.folder_status.exists).toBe(150);
  });

  it("imap_set_flags accepts flags to add", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("imap_set_flags", {
      config: imapConfig,
      folder: "INBOX",
      uids: [42, 43],
      flags: ["\\Seen"],
      add: true,
    });
    expect(mockInvoke).toHaveBeenCalledWith("imap_set_flags", {
      config: imapConfig,
      folder: "INBOX",
      uids: [42, 43],
      flags: ["\\Seen"],
      add: true,
    });
  });

  it("imap_move_messages moves messages between folders", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("imap_move_messages", {
      config: imapConfig,
      folder: "INBOX",
      uids: [10, 11],
      destination: "Archive",
    });
    expect(mockInvoke).toHaveBeenCalledWith("imap_move_messages", {
      config: imapConfig,
      folder: "INBOX",
      uids: [10, 11],
      destination: "Archive",
    });
  });

  it("imap_delete_messages marks messages for deletion", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("imap_delete_messages", {
      config: imapConfig,
      folder: "INBOX",
      uids: [99],
    });
    expect(mockInvoke).toHaveBeenCalledWith("imap_delete_messages", {
      config: imapConfig,
      folder: "INBOX",
      uids: [99],
    });
  });

  it("imap_delta_check returns DeltaCheckResult[]", async () => {
    const folders: DeltaCheckRequest[] = [
      { folder: "INBOX", last_uid: 100, uidvalidity: 1 },
    ];
    const expected: DeltaCheckResult[] = [
      { folder: "INBOX", uidvalidity: 1, new_uids: [101, 102, 103], uidvalidity_changed: false },
    ];
    mockInvoke.mockResolvedValueOnce(expected);

    const result = await invoke("imap_delta_check", { config: imapConfig, folders });
    expect(result).toHaveLength(1);
    expect(result[0].new_uids).toEqual([101, 102, 103]);
    expect(result[0].uidvalidity_changed).toBe(false);
  });

  it("imap_sync_folder returns ImapFolderSyncResult", async () => {
    const fixture: ImapFolderSyncResult = {
      uids: [1, 2, 3],
      messages: [
        {
          uid: 1, folder: "INBOX", date: 1700000000,
          is_read: false, is_starred: false, is_draft: false,
          raw_size: 100, attachments: [],
        } as ImapMessage,
      ],
      folder_status: { uidvalidity: 1, uidnext: 50, exists: 3, unseen: 3 },
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("imap_sync_folder", {
      config: imapConfig,
      folder: "INBOX",
      batch_size: 100,
    });
    expect(result.uids).toEqual([1, 2, 3]);
    expect(result.messages).toHaveLength(1);
    expect(result.folder_status.unseen).toBe(3);
  });

  it("imap_search returns ImapFolderSearchResult", async () => {
    const fixture: ImapFolderSearchResult = {
      uids: [10, 20, 30],
      folder_status: { uidvalidity: 1, uidnext: 100, exists: 3, unseen: 1 },
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("imap_search", {
      config: imapConfig,
      folder: "INBOX",
      all: true,
    });
    expect(result.uids).toHaveLength(3);
    expect(result.folder_status.uidnext).toBe(100);
  });

  it("imap_fetch_attachment returns base64 content", async () => {
    mockInvoke.mockResolvedValueOnce("base64encodedcontent==");
    const result = await invoke("imap_fetch_attachment", {
      config: imapConfig,
      folder: "INBOX",
      uid: 42,
      part_id: "1.2",
    });
    expect(result).toBe("base64encodedcontent==");
  });

  it("imap_append_message appends to folder", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("imap_append_message", {
      config: imapConfig,
      folder: "Drafts",
      raw_message: "From: ...\r\nSubject: Draft\r\n\r\nBody",
    });
    expect(mockInvoke).toHaveBeenCalledWith("imap_append_message", {
      config: imapConfig,
      folder: "Drafts",
      raw_message: "From: ...\r\nSubject: Draft\r\n\r\nBody",
    });
  });

  it("imap_fetch_raw_message returns raw RFC2822", async () => {
    const raw = "From: alice@example.com\r\nSubject: Test\r\n\r\nHello";
    mockInvoke.mockResolvedValueOnce(raw);
    const result = await invoke("imap_fetch_raw_message", {
      config: imapConfig,
      folder: "INBOX",
      uid: 1,
    });
    expect(result).toContain("From:");
    expect(result).toContain("Hello");
  });

  it("imap_fetch_message_body returns full ImapMessage with body", async () => {
    const msg: ImapMessage = {
      uid: 1, folder: "INBOX", date: 1700000000,
      is_read: true, is_starred: false, is_draft: false,
      body_html: "<p>Hello</p>", body_text: "Hello",
      snippet: "Hello", raw_size: 200, attachments: [],
    };
    mockInvoke.mockResolvedValueOnce(msg);
    const result = await invoke("imap_fetch_message_body", {
      config: imapConfig,
      folder: "INBOX",
      uid: 1,
    });
    expect(result.body_html).toBe("<p>Hello</p>");
    expect(result.body_text).toBe("Hello");
  });

  it("imap_test_connection errors on timeout", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Connection timed out after 10s"));

    await expect(
      invoke("imap_test_connection", { config: imapConfig }),
    ).rejects.toThrow("timed out");
  });

  it("imap_fetch_messages errors when folder does not exist", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Folder 'NonExistent' does not exist"));

    await expect(
      invoke("imap_fetch_messages", {
        config: imapConfig,
        folder: "NonExistent",
        uids: [1],
      }),
    ).rejects.toThrow("does not exist");
  });
});

// ============================================================================
// 6. IMAP — Batch Commands
// ============================================================================

describe("IMAP IPC — Batch", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("batch_imap_set_flags returns BatchResult", async () => {
    const fixture: BatchResult = {
      total: 3,
      succeeded: 2,
      failed: 1,
      items: [
        { itemId: "1", success: true },
        { itemId: "2", success: true },
        { itemId: "3", success: false, error: "Message not found" },
      ],
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("batch_imap_set_flags", {
      config: imapConfig,
      folder: "INBOX",
      message_uids: [1, 2, 3],
      flags: ["\\Seen"],
      is_add: true,
    });
    expect(result.total).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.items[2].error).toBe("Message not found");
  });

  it("batch_imap_move returns BatchResult for bulk move", async () => {
    const fixture: BatchResult = {
      total: 2, succeeded: 2, failed: 0,
      items: [
        { itemId: "5", success: true },
        { itemId: "6", success: true },
      ],
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("batch_imap_move", {
      config: imapConfig,
      source_folder: "INBOX",
      dest_folder: "Archive",
      message_uids: [5, 6],
    });
    expect(result.succeeded).toBe(2);
  });

  it("batch_imap_delete returns BatchResult", async () => {
    mockInvoke.mockResolvedValueOnce({ total: 1, succeeded: 1, failed: 0, items: [{ itemId: "1", success: true }] });
    const result = await invoke("batch_imap_delete", {
      config: imapConfig,
      folder: "INBOX",
      message_uids: [1],
    });
    expect(result.succeeded).toBe(1);
  });
});

// ============================================================================
// 7. SMTP
// ============================================================================

describe("SMTP IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("smtp_send_email returns success result", async () => {
    mockInvoke.mockResolvedValueOnce({ success: true, message: "Message sent to recipient@example.com" });

    const result = await invoke("smtp_send_email", {
      config: smtpConfig,
      raw_email: "From: ...\r\nTo: recipient@example.com\r\nSubject: Test\r\n\r\nBody",
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain("sent");
  });

  it("smtp_test_connection verifies SMTP connectivity", async () => {
    mockInvoke.mockResolvedValueOnce({ success: true, message: "SMTP connection successful" });

    const result = await invoke("smtp_test_connection", { config: smtpConfig });
    expect(result.success).toBe(true);
  });

  it("smtp_send_email errors on authentication failure", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Authentication failed: invalid credentials"));

    await expect(
      invoke("smtp_send_email", {
        config: { ...smtpConfig, password: "wrong" },
        raw_email: "From: ...\r\nSubject: Test\r\n\r\nBody",
      }),
    ).rejects.toThrow("Authentication failed");
  });
});

// ============================================================================
// 8. DNS / Deliverability
// ============================================================================

describe("Deliverability IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("check_dns_records returns DnsCheckResult", async () => {
    const fixture: DnsCheckResult = {
      spf: "v=spf1 include:_spf.google.com ~all",
      dkim: "v=DKIM1; h=sha256; p=MIGf...",
      dmarc: "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com",
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("check_dns_records", { domain: "example.com" });
    expect(result.spf).toContain("v=spf1");
    expect(result.dkim).toContain("v=DKIM1");
    expect(result.dmarc).toContain("v=DMARC1");
  });

  it("check_domain_health returns DomainHealth with all status fields", async () => {
    const fixture: DomainHealth = {
      domain: "example.com",
      score: 85,
      spf_status: { present: true, valid: true, issues: [], raw_value: "v=spf1 ~all" },
      dkim_status: { present: true, valid: true, issues: [], raw_value: "v=DKIM1; p=..." },
      dmarc_status: { present: true, valid: false, issues: ["p=none is too permissive"], raw_value: "v=DMARC1; p=none" },
      ptr_status: { present: true, valid: true, issues: [] },
      mx_status: { present: true, valid: true, issues: [] },
      blacklist_status: [
        { provider: "Spamhaus", listed: false },
        { provider: "Barracuda", listed: false },
      ],
      checked_at: "2026-05-20T12:00:00Z",
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("check_domain_health", { domain: "example.com" });
    expect(result.domain).toBe("example.com");
    expect(result.score).toBe(85);
    expect(result.spf_status.valid).toBe(true);
    expect(result.dmarc_status.valid).toBe(false);
    expect(result.dmarc_status.issues).toContain("p=none is too permissive");
    expect(result.blacklist_status).toHaveLength(2);
    expect(result.blacklist_status[0].provider).toBe("Spamhaus");
    expect(result.checked_at).toBe("2026-05-20T12:00:00Z");
  });

  it("get_remediation returns remediation nodes", async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        failure_type: "MissingDmarc",
        explanation: { en: "No DMARC record found", fr: "", ar: "" },
        impact: [{ provider: "Gmail", severity: "Warning", description: "Emails may be flagged" }],
        fix_paths: [{
          method: "SelfService",
          instructions: [{ step_number: 1, action: "Create DMARC record", expected_result: "DMARC published" }],
          estimated_time: "10 min",
        }],
      },
    ]);

    const result = await invoke("get_remediation", {
      domain: "example.com",
      failure_types: ["MissingDmarc"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].failure_type).toBe("MissingDmarc");
    expect(result[0].fix_paths[0].method).toBe("SelfService");
  });

  it("check_dns_records returns partial result when records missing", async () => {
    mockInvoke.mockResolvedValueOnce({ spf: null, dkim: null, dmarc: null });

    const result = await invoke("check_dns_records", { domain: "no-dns.example.com" });
    expect(result.spf).toBeNull();
    expect(result.dkim).toBeNull();
    expect(result.dmarc).toBeNull();
  });

  it("check_domain_health errors on invalid domain", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("DNS resolution failed for invalid-domain-xyz"));

    await expect(
      invoke("check_domain_health", { domain: "invalid-domain-xyz" }),
    ).rejects.toThrow("DNS resolution failed");
  });
});

// ============================================================================
// 9. Sentinel
// ============================================================================

describe("Sentinel IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("run_sentinel_check returns SentinelAlert[]", async () => {
    const alerts: SentinelAlert[] = [
      {
        id: "alert-1",
        alert_type: "ScoreDropped",
        domain: "example.com",
        severity: "Warning",
        message: "Score dropped from 90 to 75",
        created_at: 1700000000,
        acknowledged: false,
      },
    ];
    mockInvoke.mockResolvedValueOnce(alerts);

    const result = await invoke("run_sentinel_check", { domain: "example.com", previous_score: 90 });
    expect(result).toHaveLength(1);
    expect(result[0].alert_type).toBe("ScoreDropped");
    expect(result[0].severity).toBe("Warning");
  });

  it("get_sentinel_alerts returns all alerts", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const result = await invoke("get_sentinel_alerts");
    expect(result).toEqual([]);
  });
});

// ============================================================================
// 10. PGP
// ============================================================================

describe("PGP IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("generate_key returns a key pair tuple", async () => {
    const pub = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nabc\n-----END PGP PUBLIC KEY BLOCK-----";
    const priv = "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nxyz\n-----END PGP PRIVATE KEY BLOCK-----";
    mockInvoke.mockResolvedValueOnce([pub, priv]);

    const [publicKey, privateKey] = await invoke("generate_key", {
      user_id: "test@example.com",
      passphrase: "s3cr3t",
    });
    expect(publicKey).toContain("BEGIN PGP PUBLIC");
    expect(privateKey).toContain("BEGIN PGP PRIVATE");
  });

  it("get_key_info_cmd returns PgpKeyInfo", async () => {
    const fixture: PgpKeyInfo = {
      id: "ABC12345",
      fingerprint: "ABCD:EF01:2345:6789:ABCD:EF01:2345:6789",
      user_id: "test@example.com",
      algorithm: "Ed25519",
      created_at: 1700000000,
      is_revoked: false,
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("get_key_info_cmd", { armored_key: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nkey\n-----END PGP PUBLIC KEY BLOCK-----" });
    expect(result.id).toBe("ABC12345");
    expect(result.fingerprint).toContain(":");
    expect(result.algorithm).toBe("Ed25519");
    expect(result.is_revoked).toBe(false);
  });

  it("encrypt returns armored ciphertext", async () => {
    mockInvoke.mockResolvedValueOnce("-----BEGIN PGP MESSAGE-----\n\ncipher\n-----END PGP MESSAGE-----");

    const result = await invoke("encrypt", {
      plaintext: "Hello",
      public_key_armored: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nkey\n-----END PGP PUBLIC KEY BLOCK-----",
    });
    expect(result).toContain("BEGIN PGP MESSAGE");
  });

  it("decrypt_message returns plaintext", async () => {
    mockInvoke.mockResolvedValueOnce("Decrypted secret message");

    const result = await invoke("decrypt_message", {
      ciphertext_b64: "base64cipher",
      private_key_armored: "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nkey\n-----END PGP PRIVATE KEY BLOCK-----",
      passphrase: "test",
    });
    expect(result).toBe("Decrypted secret message");
  });

  it("pgp_cache_passphrase stores passphrase for account", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("pgp_cache_passphrase", { account_id: "acct-1", passphrase: "my-pass" });
    expect(mockInvoke).toHaveBeenCalledWith("pgp_cache_passphrase", { account_id: "acct-1", passphrase: "my-pass" });
  });

  it("pgp_get_cached_passphrase retrieves stored passphrase", async () => {
    mockInvoke.mockResolvedValueOnce("my-pass");
    const result = await invoke("pgp_get_cached_passphrase", { account_id: "acct-1" });
    expect(result).toBe("my-pass");
  });

  it("pgp_clear_passphrase_cache removes cached passphrase", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("pgp_clear_passphrase_cache", { account_id: "acct-1" });
    expect(mockInvoke).toHaveBeenCalledWith("pgp_clear_passphrase_cache", { account_id: "acct-1" });
  });

  it("decrypt_message errors on wrong passphrase", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("decryption failed: bad passphrase"));

    await expect(
      invoke("decrypt_message", {
        ciphertext_b64: "base64cipher",
        private_key_armored: "key",
        passphrase: "wrong",
      }),
    ).rejects.toThrow("bad passphrase");
  });
});

// ============================================================================
// 11. Vault
// ============================================================================

describe("Vault IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("get_vault_root returns a path string", async () => {
    mockInvoke.mockResolvedValueOnce("/home/user/.local/share/sme/vault");

    const result = await invoke("get_vault_root");
    expect(result).toBe("/home/user/.local/share/sme/vault");
    expect(typeof result).toBe("string");
  });

  it("list_vault_dir returns VaultEntry[]", async () => {
    const entries: VaultEntry[] = [
      { path: "/vault/docs", is_dir: true },
      { path: "/vault/docs/report.pdf", is_dir: false },
      { path: "/vault/docs/invoice.pdf", is_dir: false },
    ];
    mockInvoke.mockResolvedValueOnce(entries);

    const result = await invoke("list_vault_dir", { dir_path: "/vault/docs" });
    expect(result).toHaveLength(3);
    expect(result.filter((e) => e.is_dir)).toHaveLength(1);
    expect(result.find((e) => e.path.endsWith("report.pdf"))?.is_dir).toBe(false);
  });

  it("delete_from_vault removes a vault item", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("delete_from_vault", { vault_path: "/vault/docs/old.pdf" });
    expect(mockInvoke).toHaveBeenCalledWith("delete_from_vault", { vault_path: "/vault/docs/old.pdf" });
  });

  it("copy_to_vault copies a file into the vault", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("copy_to_vault", { source_path: "/tmp/report.pdf", vault_path: "/vault/report.pdf" });
    expect(mockInvoke).toHaveBeenCalledWith("copy_to_vault", { source_path: "/tmp/report.pdf", vault_path: "/vault/report.pdf" });
  });

  it("read_vault_file returns file contents", async () => {
    mockInvoke.mockResolvedValueOnce("encrypted-content-base64");
    const result = await invoke("read_vault_file", { path: "/vault/notes.txt" });
    expect(result).toBe("encrypted-content-base64");
  });

  it("set_vault_pin sets a PIN for vault access", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("set_vault_pin", { pin: "1234" });
    expect(mockInvoke).toHaveBeenCalledWith("set_vault_pin", { pin: "1234" });
  });

  it("verify_vault_pin returns true for correct PIN", async () => {
    mockInvoke.mockResolvedValueOnce(true);
    const result = await invoke("verify_vault_pin", { pin: "1234" });
    expect(result).toBe(true);
  });

  it("verify_vault_pin returns false for incorrect PIN", async () => {
    mockInvoke.mockResolvedValueOnce(false);
    const result = await invoke("verify_vault_pin", { pin: "0000" });
    expect(result).toBe(false);
  });

  it("search_vault returns matching file paths", async () => {
    mockInvoke.mockResolvedValueOnce(["/vault/docs/report.pdf", "/vault/docs/report-summary.pdf"]);
    const result = await invoke("search_vault", { dir_path: "/vault/docs", pattern: "report" });
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("report");
  });

  it("get_vault_size returns size in bytes", async () => {
    mockInvoke.mockResolvedValueOnce(1048576);
    const result = await invoke("get_vault_size");
    expect(result).toBe(1048576);
  });

  it("delete_from_vault errors when path does not exist", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Path '/vault/missing' not found in vault"));

    await expect(
      invoke("delete_from_vault", { vault_path: "/vault/missing" }),
    ).rejects.toThrow("not found in vault");
  });
});

// ============================================================================
// 12. Device Pairing
// ============================================================================

describe("Device Pairing IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("generate_qr_token returns a PairingToken", async () => {
    const fixture: PairingToken = {
      token: "pair-abc-123",
      device_name: "My Phone",
      created_at: 1700000000,
      expires_at: 1700086400,
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("generate_qr_token", { device_name: "My Phone" });
    expect(result.token).toBe("pair-abc-123");
    expect(result.device_name).toBe("My Phone");
    expect(result.expires_at).toBeGreaterThan(result.created_at);
  });

  it("verify_device_token returns PairedDevice", async () => {
    const fixture: PairedDevice = {
      id: "dev-001",
      device_name: "My Phone",
      device_type: "mobile",
      token_hash: "abc123hash",
      paired_at: 1700000000,
      last_seen_at: 1700000000,
      is_active: true,
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("verify_device_token", { token: "pair-abc-123", device_type: "mobile" });
    expect(result.id).toBe("dev-001");
    expect(result.is_active).toBe(true);
    expect(result.device_type).toBe("mobile");
  });

  it("verify_device_token errors for invalid token", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Invalid or expired pairing token"));

    await expect(
      invoke("verify_device_token", { token: "bad-token", device_type: "desktop" }),
    ).rejects.toThrow("Invalid or expired");
  });
});

// ============================================================================
// 13. Device Management
// ============================================================================

describe("Device Management IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("get_pairings returns PairingEntry[] with correct fields", async () => {
    const pairings: PairingEntry[] = [
      {
        device_id: "dev-001",
        device_name: "My Phone",
        paired_at: "2026-05-01T10:00:00Z",
        public_key: "-----BEGIN PUBLIC KEY-----\n\nabcd\n-----END PUBLIC KEY-----",
        last_seen_at: "2026-05-20T08:00:00Z",
      },
      {
        device_id: "dev-002",
        device_name: "Office Laptop",
        paired_at: "2026-04-15T12:00:00Z",
      },
    ];
    mockInvoke.mockResolvedValueOnce(pairings);

    const result = await invoke("get_pairings");
    expect(result).toHaveLength(2);
    expect(result[0].device_id).toBe("dev-001");
    expect(result[0].device_name).toBe("My Phone");
    expect(result[0].public_key).toBeDefined();
    expect(result[0].last_seen_at).toBeDefined();
    // Second entry has no public_key
    expect(result[1].public_key).toBeUndefined();
  });

  it("save_device_pairing persists a pairing entry", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const entry: PairingEntry = {
      device_id: "dev-003",
      device_name: "Tablet",
      paired_at: "2026-05-20T12:00:00Z",
    };
    await invoke("save_device_pairing", { entry });
    expect(mockInvoke).toHaveBeenCalledWith("save_device_pairing", { entry });
  });

  it("remove_device_pairing deletes a pairing", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("remove_device_pairing", { device_id: "dev-001" });
    expect(mockInvoke).toHaveBeenCalledWith("remove_device_pairing", { device_id: "dev-001" });
  });
});

// ============================================================================
// 14. Device Sync
// ============================================================================

describe("Device Sync IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("push_changes sends changes to backend", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const changes: SyncedChange[] = [
      {
        id: "change-1",
        device_id: "dev-001",
        timestamp: 1700000000000,
        kind: { EmailFlagRead: "msg-123" },
        payload: '{"uid":42,"folder":"INBOX"}',
        acknowledged: false,
      },
    ];
    await invoke("push_changes", { device_id: "dev-001", changes });
    expect(mockInvoke).toHaveBeenCalledWith("push_changes", { device_id: "dev-001", changes });
  });

  it("pull_changes returns SyncedChange[] since timestamp", async () => {
    const changes: SyncedChange[] = [
      {
        id: "change-2",
        device_id: "dev-002",
        timestamp: 1700001000000,
        kind: { VaultFileAdded: "doc.pdf" },
        payload: '{"path":"/vault/doc.pdf"}',
      },
    ];
    mockInvoke.mockResolvedValueOnce(changes);

    const result = await invoke("pull_changes", { device_id: "dev-001", since_timestamp: 1700000000000 });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toEqual({ VaultFileAdded: "doc.pdf" });
  });

  it("ack_sync acknowledges up to a timestamp", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("ack_sync", { device_id: "dev-001", up_to_timestamp: 1700002000000 });
    expect(mockInvoke).toHaveBeenCalledWith("ack_sync", { device_id: "dev-001", up_to_timestamp: 1700002000000 });
  });

  it("record_change stores a change and returns it", async () => {
    const change: SyncedChange = {
      id: "change-3",
      device_id: "dev-001",
      timestamp: 1700003000000,
      kind: { SettingChanged: { key: "theme", value: "dark" } },
      payload: '{"theme":"dark"}',
    };
    mockInvoke.mockResolvedValueOnce(change);

    const result = await invoke("record_change", {
      device_id: "dev-001",
      kind: { SettingChanged: { key: "theme", value: "dark" } },
      payload: '{"theme":"dark"}',
    });
    expect(result.id).toBe("change-3");
    expect(result.kind).toEqual({ SettingChanged: { key: "theme", value: "dark" } });
  });
});

// ============================================================================
// 15. Export / Backup
// ============================================================================

describe("Export & Backup IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("append_to_mbox appends a message to mbox file", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("append_to_mbox", {
      file_path: "/backup/output.mbox",
      message_rfc2822: "From: ...\r\nSubject: Export\r\n\r\nBody",
      from_address: "user@example.com",
      date_seconds: 1700000000,
    });
    expect(mockInvoke).toHaveBeenCalledWith("append_to_mbox", {
      file_path: "/backup/output.mbox",
      message_rfc2822: "From: ...\r\nSubject: Export\r\n\r\nBody",
      from_address: "user@example.com",
      date_seconds: 1700000000,
    });
  });

  it("get_export_formats returns available formats", async () => {
    mockInvoke.mockResolvedValueOnce(["mbox", "eml", "pdf"]);
    const result = await invoke("get_export_formats");
    expect(result).toContain("mbox");
    expect(result).toContain("eml");
  });

  it("get_backup_config returns backup settings", async () => {
    const config: BackupConfig = {
      enabled: true,
      interval_secs: 86400,
      retention_count: 7,
      destination_path: "/backups/sme",
    };
    mockInvoke.mockResolvedValueOnce(config);

    const result = await invoke("get_backup_config");
    expect(result.enabled).toBe(true);
    expect(result.interval_secs).toBe(86400);
    expect(result.retention_count).toBe(7);
  });

  it("set_backup_config persists new config", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const config: BackupConfig = { enabled: true, interval_secs: 43200, retention_count: 14 };
    await invoke("set_backup_config", { new_config: config });
    expect(mockInvoke).toHaveBeenCalledWith("set_backup_config", { new_config: config });
  });

  it("toggle_backup enables/disables backup", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("toggle_backup", { enabled: false });
    expect(mockInvoke).toHaveBeenCalledWith("toggle_backup", { enabled: false });
  });
});

// ============================================================================
// 16. Orchestrator / Health
// ============================================================================

describe("Orchestrator IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("get_sync_health_summary returns SyncHealthSummary", async () => {
    const fixture: SyncHealthSummary = {
      total_syncs: 150,
      failed_syncs: 3,
      success_rate_percent: 98.0,
      last_error: "Connection timeout at 2026-05-19T10:00:00Z",
      last_sync_at: 1700000000,
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("get_sync_health_summary");
    expect(result.total_syncs).toBe(150);
    expect(result.failed_syncs).toBe(3);
    expect(result.success_rate_percent).toBe(98.0);
    expect(result.last_error).toContain("Connection timeout");
  });
});

// ============================================================================
// 17. Assets / Cache
// ============================================================================

describe("Assets & Cache IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("get_cache_size returns bytes", async () => {
    mockInvoke.mockResolvedValueOnce(52428800);
    const result = await invoke("get_cache_size");
    expect(result).toBe(52428800);
  });

  it("clear_cache resolves successfully", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await expect(invoke("clear_cache")).resolves.toBeUndefined();
  });

  it("get_attachment_cache_path returns a file path", async () => {
    mockInvoke.mockResolvedValueOnce("/tmp/sme-cache/attachments/abc123.png");
    const result = await invoke("get_attachment_cache_path", {
      attachment_id: "abc123",
      extension: "png",
    });
    expect(result).toContain("abc123");
    expect(result).toContain(".png");
  });
});

// ============================================================================
// 18. IMAP IDLE
// ============================================================================

describe("IMAP IDLE IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("start_idle begins IDLE on a folder", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("start_idle", { account_id: "acct-1", config: imapConfig });
    expect(mockInvoke).toHaveBeenCalledWith("start_idle", { account_id: "acct-1", config: imapConfig });
  });

  it("stop_idle ends IDLE for an account", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("stop_idle", { account_id: "acct-1" });
    expect(mockInvoke).toHaveBeenCalledWith("stop_idle", { account_id: "acct-1" });
  });
});

// ============================================================================
// 19. App-level Commands
// ============================================================================

describe("App-level IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("reset_app resolves successfully", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await expect(invoke("reset_app")).resolves.toBeUndefined();
  });
});

// ============================================================================
// 20. Error Handling - Generic
// ============================================================================

describe("IPC Error Handling", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("non-existent command returns descriptive error", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("command not found: `nonexistent_cmd`"));

    await expect(
      invoke("get_platform" as any),
    ).rejects.toThrow("command not found");
  });

  it("network error returns structured error", async () => {
    const networkError = {
      code: "ERR_NETWORK",
      message: "Failed to fetch: connection refused",
    };
    mockInvoke.mockRejectedValueOnce(networkError);

    await expect(invoke("get_platform")).rejects.toEqual(networkError);
  });

  it("invalid params return structured validation error", async () => {
    const validationError = {
      code: -32602,
      message: "invalid params: missing field `host`",
    };
    mockInvoke.mockRejectedValueOnce(validationError);

    await expect(
      invoke("imap_list_folders", {
        config: null as unknown as ImapConfig,
      }),
    ).rejects.toEqual(validationError);
  });

  it("handles backend panic gracefully", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("panic: index out of bounds"));

    await expect(invoke("get_vault_root")).rejects.toThrow("panic");
  });

  it("handles timeout errors", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("invoke timeout: request took longer than 30s"));

    await expect(invoke("check_dns_records", { domain: "slow.example.com" })).rejects.toThrow("timeout");
  });
});

// ============================================================================
// 21. IMAP — Raw fetch diagnostic
// ============================================================================

describe("IMAP IPC — Diagnostic", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("imap_raw_fetch_diagnostic returns raw response string", async () => {
    const raw = "* 1 FETCH (UID 42 FLAGS (\\Seen) BODY[HEADER.FIELDS (FROM SUBJECT)] {42}\r\nFrom: test\r\nSubject: Hello\r\n\r\n)";
    mockInvoke.mockResolvedValueOnce(raw);

    const result = await invoke("imap_raw_fetch_diagnostic", {
      config: imapConfig,
      folder: "INBOX",
      uid_range: "1:5",
    });
    expect(result).toContain("UID 42");
    expect(result).toContain("BODY[HEADER.FIELDS");
  });
});

// ============================================================================
// 22. IMAP — Search variants
// ============================================================================

describe("IMAP IPC — Search", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("imap_search_all_uids returns all UIDs in a folder", async () => {
    mockInvoke.mockResolvedValueOnce([1, 2, 3, 4, 5]);
    const result = await invoke("imap_search_all_uids", {
      config: imapConfig,
      folder: "INBOX",
    });
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("imap_search_folder returns search results", async () => {
    const fixture: ImapFolderSearchResult = {
      uids: [10, 20],
      folder_status: { uidvalidity: 1, uidnext: 100, exists: 2, unseen: 0 },
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("imap_search_folder", {
      config: imapConfig,
      folder: "INBOX",
      since_date: "2026-01-01",
    });
    expect(result.uids).toEqual([10, 20]);
  });
});

// ============================================================================
// 23. IMAP — Fetch new UIDs
// ============================================================================

describe("IMAP IPC — Fetch new UIDs", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("imap_fetch_new_uids returns new UIDs since a given uid", async () => {
    mockInvoke.mockResolvedValueOnce([101, 102, 103]);
    const result = await invoke("imap_fetch_new_uids", {
      config: imapConfig,
      folder: "INBOX",
      since_uid: 100,
    });
    expect(result).toEqual([101, 102, 103]);
  });
});

// ============================================================================
// 24. OAuth browser flow
// ============================================================================

describe("OAuth IPC — Browser", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("start_oauth_browser returns OAuthResult", async () => {
    const fixture: OAuthResult = { code: "auth-code", state: "state-value" };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("start_oauth_browser", {
      auth_url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=xxx",
      state: "state-value",
    });
    expect(result.code).toBe("auth-code");
    expect(result.state).toBe("state-value");
  });
});

// ============================================================================
// 25. Vault — Copy operations
// ============================================================================

describe("Vault IPC — Copy & Move", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("copy_vault_item copies within vault", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("copy_vault_item", { source_path: "/vault/a.txt", dest_path: "/vault/b.txt" });
    expect(mockInvoke).toHaveBeenCalledWith("copy_vault_item", { source_path: "/vault/a.txt", dest_path: "/vault/b.txt" });
  });

  it("move_vault_item moves within vault", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const { invoke } = await import("@shared/services/commands");
    await invoke("move_vault_item", { source_path: "/vault/old", dest_path: "/vault/new" });
    expect(mockInvoke).toHaveBeenCalledWith("move_vault_item", { source_path: "/vault/old", dest_path: "/vault/new" });
  });

  it("rename_vault_item renames a vault entry", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const { invoke } = await import("@shared/services/commands");
    await invoke("rename_vault_item", { path: "/vault/oldname", new_name: "newname" });
    expect(mockInvoke).toHaveBeenCalledWith("rename_vault_item", { path: "/vault/oldname", new_name: "newname" });
  });

  it("copy_to_vault_encrypted copies with encryption options", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("copy_to_vault_encrypted", {
      source_path: "/tmp/secret.pdf",
      vault_path: "/vault/secret.pdf",
      options: { encrypt: true, publicKeyArmored: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nkey\n-----END PGP PUBLIC KEY BLOCK-----" },
    });
    expect(mockInvoke).toHaveBeenCalledWith("copy_to_vault_encrypted", {
      source_path: "/tmp/secret.pdf",
      vault_path: "/vault/secret.pdf",
      options: { encrypt: true, publicKeyArmored: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nkey\n-----END PGP PUBLIC KEY BLOCK-----" },
    });
  });

  it("copy_vault_to_downloads exports to downloads", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("copy_vault_to_downloads", { vault_path: "/vault/report.pdf" });
    expect(mockInvoke).toHaveBeenCalledWith("copy_vault_to_downloads", { vault_path: "/vault/report.pdf" });
  });

  it("create_vault_dir creates directory", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("create_vault_dir", { path: "/vault/newdir" });
    expect(mockInvoke).toHaveBeenCalledWith("create_vault_dir", { path: "/vault/newdir" });
  });
});

// ============================================================================
// 26. Export — Analytics
// ============================================================================

describe("Export IPC — Analytics", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("export_analytics_report returns a file path", async () => {
    mockInvoke.mockResolvedValueOnce("/exports/analytics-2026-05-20.csv");
    const result = await invoke("export_analytics_report", { campaign_data: JSON.stringify({ campaign: "Q2" }) });
    expect(result).toContain("analytics");
    expect(result).toContain(".csv");
  });

  it("validate_export_config returns true for valid config", async () => {
    mockInvoke.mockResolvedValueOnce(true);
    const result = await invoke("validate_export_config", {
      format: "mbox",
      destination: "/exports/output.mbox",
    });
    expect(result).toBe(true);
  });

  it("validate_export_config returns false for invalid format", async () => {
    mockInvoke.mockResolvedValueOnce(false);
    const result = await invoke("validate_export_config", {
      format: "unsupported",
      destination: "/exports/out.xyz",
    });
    expect(result).toBe(false);
  });
});

// ============================================================================
// 27. Sync history & maintenance
// ============================================================================

describe("Sync Log IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("sync_log_get_history returns recent changes", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const result = await invoke("sync_log_get_history", { limit: 10 });
    expect(result).toEqual([]);
  });

  it("sync_log_maintenance prunes old entries", async () => {
    mockInvoke.mockResolvedValueOnce({ pruned_count: 50, remaining_count: 200 });
    const result = await invoke("sync_log_maintenance", { older_than_secs: 604800 });
    expect(result.pruned_count).toBe(50);
    expect(result.remaining_count).toBe(200);
  });
});

// ============================================================================
// 28. DNS Blacklist
// ============================================================================

describe("DNSBL IPC", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("check_dnsbl_cmd returns blacklist check results", async () => {
    mockInvoke.mockResolvedValueOnce([
      { list_name: "zen.spamhaus.org", listed: false, responded: true },
      { list_name: "bl.spamcop.net", listed: false, responded: true },
    ]);

    const result = await invoke("check_dnsbl_cmd", { ip: "1.2.3.4" });
    expect(result).toHaveLength(2);
    expect(result[0].list_name).toBe("zen.spamhaus.org");
    expect(result[0].listed).toBe(false);
  });
});

// ============================================================================
// 29. PGP — Rotation
// ============================================================================

describe("PGP IPC — Key Rotation", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("rotate_pgp_key returns new key info", async () => {
    const fixture: PgpKeyInfo = {
      id: "NEWKEY01",
      fingerprint: "NEWF:ING:ERP:RIN:NEWF:ING:ERP:RIN",
      user_id: "test@example.com",
      algorithm: "Ed25519",
      created_at: 1700000000,
      is_revoked: false,
    };
    mockInvoke.mockResolvedValueOnce(fixture);

    const result = await invoke("rotate_pgp_key", { key_id: "OLDKEY01", new_passphrase: "new-pass" });
    expect(result.id).toBe("NEWKEY01");
    expect(result.fingerprint).toContain(":");
  });
});

// ============================================================================
// 30. IMAP Batch — Fetch metadata
// ============================================================================

describe("IMAP IPC — Batch Fetch Metadata", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("batch_imap_fetch_metadata returns metadata array", async () => {
    mockInvoke.mockResolvedValueOnce([
      { uid: 1, flags: ["\\Seen"], size: 512 },
      { uid: 2, flags: [], size: 1024, envelope: "..." },
    ]);

    const result = await invoke("batch_imap_fetch_metadata", {
      config: imapConfig,
      folder: "INBOX",
      message_uids: [1, 2],
      fields: ["uid", "flags", "size"],
    });
    expect(result).toHaveLength(2);
    expect(result[0].uid).toBe(1);
    expect(result[0].flags).toContain("\\Seen");
    expect(result[1].size).toBe(1024);
  });
});

// ============================================================================
// 31. IMAP Sync (full) returns unknown
// ============================================================================

describe("IMAP IPC — Full Sync", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("imap_sync returns raw JSON value", async () => {
    mockInvoke.mockResolvedValueOnce({ status: "completed", synced_folders: ["INBOX", "Sent"] });

    const result = await invoke("imap_sync", {
      config: imapConfig,
      folder: "INBOX",
      batch_size: 50,
    });
    expect(result).toEqual({ status: "completed", synced_folders: ["INBOX", "Sent"] });
  });
});
