import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddAccount } from "../AddAccount";
import { useAccountStore } from "@features/accounts/stores/accountStore";

// Mock feature flag store
vi.mock("@features/settings/stores/featureFlagStore", () => ({
  useFeatureFlagStore: vi.fn((selector) => {
    const state = { canCreate: vi.fn(() => true) };
    return selector(state);
  }),
}));

// Mock Tauri-dependent modules
vi.mock("@features/mail/services/gmail/auth", () => ({
  startOAuthFlow: vi.fn(),
}));

vi.mock("@features/mail/services/gmail/tokenManager", () => ({
  getClientId: vi.fn(),
  getClientSecret: vi.fn(),
}));

vi.mock("@features/accounts/db/accounts", () => ({
  insertAccount: vi.fn(),
}));

// Mock timestamp utility
vi.mock("@shared/utils/timestamp", () => ({
  getCurrentUnixTimestamp: vi.fn(() => 1000000),
}));

describe("AddAccount — Provider Detection", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
    });
  });

  it("renders the provider selection view with email input", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("shows Gmail provider badge when typing a gmail.com email", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@gmail.com" } });

    // The provider badge "G" should appear
    expect(screen.getByTitle("Google (Gmail API)")).toBeInTheDocument();
    expect(screen.getByText("Detected: Google (Gmail API)")).toBeInTheDocument();
  });

  it("shows Gmail as 'Best match' when entering a gmail.com email", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@gmail.com" } });

    // The Gmail option should be highlighted with "Best match"
    expect(screen.getByText("Best match")).toBeInTheDocument();
  });

  it("shows Microsoft provider badge when typing an outlook.com email", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@outlook.com" } });

    expect(screen.getByTitle("Microsoft (Graph API)")).toBeInTheDocument();
    expect(screen.getByText("Detected: Microsoft (Graph API)")).toBeInTheDocument();
  });

  it("shows Microsoft option for hotmail.com emails", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@hotmail.com" } });

    // Microsoft Graph should be detected
    expect(screen.getByTitle("Microsoft (Graph API)")).toBeInTheDocument();
    // The Microsoft option should be visible (detected) with "Best match"
    expect(screen.getByText("Best match")).toBeInTheDocument();
  });

  it("shows IMAP as default for custom domains", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@custom-company.com" } });

    // Should show IMAP as detected
    expect(screen.getByTitle("IMAP/SMTP")).toBeInTheDocument();
    expect(screen.getByText("Detected: IMAP/SMTP")).toBeInTheDocument();
  });

  it("shows no provider badge for incomplete email", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user" } });

    // No provider badge should appear
    expect(screen.queryByTitle("Google (Gmail API)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Microsoft (Graph API)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("IMAP/SMTP")).not.toBeInTheDocument();
  });

  it("shows no provider badge for email without domain", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@" } });

    expect(screen.queryByTitle("Google (Gmail API)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Microsoft (Graph API)")).not.toBeInTheDocument();
  });

  it("shows 'Show all connection options' when a provider is detected", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@gmail.com" } });

    // The "Show all" toggle should appear
    expect(screen.getByText("Show all connection options")).toBeInTheDocument();
  });

  it("shows all options when 'Show all' is clicked", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@gmail.com" } });
    fireEvent.click(screen.getByText("Show all connection options"));

    // Microsoft option should now be visible
    expect(screen.getByText("Microsoft (Outlook/Hotmail)")).toBeInTheDocument();
  });

  it("shows Yahoo detection with JMAP badge", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    const emailInput = screen.getByLabelText("Email Address");

    fireEvent.change(emailInput, { target: { value: "user@yahoo.com" } });

    expect(screen.getByTitle("JMAP (FastMail/Yahoo)")).toBeInTheDocument();
    expect(screen.getByText("Detected: JMAP (FastMail/Yahoo)")).toBeInTheDocument();
  });
});

describe("AddAccount — Multi-account (no tier cap)", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
    });
  });

  it("renders the provider selector with 5 existing accounts (no limit-reached UI)", () => {
    useAccountStore.setState({
      accounts: [
        { id: "1", email: "a@x.com", displayName: "A", avatarUrl: null, isActive: true, provider: "gmail_api" },
        { id: "2", email: "b@x.com", displayName: "B", avatarUrl: null, isActive: false, provider: "imap" },
        { id: "3", email: "c@x.com", displayName: "C", avatarUrl: null, isActive: false, provider: "gmail_api" },
        { id: "4", email: "d@x.com", displayName: "D", avatarUrl: null, isActive: false, provider: "imap" },
        { id: "5", email: "e@x.com", displayName: "E", avatarUrl: null, isActive: false, provider: "gmail_api" },
      ],
      activeAccountId: "1",
    });

    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    // Provider selector should be present
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    // No upgrade screen text
    expect(screen.queryByText("Account Limit Reached")).toBeNull();
    expect(screen.queryByText("Upgrade to Pro")).toBeNull();
  });
});
