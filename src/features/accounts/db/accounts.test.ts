import {
  getAllAccounts,
  getAccount,
  getAccountByEmail,
  insertImapAccount,
  insertAccount,
  deleteAccount,
  updateAccountTokens,
  updateAccountSyncState,
} from "./accounts";
import {
  createMockGmailAccount,
  createMockImapAccount,
} from "@/test/mocks";
import type { Account } from "../../../shared/services/db/db-invoke";

vi.mock("@shared/utils/crypto", () => ({
  encryptValue: vi.fn((val: string) => Promise.resolve(`enc:${val}`)),
  decryptValue: vi.fn((val: string) => Promise.resolve(val.replace("enc:", ""))),
  isEncrypted: vi.fn((val: string) => val.startsWith("enc:")),
}));

const mockGetAccount = vi.fn<[string], Promise<Account>>();
const mockGetAccountByEmail = vi.fn<[string], Promise<Account | null>>();
const mockListAccounts = vi.fn<[], Promise<Account[]>>();
const mockCreateAccount = vi.fn<[Record<string, unknown>], Promise<Account>>();
const mockUpdateAccount = vi.fn<[string, Record<string, unknown>], Promise<void>>();
const mockDeleteAccount = vi.fn<[string], Promise<void>>();
const mockUpdateAccountLastSync = vi.fn<[string, string], Promise<void>>();

vi.mock("../../../shared/services/db/db-invoke", () => ({
  getAccount: (...args: Parameters<typeof mockGetAccount>) => mockGetAccount(...args),
  getAccountByEmail: (...args: Parameters<typeof mockGetAccountByEmail>) => mockGetAccountByEmail(...args),
  listAccounts: (...args: Parameters<typeof mockListAccounts>) => mockListAccounts(...args),
  createAccount: (...args: Parameters<typeof mockCreateAccount>) => mockCreateAccount(...args),
  updateAccount: (...args: Parameters<typeof mockUpdateAccount>) => mockUpdateAccount(...args),
  deleteAccount: (...args: Parameters<typeof mockDeleteAccount>) => mockDeleteAccount(...args),
  updateAccountLastSync: (...args: Parameters<typeof mockUpdateAccountLastSync>) => mockUpdateAccountLastSync(...args),
}));

/** Converts a mock DB account (snake_case) into the Account type (also snake_case — same shape minus caldav fields). */
function toAccount(mock: ReturnType<typeof createMockGmailAccount>): Account {
  const { caldav_url, caldav_username, caldav_password, caldav_principal_url, caldav_home_url, calendar_provider, accept_invalid_certs, ...rest } = mock;
  return rest as unknown as Account;
}

