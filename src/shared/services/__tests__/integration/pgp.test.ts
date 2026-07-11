import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { freshTestDb, runMigrations, getTestAccountId, seedAccount, MockTauriDb } from "./setup";

let db: MockTauriDb;
const passphraseStore = new Map<string, string>();

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@shared/utils/crypto", () => ({
  encryptValue: vi.fn((val: string) => Promise.resolve(`enc:${val}`)),
  decryptValue: vi.fn((val: string) => Promise.resolve(val.replace("enc:", ""))),
  isEncrypted: vi.fn((val: string) => val.startsWith("enc:")),
}));

describe("Integration: PGP", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    passphraseStore.clear();
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      switch (cmd) {
        case "generate_key":
          return Promise.resolve([
            "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nmock-public-key\n-----END PGP PUBLIC KEY BLOCK-----",
            "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nmock-private-key\n-----END PGP PRIVATE KEY BLOCK-----",
          ]);
        case "get_key_info_cmd":
          return Promise.resolve({
            key_id: "ABC12345",
            fingerprint: "ABCD:EF01:2345:6789:ABCD:EF01:2345:6789:ABCD:EF01",
            creation_time: "2026-01-15T10:00:00Z",
          });
        case "encrypt":
          return Promise.resolve("-----BEGIN PGP MESSAGE-----\n\nmock-ciphertext\n-----END PGP MESSAGE-----");
        case "decrypt_message":
          return Promise.resolve("Hello, this is a test secret message");
        case "pgp_cache_passphrase":
          passphraseStore.set(args!.accountId as string, args!.passphrase as string);
          return Promise.resolve(undefined);
        case "pgp_get_cached_passphrase":
          return Promise.resolve(passphraseStore.get(args!.accountId as string) ?? null);
        case "pgp_clear_passphrase_cache":
          passphraseStore.delete(args!.accountId as string);
          return Promise.resolve(undefined);
        default:
          return Promise.resolve(undefined);
      }
    });
    db = freshTestDb();
    await runMigrations();
    await seedAccount();
  });

  afterEach(() => {
    db?.close();
  });

  describe("PGP key generation and encryption roundtrip", () => {
    it("generates a key pair via invoke", async () => {
      const { generatePgpKey } = await import("@shared/services/pgp/pgpService");

      const [publicKey, privateKey] = await generatePgpKey("test@example.com", "test-passphrase");

      expect(publicKey).toContain("BEGIN PGP PUBLIC KEY BLOCK");
      expect(privateKey).toContain("BEGIN PGP PRIVATE KEY BLOCK");
      expect(mockInvoke).toHaveBeenCalledWith("generate_key", {
        userId: "test@example.com",
        passphrase: "test-passphrase",
      });
    });

    it("encrypts a message with a public key", async () => {
      const { encryptMessage } = await import("@shared/services/pgp/pgpService");

      const ciphertext = await encryptMessage(
        "Hello World",
        "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nkey\n-----END PGP PUBLIC KEY BLOCK-----",
      );

      expect(ciphertext).toContain("BEGIN PGP MESSAGE");
      expect(mockInvoke).toHaveBeenCalledWith("encrypt", {
        plaintext: "Hello World",
        publicKeyArmored: expect.stringContaining("BEGIN PGP PUBLIC KEY BLOCK"),
      });
    });

    it("decrypts a message with private key and passphrase", async () => {
      const { decryptMessage } = await import("@shared/services/pgp/pgpService");

      const plaintext = await decryptMessage(
        "-----BEGIN PGP MESSAGE-----\n\nmock-ciphertext\n-----END PGP MESSAGE-----",
        "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nkey\n-----END PGP PRIVATE KEY BLOCK-----",
        "test-passphrase",
      );

      expect(plaintext).toBe("Hello, this is a test secret message");
      expect(mockInvoke).toHaveBeenCalledWith("decrypt_message", {
        ciphertextB64: expect.any(String),
        privateKeyArmored: expect.stringContaining("BEGIN PGP PRIVATE KEY BLOCK"),
        passphrase: "test-passphrase",
      });
    });

    it("throws typed Error when decryption fails", async () => {
      mockInvoke.mockRejectedValueOnce("bad passphrase");
      const { decryptMessage } = await import("@shared/services/pgp/pgpService");

      await expect(
        decryptMessage("ciphertext", "private-key", "wrong-passphrase"),
      ).rejects.toThrow("Failed to decrypt message");
    });
  });

  describe("PGP key info", () => {
    it("retrieves key info from armored key", async () => {
      const { getPgpKeyInfo } = await import("@shared/services/pgp/pgpService");

      const info = await getPgpKeyInfo("-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nkey\n-----END PGP PUBLIC KEY BLOCK-----");

      expect(info.key_id).toBe("ABC12345");
      expect(info.fingerprint).toContain(":");
      expect(mockInvoke).toHaveBeenCalledWith("get_key_info_cmd", {
        armoredKey: expect.stringContaining("BEGIN PGP PUBLIC KEY BLOCK"),
      });
    });
  });

  describe("Rust-backed passphrase cache roundtrip", () => {
    it("stores passphrase via invoke and retrieves it", async () => {
      const { cachePassphrase, getCachedPassphrase, clearPassphraseCache } = await import("@shared/services/pgp/passphraseCache");

      await cachePassphrase("account-3", "rust-passphrase");
      const result = await getCachedPassphrase("account-3");
      expect(result).toBe("rust-passphrase");
      expect(mockInvoke).toHaveBeenCalledWith("pgp_cache_passphrase", {
        accountId: "account-3",
        passphrase: "rust-passphrase",
      });

      await clearPassphraseCache("account-3");
      const cleared = await getCachedPassphrase("account-3");
      expect(cleared).toBeNull();
    });
  });

  describe("PGP message detection", () => {
    it("detects PGP encrypted messages", async () => {
      const { isPgpMessage, extractPgpCiphertext } = await import("@shared/services/pgp/pgpService");

      expect(isPgpMessage("-----BEGIN PGP MESSAGE-----\n\ncontent\n-----END PGP MESSAGE-----")).toBe(true);
      expect(isPgpMessage("Just a normal email")).toBe(false);

      const extracted = extractPgpCiphertext("prefix\n-----BEGIN PGP MESSAGE-----\n\ncontent\n-----END PGP MESSAGE-----\nsuffix");
      expect(extracted).toContain("BEGIN PGP MESSAGE");
      expect(extracted).toContain("END PGP MESSAGE");
    });
  });
});
