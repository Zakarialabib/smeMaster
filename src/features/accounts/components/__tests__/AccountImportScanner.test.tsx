import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccountImportScanner } from "../AccountImportScanner";

// Mock Tauri invoke directly (setup.ts override takes precedence over tauri.mock.ts)
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock toast notifications
vi.mock("@shared/services/notifications/toastHelper", () => ({
  notify: vi.fn(),
}));

const mockOnSelectAccount = vi.fn();
const mockOnClose = vi.fn();

const defaultProps = {
  onSelectAccount: mockOnSelectAccount,
  onClose: mockOnClose,
};

describe("AccountImportScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders initial state with scan button", () => {
    render(<AccountImportScanner {...defaultProps} />);

    expect(screen.getByText("Import from System")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Scan your system for email accounts configured in/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Scan for accounts/i }),
    ).toBeInTheDocument();
  });

  it("renders privacy notice", () => {
    render(<AccountImportScanner {...defaultProps} />);

    expect(screen.getByText(/Privacy first:/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<AccountImportScanner {...defaultProps} />);

    const closeButton = screen.getByLabelText("Close");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows scanning state when scan button is clicked", async () => {
    // Keep the promise unresolved to stay in loading state
    mockInvoke.mockReturnValue(new Promise(() => {}));

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    expect(screen.getByText("Scanning for email accounts...")).toBeInTheDocument();
  });

  it("calls invoke('scan_system_accounts') when scan button is clicked", async () => {
    mockInvoke.mockResolvedValue({
      accounts: [],
      sources_scanned: [],
      errors: [],
    });

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("scan_system_accounts");
    });
  });

  it("shows empty state when no accounts are found", async () => {
    mockInvoke.mockResolvedValue({
      accounts: [],
      sources_scanned: ["apple_mail"],
      errors: [],
    });

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      expect(
        screen.getByText("No email accounts found on this system."),
      ).toBeInTheDocument();
    });
  });

  it("shows scanned sources in results", async () => {
    const discoveryResult = {
      accounts: [
        {
          email: "user@gmail.com",
          display_name: "User",
          source: "apple_mail",
          provider_type: "gmail_api",
          imap_host: null,
          imap_port: null,
          imap_security: null,
          smtp_host: null,
          smtp_port: null,
          smtp_security: null,
          username: null,
          auth_method: null,
          oauth_provider: null,
        },
      ],
      sources_scanned: ["apple_mail", "thunderbird"],
      errors: [],
    };

    mockInvoke.mockResolvedValue(discoveryResult);

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      expect(screen.getByText(/Scanned:/)).toBeInTheDocument();
      expect(screen.getByText(/apple_mail, thunderbird/)).toBeInTheDocument();
    });
  });

  it("shows discovered account in results", async () => {
    const discoveryResult = {
      accounts: [
        {
          email: "user@gmail.com",
          display_name: "User",
          source: "apple_mail",
          provider_type: "gmail_api",
          imap_host: null,
          imap_port: null,
          imap_security: null,
          smtp_host: null,
          smtp_port: null,
          smtp_security: null,
          username: null,
          auth_method: null,
          oauth_provider: null,
        },
      ],
      sources_scanned: ["apple_mail"],
      errors: [],
    };

    mockInvoke.mockResolvedValue(discoveryResult);

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      expect(screen.getByText("User")).toBeInTheDocument();
      expect(screen.getByText(/user@gmail.com/)).toBeInTheDocument();
    });
  });

  it("selects an account on click and calls onSelectAccount via Continue", async () => {
    const discoveryResult = {
      accounts: [
        {
          email: "user@gmail.com",
          display_name: "User",
          source: "apple_mail",
          provider_type: "gmail_api",
          imap_host: null,
          imap_port: null,
          imap_security: null,
          smtp_host: null,
          smtp_port: null,
          smtp_security: null,
          username: null,
          auth_method: null,
          oauth_provider: null,
        },
      ],
      sources_scanned: ["apple_mail"],
      errors: [],
    };

    mockInvoke.mockResolvedValue(discoveryResult);

    render(<AccountImportScanner {...defaultProps} />);

    // Click scan
    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText("User")).toBeInTheDocument();
    });

    // Click the discovered account
    fireEvent.click(screen.getByText("User"));

    // Continue button should now be enabled
    const continueButton = screen.getByRole("button", { name: /Continue/i });
    expect(continueButton).not.toBeDisabled();

    // Click continue
    fireEvent.click(continueButton);

    expect(mockOnSelectAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@gmail.com",
        display_name: "User",
      }),
    );
  });

  it("shows Re-scan button when results are displayed", async () => {
    mockInvoke.mockResolvedValue({
      accounts: [
        {
          email: "user@gmail.com",
          display_name: "User",
          source: "apple_mail",
          provider_type: "gmail_api",
          imap_host: null,
          imap_port: null,
          imap_security: null,
          smtp_host: null,
          smtp_port: null,
          smtp_security: null,
          username: null,
          auth_method: null,
          oauth_provider: null,
        },
      ],
      sources_scanned: ["apple_mail"],
      errors: [],
    });

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Re-scan/i })).toBeInTheDocument();
    });
  });

  it("shows Continue button disabled when no account is selected", async () => {
    mockInvoke.mockResolvedValue({
      accounts: [
        {
          email: "user@gmail.com",
          display_name: "User",
          source: "apple_mail",
          provider_type: "gmail_api",
          imap_host: null,
          imap_port: null,
          imap_security: null,
          smtp_host: null,
          smtp_port: null,
          smtp_security: null,
          username: null,
          auth_method: null,
          oauth_provider: null,
        },
        {
          email: "other@outlook.com",
          display_name: "Other",
          source: "thunderbird",
          provider_type: "microsoft_graph",
          imap_host: null,
          imap_port: null,
          imap_security: null,
          smtp_host: null,
          smtp_port: null,
          smtp_security: null,
          username: null,
          auth_method: null,
          oauth_provider: null,
        },
      ],
      sources_scanned: ["apple_mail", "thunderbird"],
      errors: [],
    });

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      const continueButton = screen.getByRole("button", { name: /Continue/i });
      expect(continueButton).toBeDisabled();
    });
  });

  it("shows non-fatal errors section when errors exist", async () => {
    mockInvoke.mockResolvedValue({
      accounts: [],
      sources_scanned: ["apple_mail"],
      errors: ["thunderbird: permission denied"],
    });

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not be scanned/)).toBeInTheDocument();
    });
  });

  it("handles invoke rejection gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("Tauri command not found"));

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      // Should show the scan button again (initial state) after error
      expect(
        screen.getByRole("button", { name: /Scan for accounts/i }),
      ).toBeInTheDocument();
    });
  });

  it("displays provider badge color for gmail accounts", async () => {
    mockInvoke.mockResolvedValue({
      accounts: [
        {
          email: "user@gmail.com",
          display_name: "User",
          source: "apple_mail",
          provider_type: "gmail_api",
          imap_host: null,
          imap_port: null,
          imap_security: null,
          smtp_host: null,
          smtp_port: null,
          smtp_security: null,
          username: null,
          auth_method: null,
          oauth_provider: null,
        },
      ],
      sources_scanned: ["apple_mail"],
      errors: [],
    });

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      // Gmail badge should show "G"
      expect(screen.getByText("G")).toBeInTheDocument();
    });
  });

  it("displays IMAP host info when available", async () => {
    mockInvoke.mockResolvedValue({
      accounts: [
        {
          email: "user@custom.com",
          display_name: null,
          source: "thunderbird",
          provider_type: "imap_smtp",
          imap_host: "imap.custom.com",
          imap_port: 993,
          imap_security: "SSL",
          smtp_host: "smtp.custom.com",
          smtp_port: 465,
          smtp_security: "SSL",
          username: "user@custom.com",
          auth_method: "password",
          oauth_provider: null,
        },
      ],
      sources_scanned: ["thunderbird"],
      errors: [],
    });

    render(<AccountImportScanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Scan for accounts/i }));

    await waitFor(() => {
      expect(screen.getByText(/imap.custom.com/)).toBeInTheDocument();
      expect(screen.getByText(/993/)).toBeInTheDocument();
    });
  });
});
