import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenStatusBar } from "./TokenStatusBar";
import { useAccountStore } from "@features/accounts/stores/accountStore";

// Mock the useAccountToken hook so tests don't need Tauri or react-query
vi.mock("@features/accounts/hooks/useAccountToken", () => ({
  useAccountToken: vi.fn(),
}));

// Import the mocked module for typed mock control
import { useAccountToken } from "@features/accounts/hooks/useAccountToken";
import type { Mock } from "vitest";

const mockUseAccountToken = useAccountToken as Mock;

describe("TokenStatusBar", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
    });
    mockUseAccountToken.mockReset();
  });

  it("renders nothing when accountIds is empty", () => {
    const { container } = render(<TokenStatusBar accountIds={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all accounts with correct provider letters", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "gmail-1",
          email: "john@gmail.com",
          displayName: "John",
          avatarUrl: null,
          isActive: true,
          provider: "gmail_api",
        },
        {
          id: "outlook-1",
          email: "jane@outlook.com",
          displayName: "Jane",
          avatarUrl: null,
          isActive: false,
          provider: "microsoft_graph",
        },
        {
          id: "imap-1",
          email: "bob@example.com",
          displayName: "Bob",
          avatarUrl: null,
          isActive: false,
          provider: "imap",
        },
      ],
      activeAccountId: "gmail-1",
    });

    // All tokens healthy by default
    mockUseAccountToken.mockReturnValue({
      data: { health: "healthy", expiresAt: Date.now() / 1000 + 3600, remainingSeconds: 3600 },
      isLoading: false,
    });

    render(<TokenStatusBar accountIds={["gmail-1", "outlook-1", "imap-1"]} />);

    // Check provider badges (letter badges)
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
    expect(screen.getByText("I")).toBeInTheDocument();

    // Check emails displayed
    expect(screen.getByText("john@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("jane@outlook.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("shows correct status colors for healthy vs expired", () => {
    const now = Math.floor(Date.now() / 1000);

    useAccountStore.setState({
      accounts: [
        {
          id: "healthy-1",
          email: "good@gmail.com",
          displayName: null,
          avatarUrl: null,
          isActive: true,
          provider: "gmail_api",
        },
        {
          id: "expired-1",
          email: "bad@gmail.com",
          displayName: null,
          avatarUrl: null,
          isActive: false,
          provider: "gmail_api",
        },
      ],
      activeAccountId: "healthy-1",
    });

    // First account: healthy, second: expired
    mockUseAccountToken.mockImplementation((accountId: string) => {
      if (accountId === "healthy-1") {
        return {
          data: { health: "healthy" as const, expiresAt: now + 3600, remainingSeconds: 3600 },
          isLoading: false,
        };
      }
      return {
        data: { health: "expired" as const, expiresAt: now - 100, remainingSeconds: -100 },
        isLoading: false,
      };
    });

    render(<TokenStatusBar accountIds={["healthy-1", "expired-1"]} />);

    // Check aria-labels for status
    expect(screen.getByLabelText("good@gmail.com: Token healthy")).toBeInTheDocument();
    expect(screen.getByLabelText("bad@gmail.com: Re-auth required")).toBeInTheDocument();
  });

  it("shows refreshing (yellow) status with pulse animation", () => {
    const now = Math.floor(Date.now() / 1000);

    useAccountStore.setState({
      accounts: [
        {
          id: "refreshing-1",
          email: "refresh@outlook.com",
          displayName: null,
          avatarUrl: null,
          isActive: true,
          provider: "microsoft_graph",
        },
      ],
      activeAccountId: "refreshing-1",
    });

    mockUseAccountToken.mockReturnValue({
      data: {
        health: "refreshing" as const,
        expiresAt: now + 300,
        remainingSeconds: 300,
      },
      isLoading: false,
    });

    render(<TokenStatusBar accountIds={["refreshing-1"]} />);

    expect(screen.getByLabelText("refresh@outlook.com: Token refreshing…")).toBeInTheDocument();

    // Provider badge should be O for Outlook
    expect(screen.getByText("O")).toBeInTheDocument();
  });

  it("shows IMAP letter badge for imap accounts", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "imap-1",
          email: "user@custom.org",
          displayName: null,
          avatarUrl: null,
          isActive: true,
          provider: "imap",
        },
      ],
      activeAccountId: "imap-1",
    });

    mockUseAccountToken.mockReturnValue({
      data: { health: "unknown", expiresAt: null, remainingSeconds: null },
      isLoading: false,
    });

    render(<TokenStatusBar accountIds={["imap-1"]} />);

    expect(screen.getByText("I")).toBeInTheDocument();
    expect(screen.getByLabelText("user@custom.org: No token data")).toBeInTheDocument();
  });

  it("falls back gracefully when account not found in store", () => {
    mockUseAccountToken.mockReturnValue({
      data: { health: "unknown", expiresAt: null, remainingSeconds: null },
      isLoading: false,
    });

    // No accounts in store but we pass an ID
    render(<TokenStatusBar accountIds={["missing-id"]} />);

    // Should render with fallback letter
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
