import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PgpKeyManager } from "./PgpKeyManager";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { invokeCommand } from "@shared/services/db/invoke/command";

const mockInvoke = vi.mocked(invokeCommand);

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@shared/services/db/invoke/command", () => ({
  invokeCommand: vi.fn(),
}));

const mockDbKeys = vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([]));
const mockDbDelete = vi.fn<() => Promise<void>>(() => Promise.resolve());

vi.mock("@shared/services/db/pgpKeys", () => ({
  getPgpKeys: (...args: unknown[]) => mockDbKeys(...args),
  deletePgpKey: (...args: unknown[]) => mockDbDelete(...args),
  savePgpKey: vi.fn(() => Promise.resolve("new-id")),
}));

// Sample PGP key info returned by the Rust backend
const sampleKeyInfo = {
  key_id: "A1B2C3D4",
  fingerprint: "ABCD1234EF567890ABCD1234EF567890ABCD1234",
  creation_time: "1700000000",
};

// Sample stored key (what the DB would return)
function makeDbKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    account_id: "acc1",
    key_id: "A1B2C3D4",
    public_key: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nfake\n-----END PGP PUBLIC KEY BLOCK-----",
    private_key_encrypted: "-----BEGIN PGP PRIVATE KEY BLOCK-----\nfake\n-----END PGP PRIVATE KEY BLOCK-----",
    passphrase_hint: null,
    fingerprint: "ABCD1234EF567890ABCD1234EF567890ABCD1234",
    created_at: 1700000000000,
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────

