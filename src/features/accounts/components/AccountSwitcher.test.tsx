import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountSwitcher } from "./AccountSwitcher";
import { useAccountStore } from "@features/accounts/stores/accountStore";

describe("AccountSwitcher", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
    });
  });

  it("shows add account button when no accounts", () => {
    render(<AccountSwitcher collapsed={false} onAddAccount={() => {}} />);
    expect(screen.getByText("Add Account")).toBeInTheDocument();
  });

  it("shows provider letter badge when avatarUrl is null", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "john@example.com",
          displayName: "John Doe",
          company: null,
          avatarUrl: null,
          provider: "gmail_api",
          isActive: true,
        },
      ],
      activeAccountId: "1",
    });

    render(<AccountSwitcher collapsed={false} onAddAccount={() => {}} />);
    // Provider letter "G" for Gmail, not name initial "J"
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("shows provider letter badge (IMAP fallback)", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "john@example.com",
          displayName: "John Doe",
          company: null,
          avatarUrl: null,
          isActive: true,
          // No provider set → defaults to "imap" → shows "I"
        },
      ],
      activeAccountId: "1",
    });

    render(<AccountSwitcher collapsed={false} onAddAccount={() => {}} />);
    expect(screen.getByText("I")).toBeInTheDocument();
  });

  it("falls back to email initial when displayName is null", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "alice@example.com",
          displayName: null,
          company: null,
          avatarUrl: null,
          provider: "gmail_api",
          isActive: true,
        },
      ],
      activeAccountId: "1",
    });

    render(<AccountSwitcher collapsed={false} onAddAccount={() => {}} />);
    // Gmail API → shows "G", not "A" from email
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("shows display name and email in trigger when expanded", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "john@example.com",
          displayName: "John Doe",
          company: null,
          avatarUrl: null,
          isActive: true,
        },
      ],
      activeAccountId: "1",
    });

    render(<AccountSwitcher collapsed={false} onAddAccount={() => {}} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("opens dropdown with account list on click", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "john@example.com",
          displayName: "John Doe",
          company: null,
          avatarUrl: null,
          isActive: true,
        },
        {
          id: "2",
          email: "jane@example.com",
          displayName: "Jane Smith",
          company: null,
          avatarUrl: null,
          isActive: false,
        },
      ],
      activeAccountId: "1",
    });

    render(<AccountSwitcher collapsed={false} onAddAccount={() => {}} />);

    // Click the trigger to open dropdown
    fireEvent.click(screen.getByText("John Doe"));

    // Both accounts should appear in the dropdown
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Add account")).toBeInTheDocument();
  });

  it("renders the quick-add + button next to the active account", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "john@example.com",
          displayName: "John Doe",
          company: null,
          avatarUrl: null,
          isActive: true,
        },
      ],
      activeAccountId: "1",
    });

    render(<AccountSwitcher collapsed={false} onAddAccount={() => {}} />);
    expect(screen.getByLabelText("Add account")).toBeInTheDocument();
  });

  it("quick-add button calls onAddAccount and does not toggle the dropdown", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "john@example.com",
          displayName: "John Doe",
          company: null,
          avatarUrl: null,
          isActive: true,
        },
      ],
      activeAccountId: "1",
    });

    let addCalls = 0;
    render(
      <AccountSwitcher
        collapsed={false}
        onAddAccount={() => {
          addCalls += 1;
        }}
      />,
    );

    // Click the quick-add button (not the trigger)
    fireEvent.click(screen.getByLabelText("Add account"));

    expect(addCalls).toBe(1);
    // Dropdown should NOT be open — "Add account" option only appears in dropdown
    expect(screen.queryByText("Add account")).toBeNull();
  });
});
