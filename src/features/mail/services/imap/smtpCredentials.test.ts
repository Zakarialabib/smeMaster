import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSmtpConfig } from "./imapConfigBuilder";
import { insertImapAccount } from "@features/accounts/db/accounts";
import { createAccount } from "@shared/services/db/db-invoke";
import { createMockDbAccount } from "@/test/mocks";
import type { DbAccount } from "@features/accounts/db/accounts";

vi.mock("@shared/services/db/db-invoke", () => ({
  createAccount: vi.fn(),
}));

vi.mock("@shared/utils/crypto", () => ({
  encryptValue: vi.fn((val: string) => Promise.resolve(`enc:${val}`)),
  decryptValue: vi.fn((val: string) => Promise.resolve(val.replace(/^enc:/, ""))),
  isEncrypted: vi.fn((val: string) => val.startsWith("enc:")),
}));

describe("buildSmtpConfig \u2014 separate SMTP credentials preferred", () => {
  it("uses smtp_username when both smtp_username and imap_username are set", () => {
    const account = createMockDbAccount({
      smtp_username: "smtp-user",
      imap_username: "imap-user",
      smtp_password: "smtp-pass",
      imap_password: "imap-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("smtp-user");
  });

  it("uses smtp_password when both smtp_password and imap_password are set", () => {
    const account = createMockDbAccount({
      smtp_password: "smtp-pass",
      imap_password: "imap-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("smtp-pass");
  });

  it("uses both smtp_username and smtp_password when available", () => {
    const account = createMockDbAccount({
      smtp_username: "dedicated-smtp",
      smtp_password: "dedicated-smtp-secret",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("dedicated-smtp");
    expect(config.password).toBe("dedicated-smtp-secret");
  });

  it("prefers smtp_username over imap_username even when imap_username is non-empty", () => {
    const account = createMockDbAccount({
      smtp_username: "relay-user",
      imap_username: "primary-user",
      smtp_password: null,
      imap_password: "fallback-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("relay-user");
    expect(config.password).toBe("fallback-pass");
  });

  it("prefers smtp_password over imap_password even when imap_password is non-empty", () => {
    const account = createMockDbAccount({
      smtp_username: null,
      imap_username: "primary-user",
      smtp_password: "relay-pass",
      imap_password: "fallback-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("primary-user");
    expect(config.password).toBe("relay-pass");
  });
});

describe("buildSmtpConfig \u2014 fallback to IMAP credentials", () => {
  it("falls back to imap_username when smtp_username is null", () => {
    const account = createMockDbAccount({
      smtp_username: null,
      imap_username: "imap-login",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("imap-login");
  });

  it("falls back to imap_password when smtp_password is null", () => {
    const account = createMockDbAccount({
      smtp_password: null,
      imap_password: "imap-secret",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("imap-secret");
  });

  it("falls back to email when both smtp_username and imap_username are null", () => {
    const account = createMockDbAccount({
      smtp_username: null,
      imap_username: null,
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("user@example.com");
  });

  it("falls back to empty string when smtp_password and imap_password are null", () => {
    const account = createMockDbAccount({
      smtp_password: null,
      imap_password: null,
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("");
  });

  it("falls back to email when smtp_username is null and imap_username is empty string", () => {
    const account = createMockDbAccount({
      smtp_username: null,
      imap_username: "" as string | null,
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("user@example.com");
  });

  it("uses imap_password when smtp_password is empty string and imap_password is set", () => {
    const account = createMockDbAccount({
      smtp_password: "",
      imap_password: "imap-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("imap-pass");
  });
});

describe("buildSmtpConfig \u2014 empty string handling", () => {
  it("treats empty smtp_username as falsy and falls back to imap_username", () => {
    const account = createMockDbAccount({
      smtp_username: "",
      imap_username: "imap-user",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("imap-user");
  });

  it("treats empty smtp_username as falsy and falls back to email when imap_username is also null", () => {
    const account = createMockDbAccount({
      smtp_username: "",
      imap_username: null,
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("user@example.com");
  });

  it("treats empty smtp_password as falsy and falls back to imap_password", () => {
    const account = createMockDbAccount({
      smtp_password: "",
      imap_password: "real-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("real-pass");
  });

  it("treats empty smtp_password as falsy and falls back to empty string when imap_password is null", () => {
    const account = createMockDbAccount({
      smtp_password: "",
      imap_password: null,
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("");
  });

  it("treats empty imap_username as falsy and falls back to email", () => {
    const account = createMockDbAccount({
      smtp_username: null,
      imap_username: "",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("user@example.com");
  });
});

describe("insertImapAccount \u2014 SMTP credential columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores smtp_username in the smtp_username field", async () => {
    await insertImapAccount({
      id: "imap-smtp-1",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass",
      smtpUsername: "smtp-login",
      smtpPassword: null,
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ smtpUsername: "smtp-login" }),
    );
  });

  it("stores smtp_password encrypted in the smtp_password field", async () => {
    await insertImapAccount({
      id: "imap-smtp-2",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass",
      smtpUsername: "smtp-user",
      smtpPassword: "smtp-secret",
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        smtpUsername: "smtp-user",
        smtpPassword: "enc:smtp-secret",
      }),
    );
  });

  it("stores null for smtp_username and smtp_password when not provided", async () => {
    await insertImapAccount({
      id: "imap-no-smtp",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass",
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        smtpUsername: null,
        smtpPassword: null,
      }),
    );
  });

  it("stores null smtp_password when smtpPassword is null", async () => {
    await insertImapAccount({
      id: "imap-smtp-null",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass",
      smtpUsername: "smtp-user",
      smtpPassword: null,
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        smtpUsername: "smtp-user",
        smtpPassword: null,
      }),
    );
  });

  it("encrypts IMAP password and SMTP password independently", async () => {
    await insertImapAccount({
      id: "imap-dual-creds",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass-xyz",
      smtpUsername: "smtp-user",
      smtpPassword: "smtp-pass-abc",
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        imapPassword: "enc:imap-pass-xyz",
        smtpPassword: "enc:smtp-pass-abc",
      }),
    );
  });
});

describe("End-to-end: persist \u2192 decrypt \u2192 buildSmtpConfig pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decrypts encrypted smtp_password and uses it in SMTP config", async () => {
    const accountFromDb: DbAccount = createMockDbAccount({
      smtp_username: "smtp-user",
      smtp_password: "enc:smtp-decrypted-secret",
      imap_username: "imap-user",
      imap_password: "enc:imap-decrypted-secret",
    });

    const { decryptValue, isEncrypted } = await import("@shared/utils/crypto");
    const mockedDecrypt = vi.mocked(decryptValue);
    const mockedIsEncrypted = vi.mocked(isEncrypted);

    if (mockedIsEncrypted(accountFromDb.smtp_password!)) {
      accountFromDb.smtp_password = await mockedDecrypt(accountFromDb.smtp_password!);
    }
    if (mockedIsEncrypted(accountFromDb.imap_password!)) {
      accountFromDb.imap_password = await mockedDecrypt(accountFromDb.imap_password!);
    }

    const config = buildSmtpConfig(accountFromDb);
    expect(config.username).toBe("smtp-user");
    expect(config.password).toBe("smtp-decrypted-secret");
  });

  it("decrypts imap_password as fallback when smtp_password is not set", async () => {
    const accountFromDb: DbAccount = createMockDbAccount({
      smtp_username: null,
      smtp_password: null,
      imap_username: null,
      imap_password: "enc:imap-fallback-secret",
    });

    const { decryptValue, isEncrypted } = await import("@shared/utils/crypto");
    const mockedDecrypt = vi.mocked(decryptValue);
    const mockedIsEncrypted = vi.mocked(isEncrypted);

    if (accountFromDb.imap_password && mockedIsEncrypted(accountFromDb.imap_password)) {
      accountFromDb.imap_password = await mockedDecrypt(accountFromDb.imap_password);
    }

    const config = buildSmtpConfig(accountFromDb);
    expect(config.username).toBe("user@example.com");
    expect(config.password).toBe("imap-fallback-secret");
  });

  it("full insert \u2192 read \u2192 build pipeline with SMTP credentials", async () => {
    await insertImapAccount({
      id: "e2e-account",
      email: "user@fastmail.com",
      displayName: "Fastmail User",
      avatarUrl: null,
      imapHost: "imap.fastmail.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.fastmail.com",
      smtpPort: 465,
      smtpSecurity: "ssl",
      authMethod: "password",
      password: "imap-password",
      smtpUsername: "smtp-fastmail",
      smtpPassword: "smtp-password",
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        imapPassword: "enc:imap-password",
        smtpUsername: "smtp-fastmail",
        smtpPassword: "enc:smtp-password",
      }),
    );

    const decryptedAccount: DbAccount = createMockDbAccount({
      id: "e2e-account",
      email: "user@fastmail.com",
      smtp_host: "smtp.fastmail.com",
      smtp_port: 465,
      smtp_security: "ssl",
      imap_host: "imap.fastmail.com",
      imap_port: 993,
      imap_security: "ssl",
      imap_username: "user@fastmail.com",
      imap_password: "imap-password",
      smtp_username: "smtp-fastmail",
      smtp_password: "smtp-password",
    });

    const config = buildSmtpConfig(decryptedAccount);
    expect(config.host).toBe("smtp.fastmail.com");
    expect(config.port).toBe(465);
    expect(config.security).toBe("tls");
    expect(config.username).toBe("smtp-fastmail");
    expect(config.password).toBe("smtp-password");
    expect(config.auth_method).toBe("password");
  });

  it("full pipeline with null SMTP creds falls back correctly", async () => {
    const account: DbAccount = createMockDbAccount({
      smtp_username: null,
      smtp_password: null,
      imap_username: "user@domain.com",
      imap_password: "imap-secret",
    });

    const config = buildSmtpConfig(account);
    expect(config.username).toBe("user@domain.com");
    expect(config.password).toBe("imap-secret");
  });
});

describe("buildSmtpConfig \u2014 edge cases", () => {
  it("preserves special characters in smtp_password (quotes, backslashes, percent)", () => {
    const specialPassword = `'my"smtp\\pass%word`;
    const account = createMockDbAccount({
      smtp_password: specialPassword,
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe(specialPassword);
  });

  it("preserves special characters in smtp_username", () => {
    const specialUsername = 'user@domain"with\\special';
    const account = createMockDbAccount({
      smtp_username: specialUsername,
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe(specialUsername);
  });

  it("handles unicode characters in smtp_username", () => {
    const account = createMockDbAccount({
      smtp_username: "\u7528\u6237@example.com",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("\u7528\u6237@example.com");
  });

  it("handles unicode characters in smtp_password", () => {
    const account = createMockDbAccount({
      smtp_password: "p\u00e4ssw\u00f6rd\ud83d\udd11",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("p\u00e4ssw\u00f6rd\ud83d\udd11");
  });

  it("handles very long smtp_password (1000 chars)", () => {
    const longPassword = "x".repeat(1000);
    const account = createMockDbAccount({
      smtp_password: longPassword,
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe(longPassword);
    expect(config.password).toHaveLength(1000);
  });

  it("handles very long smtp_username (256 chars)", () => {
    const longUsername = "u".repeat(256);
    const account = createMockDbAccount({
      smtp_username: longUsername,
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe(longUsername);
    expect(config.username).toHaveLength(256);
  });

  it("handles special characters in imap_password fallback", () => {
    const specialPassword = "p@ss:w0rd/with\\special=chars&more!";
    const account = createMockDbAccount({
      smtp_password: null,
      imap_password: specialPassword,
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe(specialPassword);
  });

  it("handles password with newlines and tabs", () => {
    const weirdPassword = "line1\nline2\ttab";
    const account = createMockDbAccount({
      smtp_password: weirdPassword,
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe(weirdPassword);
  });

  it("handles OAuth2 access token as password for SMTP", () => {
    const account = createMockDbAccount({
      auth_method: "oauth2",
      smtp_password: "stored-oauth-token",
      imap_password: "imap-oauth-token",
    });
    const config = buildSmtpConfig(account, "fresh-oauth-access-token");
    expect(config.password).toBe("fresh-oauth-access-token");
    expect(config.auth_method).toBe("oauth2");
  });

  it("OAuth2 without accessToken falls back to smtp_password", () => {
    const account = createMockDbAccount({
      auth_method: "oauth2",
      smtp_password: "stored-smtp-oauth-token",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("stored-smtp-oauth-token");
  });

  it("handles null-like string in smtp_password that is not empty", () => {
    const account = createMockDbAccount({
      smtp_password: "null",
      imap_password: "imap-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("null");
  });

  it("handles whitespace-only smtp_username (treated as truthy)", () => {
    const account = createMockDbAccount({
      smtp_username: "  ",
      imap_username: "imap-user",
    });
    const config = buildSmtpConfig(account);
    expect(config.username).toBe("  ");
  });

  it("handles whitespace-only smtp_password (treated as truthy, not falling back)", () => {
    const account = createMockDbAccount({
      smtp_password: "  ",
      imap_password: "imap-pass",
    });
    const config = buildSmtpConfig(account);
    expect(config.password).toBe("  ");
  });
});

describe("insertImapAccount \u2014 SMTP edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encrypts special characters in smtp_password", async () => {
    const specialPass = 'p@ss"w0rd\\test%';
    await insertImapAccount({
      id: "special-chars",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass",
      smtpUsername: "smtp-user",
      smtpPassword: specialPass,
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ smtpPassword: `enc:${specialPass}` }),
    );
  });

  it("does not encrypt smtp_password when it is null", async () => {
    await insertImapAccount({
      id: "null-smtp-pass",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass",
      smtpPassword: null,
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ smtpPassword: null }),
    );
  });

  it("does not encrypt smtp_password when it is undefined (not provided)", async () => {
    await insertImapAccount({
      id: "no-smtp-pass",
      email: "user@example.com",
      displayName: null,
      avatarUrl: null,
      imapHost: "imap.example.com",
      imapPort: 993,
      imapSecurity: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecurity: "starttls",
      authMethod: "password",
      password: "imap-pass",
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ smtpPassword: null }),
    );
  });
});