describe("PgpKeyManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAccountStore.setState({
      accounts: [{ id: "acc1", email: "test@test.com", displayName: "Test", avatarUrl: null, isActive: true }],
      activeAccountId: "acc1",
    });
    mockDbKeys.mockResolvedValue([]);
    mockInvoke.mockReset();
  });

  // ── Empty state ──────────────────────────────────────────────────────

  it("shows empty state when no keys exist", async () => {
    render(<PgpKeyManager />);
    expect(await screen.findByText("No PGP Keys")).toBeTruthy();
    expect(screen.getByText("Generate or import a PGP key to start encrypting your emails")).toBeTruthy();
  });

  it("shows generate and import buttons in empty state", async () => {
    render(<PgpKeyManager />);
    const buttons = await screen.findAllByText("Generate Key");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    const importButtons = await screen.findAllByText("Import Key");
    expect(importButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Key listing ──────────────────────────────────────────────────────

  it("renders keys from the DB", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k1", key_id: "ABCD1234" }),
      makeDbKey({ id: "k2", key_id: "5678EFGH", private_key_encrypted: null }),
    ]);

    render(<PgpKeyManager />);

    await waitFor(() => {
      expect(screen.getByText("ABCD1234")).toBeTruthy();
      expect(screen.getByText("5678EFGH")).toBeTruthy();
    });
  });

  it("shows 'Has Private Key' badge for keys with private part", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k1" }),
    ]);

    render(<PgpKeyManager />);
    expect(await screen.findByText("Has Private Key")).toBeTruthy();
  });

  it("shows 'Public Only' badge for keys without private part", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k2", private_key_encrypted: null }),
    ]);

    render(<PgpKeyManager />);
    expect(await screen.findByText("Public Only")).toBeTruthy();
  });

  it("shows key ID in the listing", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k1" }),
    ]);

    render(<PgpKeyManager />);
    expect(await screen.findByText("A1B2C3D4")).toBeTruthy();
  });

  it("renders key ID label", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k1" }),
    ]);

    render(<PgpKeyManager />);
    expect(await screen.findByText("Key ID:")).toBeTruthy();
  });

  it("renders created date", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k1", created_at: 1710000000000 }),
    ]);

    render(<PgpKeyManager />);
    expect(await screen.findByText("Created:")).toBeTruthy();
  });

  it("shows search input when keys exist", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k1" }),
    ]);

    render(<PgpKeyManager />);
    expect(await screen.findByPlaceholderText("Search keys by email or ID...")).toBeTruthy();
  });

  // ── Generate key dialog ──────────────────────────────────────────────

  it("opens generate dialog on button click", async () => {
    render(<PgpKeyManager />);
    const buttons = await screen.findAllByText("Generate Key");
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(await screen.findByText("Generate PGP Key")).toBeTruthy();
  });

  it("generate dialog has name, email, passphrase fields", async () => {
    render(<PgpKeyManager />);
    const buttons = await screen.findAllByText("Generate Key");
    fireEvent.click(buttons[buttons.length - 1]!);

    expect(await screen.findByText("Name")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Passphrase")).toBeTruthy();
  });

  it("generate button is disabled when form is incomplete", async () => {
    render(<PgpKeyManager />);
    const buttons = await screen.findAllByText("Generate Key");
    fireEvent.click(buttons[buttons.length - 1]!);

    const generateBtn = await screen.findByText("Generate");
    expect(generateBtn.closest("button")).toBeDisabled();
  });

  it("shows passphrase mismatch error", async () => {
    render(<PgpKeyManager />);
    const buttons = await screen.findAllByText("Generate Key");
    fireEvent.click(buttons[buttons.length - 1]!);

    const passInput = await screen.findByLabelText("Passphrase");
    const confirmPassInput = await screen.findByLabelText("Confirm Passphrase");
    fireEvent.change(passInput, { target: { value: "secret1" } });
    fireEvent.change(confirmPassInput, { target: { value: "secret2" } });

    expect(await screen.findByText("Passphrases do not match")).toBeTruthy();
  });

  it("calls generate_key on form submit", async () => {
    mockInvoke.mockImplementation(
      (cmd: string) =>
        cmd === "generate_key"
          ? Promise.resolve([
              "-----BEGIN PGP PUBLIC KEY BLOCK-----\nfake\n-----END PGP PUBLIC KEY BLOCK-----",
              "-----BEGIN PGP PRIVATE KEY BLOCK-----\nfake\n-----END PGP PRIVATE KEY BLOCK-----",
            ])
          : cmd === "get_key_info_cmd"
            ? Promise.resolve(sampleKeyInfo)
            : Promise.reject(new Error(`unknown command: ${cmd}`)),
    );

    render(<PgpKeyManager />);
    // Open dialog
    const buttons = await screen.findAllByText("Generate Key");
    fireEvent.click(buttons[buttons.length - 1]!);

    // Fill form
    const nameInput = await screen.findByLabelText("Name");
    const emailInput = await screen.findByLabelText("Email");
    const passInput = await screen.findByLabelText("Passphrase");
    const confirmPassInput = await screen.findByLabelText("Confirm Passphrase");

    fireEvent.change(nameInput, { target: { value: "Alice" } });
    fireEvent.change(emailInput, { target: { value: "alice@test.com" } });
    fireEvent.change(passInput, { target: { value: "secret123" } });
    fireEvent.change(confirmPassInput, { target: { value: "secret123" } });

    // Submit
    const generateBtn = screen.getByText("Generate");
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("generate_key", {
        userId: "Alice <alice@test.com>",
        passphrase: "secret123",
      });
    });
  });

  // ── Import key dialog ────────────────────────────────────────────────

  it("opens import dialog on button click", async () => {
    render(<PgpKeyManager />);
    const importBtns = await screen.findAllByText("Import Key");
    fireEvent.click(importBtns[0]!);
    expect(await screen.findByText("Import PGP Key")).toBeTruthy();
  });

  it("import dialog has textarea for armored key", async () => {
    render(<PgpKeyManager />);
    const importBtns = await screen.findAllByText("Import Key");
    fireEvent.click(importBtns[0]!);

    const textarea = await screen.findByPlaceholderText("-----BEGIN PGP PUBLIC KEY BLOCK-----...");
    expect(textarea).toBeTruthy();
  });

  it("validates armored key via get_key_info_cmd", async () => {
    mockInvoke.mockImplementation(
      <T,>(cmd: string) =>
        cmd === "get_key_info_cmd"
          ? Promise.resolve(sampleKeyInfo as unknown as T)
          : Promise.reject(new Error(`unknown: ${cmd}`)),
    );

    render(<PgpKeyManager />);
    // Click the "Import Key" button in the header to open the dialog
    const openBtns = await screen.findAllByText("Import Key");
    fireEvent.click(openBtns[0]!);

    const textarea = await screen.findByPlaceholderText("-----BEGIN PGP PUBLIC KEY BLOCK-----...");
    fireEvent.change(textarea, { target: { value: "-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----" } });

    // Click the "Import Key" parse button inside the dialog (last match)
    const importKeyBtns = await screen.findAllByText("Import Key");
    const parseBtn = importKeyBtns[importKeyBtns.length - 1]!;
    fireEvent.click(parseBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_key_info_cmd", {
        armoredKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----",
      });
    });
  });

  // ── Delete key ───────────────────────────────────────────────────────

  it("shows delete confirmation after clicking delete button", async () => {
    mockDbKeys.mockResolvedValue([makeDbKey({ id: "k1" })]);

    render(<PgpKeyManager />);
    const deleteBtn = await screen.findByTitle("Delete Key");
    fireEvent.click(deleteBtn);

    expect(await screen.findByRole("heading", { name: /delete key/i })).toBeTruthy();
  });

  it("calls deletePgpKey on confirm", async () => {
    mockDbKeys.mockResolvedValue([makeDbKey()]);
    mockDbDelete.mockResolvedValue();

    render(<PgpKeyManager />);
    const deleteBtn = await screen.findByTitle("Delete Key");
    fireEvent.click(deleteBtn);

    const confirmBtns = await screen.findAllByRole("button", { name: /delete key/i });
    const confirmBtn = confirmBtns.at(-1)!;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDbDelete).toHaveBeenCalledWith("key-1");
    });
  });

  // ── Export key ───────────────────────────────────────────────────────

  it("shows export to clipboard button per key", async () => {
    mockDbKeys.mockResolvedValue([makeDbKey({ id: "k1" })]);

    render(<PgpKeyManager />);
    const copyBtn = await screen.findByTitle("Copy to Clipboard");
    expect(copyBtn).toBeTruthy();
  });

  it("shows export to file button per key", async () => {
    mockDbKeys.mockResolvedValue([makeDbKey({ id: "k1" })]);

    render(<PgpKeyManager />);
    const downloadBtn = await screen.findByTitle("Export to File");
    expect(downloadBtn).toBeTruthy();
  });

  // ── Search filter ────────────────────────────────────────────────────

  it("filters keys by search query", async () => {
    mockDbKeys.mockResolvedValue([
      makeDbKey({ id: "k1", key_id: "ABCD", fingerprint: "aaaa1111" }),
      makeDbKey({ id: "k2", key_id: "EFGH", fingerprint: "bbbb2222" }),
    ]);

    render(<PgpKeyManager />);
    const searchInput = await screen.findByPlaceholderText("Search keys by email or ID...");
    fireEvent.change(searchInput, { target: { value: "ABCD" } });

    await waitFor(() => {
      expect(screen.getByText("ABCD")).toBeTruthy();
    });
  });

  // ── Error state ──────────────────────────────────────────────────────

  it("shows error when load fails", async () => {
    mockDbKeys.mockRejectedValue(new Error("DB error"));

    render(<PgpKeyManager />);
    expect(await screen.findByText("DB error")).toBeTruthy();
  });

  // ── No account ───────────────────────────────────────────────────────

  it("renders without crashing when no account is active", () => {
    useAccountStore.setState({ accounts: [], activeAccountId: null });
    const { container } = render(<PgpKeyManager />);
    expect(container.textContent).toBeTruthy();
  });
});