describe("accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAccount", () => {
    it("returns null for non-existent account", async () => {
      mockGetAccount.mockRejectedValueOnce(new Error("not found"));

      const result = await getAccount("nonexistent");

      expect(result).toBeNull();
      expect(mockGetAccount).toHaveBeenCalledWith("nonexistent");
    });

    it("returns a Gmail account with decrypted tokens", async () => {
      const raw = createMockGmailAccount();
      mockGetAccount.mockResolvedValueOnce(toAccount(raw));

      const result = await getAccount("acc-gmail");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("acc-gmail");
      expect(result!.provider).toBe("gmail_api");
      expect(result!.access_token).toBe("access-token");
      expect(result!.refresh_token).toBe("refresh-token");
    });

    it("returns an IMAP account with decrypted imap_password", async () => {
      const raw = createMockImapAccount();
      mockGetAccount.mockResolvedValueOnce(toAccount(raw));

      const result = await getAccount("acc-imap");

      expect(result).not.toBeNull();
      expect(result!.provider).toBe("imap");
      expect(result!.imap_host).toBe("imap.example.com");
      expect(result!.imap_port).toBe(993);
      expect(result!.imap_security).toBe("tls");
      expect(result!.smtp_host).toBe("smtp.example.com");
      expect(result!.smtp_port).toBe(465);
      expect(result!.smtp_security).toBe("tls");
      expect(result!.auth_method).toBe("password");
      expect(result!.imap_password).toBe("secret-password");
    });

    it("handles IMAP account with null imap_password gracefully", async () => {
      const raw = createMockImapAccount({ imap_password: null });
      mockGetAccount.mockResolvedValueOnce(toAccount(raw));

      const result = await getAccount("acc-imap");

      expect(result!.imap_password).toBeNull();
    });
  });

  describe("getAccountByEmail", () => {
    it("returns account matching email", async () => {
      const raw = createMockImapAccount();
      mockGetAccountByEmail.mockResolvedValueOnce(toAccount(raw));

      const result = await getAccountByEmail("user@example.com");

      expect(result).not.toBeNull();
      expect(result!.email).toBe("user@example.com");
      expect(mockGetAccountByEmail).toHaveBeenCalledWith("user@example.com");
    });

    it("returns null when email not found", async () => {
      mockGetAccountByEmail.mockResolvedValueOnce(null);

      const result = await getAccountByEmail("unknown@example.com");

      expect(result).toBeNull();
    });
  });

  describe("getAllAccounts", () => {
    it("returns all accounts with decrypted tokens", async () => {
      const gmailRaw = createMockGmailAccount();
      const imapRaw = createMockImapAccount();
      mockListAccounts.mockResolvedValueOnce([toAccount(gmailRaw), toAccount(imapRaw)]);

      const result = await getAllAccounts();

      expect(result).toHaveLength(2);
      expect(result[0]!.provider).toBe("gmail_api");
      expect(result[0]!.access_token).toBe("access-token");
      expect(result[1]!.provider).toBe("imap");
      expect(result[1]!.imap_password).toBe("secret-password");
    });

    it("returns empty array when no accounts exist", async () => {
      mockListAccounts.mockResolvedValueOnce([]);

      const result = await getAllAccounts();

      expect(result).toEqual([]);
    });

    it("decrypts imap_password for IMAP accounts in the list", async () => {
      const imapRaw = createMockImapAccount();
      mockListAccounts.mockResolvedValueOnce([toAccount(imapRaw)]);

      const result = await getAllAccounts();

      expect(result[0]!.imap_password).toBe("secret-password");
    });
  });

  describe("insertImapAccount", () => {
    it("inserts IMAP account with encrypted password", async () => {
      const created = toAccount(createMockImapAccount({ id: "new-imap" }));
      mockCreateAccount.mockResolvedValueOnce(created);

      const result = await insertImapAccount({
        email: "user@fastmail.com",
        displayName: "Fastmail User",
        imapHost: "imap.fastmail.com",
        imapPort: 993,
        imapSecurity: "ssl",
        smtpHost: "smtp.fastmail.com",
        smtpPort: 465,
        smtpSecurity: "ssl",
        authMethod: "password",
        password: "my-app-password",
      });

      expect(result.id).toBe("new-imap");
      expect(mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@fastmail.com",
          displayName: "Fastmail User",
          provider: "imap",
          imapHost: "imap.fastmail.com",
          imapPort: 993,
          imapPassword: "enc:my-app-password",
        }),
      );
    });

    it("inserts IMAP account with custom username", async () => {
      const created = toAccount(createMockImapAccount({ id: "new-imap-2" }));
      mockCreateAccount.mockResolvedValueOnce(created);

      await insertImapAccount({
        email: "user@example.com",
        displayName: null,
        imapHost: "imap.example.com",
        imapPort: 993,
        imapSecurity: "ssl",
        smtpHost: "smtp.example.com",
        smtpPort: 465,
        smtpSecurity: "ssl",
        authMethod: "password",
        password: "pass",
        imapUsername: "custom-login-id",
      });

      expect(mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({ imapUsername: "custom-login-id" }),
      );
    });

    it("sets provider to imap for IMAP accounts", async () => {
      const created = toAccount(createMockImapAccount({ id: "imap-1" }));
      mockCreateAccount.mockResolvedValueOnce(created);

      await insertImapAccount({
        email: "test@test.com",
        displayName: null,
        imapHost: "imap.test.com",
        imapPort: 993,
        imapSecurity: "tls",
        smtpHost: "smtp.test.com",
        smtpPort: 587,
        smtpSecurity: "starttls",
        authMethod: "password",
        password: "pass",
      });

      expect(mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "imap" }),
      );
    });
  });

  describe("insertAccount (Gmail/OAuth)", () => {
    it("inserts OAuth account with encrypted tokens", async () => {
      mockCreateAccount.mockResolvedValueOnce(toAccount(createMockGmailAccount({ id: "gmail-1" })));
      mockUpdateAccount.mockResolvedValueOnce(undefined);

      await insertAccount({
        email: "user@gmail.com",
        displayName: "Test User",
        accessToken: "access-token-123",
        refreshToken: "refresh-token-456",
        tokenExpiresAt: 9999999999,
      });

      expect(mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@gmail.com",
          displayName: "Test User",
          provider: "gmail_api",
          accessToken: "enc:access-token-123",
          refreshToken: "enc:refresh-token-456",
        }),
      );
      expect(mockUpdateAccount).toHaveBeenCalledWith(
        "gmail-1",
        expect.objectContaining({
          set: expect.objectContaining({ token_expires_at: 9999999999 }),
        }),
      );
    });
  });

  describe("deleteAccount", () => {
    it("deletes account by id", async () => {
      mockDeleteAccount.mockResolvedValueOnce(undefined);

      await deleteAccount("acc-1");

      expect(mockDeleteAccount).toHaveBeenCalledWith("acc-1");
    });
  });

  describe("updateAccountTokens", () => {
    it("updates access_token with encryption", async () => {
      mockUpdateAccount.mockResolvedValueOnce(undefined);

      await updateAccountTokens("acc-1", "new-token", 1234567890);

      expect(mockUpdateAccount).toHaveBeenCalledWith(
        "acc-1",
        expect.objectContaining({
          set: expect.objectContaining({
            access_token: "enc:new-token",
            token_expires_at: 1234567890,
          }),
        }),
      );
    });
  });

  describe("updateAccountSyncState", () => {
    it("updates history_id and last_sync_at", async () => {
      mockUpdateAccountLastSync.mockResolvedValueOnce(undefined);

      await updateAccountSyncState("acc-1", "history-999");

      expect(mockUpdateAccountLastSync).toHaveBeenCalledWith("acc-1", "history-999");
    });
  });
});
