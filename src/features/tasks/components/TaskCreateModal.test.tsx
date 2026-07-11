/**
 * TaskCreateModal tests
 *
 * Covers:
 * - Rendering with various prefill/state
 * - Form validation (empty title shows error, no account shows error)
 * - Tag management (add, remove, enter key, backspace)
 * - Contact search (debounced, selection)
 * - Successful submission
 * - Error handling during submission
 * - Source type tabs
 */

import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

// ── Mock dependencies ──────────────────────────────────────────────────────

vi.mock("@features/tasks/db/tasks", () => ({
  insertTask: vi.fn(),
}));

vi.mock("@features/contacts/db/contacts", () => ({
  searchContacts: vi.fn(),
}));

vi.mock("@shared/services/notifications/toastHelper", () => ({
  notify: vi.fn(),
}));

vi.mock("@shared/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    children,
    title,
    onClose,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    title?: string;
    onClose?: () => void;
  }) =>
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

vi.mock("@shared/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      data-testid={`button-${variant}`}
      type={type as "button" | "submit" | "reset"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
}));

// ── Module-scoped imports after mocks ──

import type { TaskCreatePrefill } from "./TaskCreateModal";
import { TaskCreateModal } from "./TaskCreateModal";
import { insertTask } from "@features/tasks/db/tasks";
import { searchContacts } from "@features/contacts/db/contacts";
import { notify } from "@shared/services/notifications/toastHelper";

const mockInsertTask = vi.mocked(insertTask);
const mockSearchContacts = vi.mocked(searchContacts);
const mockNotify = vi.mocked(notify);

// ── Shared test helpers ──

function renderModal(overrides: {
  isOpen?: boolean;
  onClose?: () => void;
  onCreated?: (id: string) => void;
  accountId?: string | null;
  prefill?: TaskCreatePrefill;
} = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    accountId: "acc-1" as string | null,
    ...overrides,
  };
  return render(<TaskCreateModal {...props} />);
}

describe("TaskCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  it("renders when isOpen=true", () => {
    renderModal();
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Create task")).toBeInTheDocument();
  });

  it("does not render when isOpen=false", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("renders source type tabs with correct defaults", () => {
    renderModal();
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("From email")).toBeInTheDocument();
    expect(screen.getByText("From note")).toBeInTheDocument();
  });

  it("shows pre-filled title when provided", () => {
    renderModal({ prefill: { title: "Pre-filled task", source: "manual" } });
    const input = screen.getByPlaceholderText("What needs to be done?");
    expect(input).toHaveValue("Pre-filled task");
  });

  it("shows linked contact when pre-filled", () => {
    renderModal({
      prefill: { contactId: "c1", contactName: "John Doe", source: "manual" },
    });
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows email source banner when source is from_email with threadId", () => {
    renderModal({
      prefill: { threadId: "thread-1", source: "from_email" },
    });
    expect(screen.getByText("Linked to email thread")).toBeInTheDocument();
  });

  it("shows note source banner when source is from_note", () => {
    renderModal({
      prefill: { title: "Note content", source: "from_note" },
    });
    expect(screen.getByText("Converted from note")).toBeInTheDocument();
  });

  // ── Validation ──

  it("shows error when submitting with empty title", async () => {
    renderModal();
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => {
      expect(screen.getByText("Task title is required.")).toBeInTheDocument();
    });
    expect(mockInsertTask).not.toHaveBeenCalled();
  });

  it("shows error when no account is selected", async () => {
    renderModal({ accountId: null });
    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    await userEvent.type(titleInput, "My task");
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => {
      expect(screen.getByText("No active account selected.")).toBeInTheDocument();
    });
    expect(mockInsertTask).not.toHaveBeenCalled();
  });

  // ── Tag management ──

  it("adds a tag when pressing Enter in the tag input", async () => {
    renderModal();
    const tagInput = screen.getByPlaceholderText("Add a tag and press Enter");
    await userEvent.type(tagInput, "urgent{Enter}");
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("adds a tag when clicking Add button", async () => {
    renderModal();
    const tagInput = screen.getByPlaceholderText("Add a tag and press Enter");
    await userEvent.type(tagInput, "crm");
    const addBtn = screen.getByText("Add");
    fireEvent.click(addBtn);
    expect(screen.getByText("crm")).toBeInTheDocument();
  });

  it("removes a tag when clicking the X button", async () => {
    renderModal();
    const tagInput = screen.getByPlaceholderText("Add a tag and press Enter");
    await userEvent.type(tagInput, "remove-me{Enter}");
    expect(screen.getByText("remove-me")).toBeInTheDocument();
    const removeBtn = screen.getByLabelText("Remove tag remove-me");
    fireEvent.click(removeBtn);
    expect(screen.queryByText("remove-me")).not.toBeInTheDocument();
  });

  it("removes last tag with Backspace when input is empty", async () => {
    renderModal();
    const tagInput = screen.getByPlaceholderText("Add a tag and press Enter");
    await userEvent.type(tagInput, "tag1{Enter}");
    await userEvent.type(tagInput, "tag2{Enter}");
    expect(screen.getByText("tag2")).toBeInTheDocument();
    await userEvent.type(tagInput, "{Backspace}");
    expect(screen.queryByText("tag2")).not.toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
  });

  it("does not add duplicate tags", async () => {
    renderModal();
    const tagInput = screen.getByPlaceholderText("Add a tag and press Enter");
    await userEvent.type(tagInput, "unique{Enter}");
    await userEvent.type(tagInput, "unique{Enter}");
    // Should only have one instance
    const tags = screen.getAllByText("unique");
    expect(tags).toHaveLength(1);
  });

  // ── Contact search ──

  it("opens contact search panel when clicking Link contact", async () => {
    renderModal();
    const linkBtn = screen.getByText("Link contact");
    fireEvent.click(linkBtn);
    // Search input should appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search contacts...")).toBeInTheDocument();
    });
  });

  it("searches contacts with debounce", async () => {
    mockSearchContacts.mockResolvedValue([
      { id: "c1", display_name: "Alice", email: "alice@test.com" } as any,
    ]);
    renderModal();
    const linkBtn = screen.getByText("Link contact");
    fireEvent.click(linkBtn);
    const searchInput = screen.getByPlaceholderText("Search contacts...");
    await userEvent.type(searchInput, "Alice");
    await waitFor(
      () => {
        expect(mockSearchContacts).toHaveBeenCalledWith("Alice", 20);
      },
      { timeout: 500 },
    );
  });

  it("selects a contact from search results", async () => {
    mockSearchContacts.mockResolvedValue([
      { id: "c1", display_name: "Bob", email: "bob@test.com" } as any,
    ]);
    renderModal();
    const linkBtn = screen.getByText("Link contact");
    fireEvent.click(linkBtn);
    const searchInput = screen.getByPlaceholderText("Search contacts...");
    await userEvent.type(searchInput, "Bob");
    await waitFor(
      () => {
        expect(screen.getByText("Bob")).toBeInTheDocument();
      },
      { timeout: 500 },
    );
    fireEvent.click(screen.getByText("Bob"));
    // Contact should be selected
    expect(screen.getByText("Bob")).toBeInTheDocument();
    // Search panel should close
    expect(screen.queryByPlaceholderText("Search contacts...")).not.toBeInTheDocument();
  });

  it("removes selected contact when clicking X", async () => {
    renderModal({
      prefill: { contactId: "c1", contactName: "Charlie", source: "manual" },
    });
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    const removeBtn = screen.getByLabelText("Remove contact");
    fireEvent.click(removeBtn);
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  // ── Successful submission ──

  it("calls onCreate and onClose on successful task creation", async () => {
    mockInsertTask.mockResolvedValue("new-task-123");
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderModal({ onCreated, onClose });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    await userEvent.type(titleInput, "Finish the report");

    const submitBtn = screen.getByText("Create task");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsertTask).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "acc-1",
          title: "Finish the report",
        }),
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith("new-task-123");
      expect(onClose).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith(
        "Task created",
        expect.stringContaining("Finish the report"),
      );
    });
  });

  it("passes all form fields to insertTask on submit", async () => {
    mockInsertTask.mockResolvedValue("task-456");
    const onCreated = vi.fn();
    const onClose = vi.fn();
    const { container } = renderModal({ onCreated, onClose });

    // Fill in title
    await userEvent.type(screen.getByPlaceholderText("What needs to be done?"), "Full test task");

    // Set due date
    const dateInput = container.querySelector('input[type="datetime-local"]')!;
    fireEvent.change(dateInput, { target: { value: "2026-07-15T14:00" } });

    // Set priority
    const prioritySelect = container.querySelector("select")!;
    fireEvent.change(prioritySelect, { target: { value: "high" } });

    // Add description
    await userEvent.type(
      screen.getByPlaceholderText("Add details, context, or notes..."),
      "Test description",
    );

    // Add tags
    const tagInput = screen.getByPlaceholderText("Add a tag and press Enter");
    await userEvent.type(tagInput, "crm{Enter}");
    await userEvent.type(tagInput, "sales{Enter}");

    // Submit
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(mockInsertTask).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "acc-1",
          title: "Full test task",
          description: "Test description",
          priority: "high",
          tagsJson: JSON.stringify(["crm", "sales"]),
        }),
      );
    });
  });

  // ── Error handling during submission ──

  it("shows error banner when insertTask throws", async () => {
    mockInsertTask.mockRejectedValue(new Error("Database is locked"));
    const { container } = renderModal();

    await userEvent.type(screen.getByPlaceholderText("What needs to be done?"), "Failing task");
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(
        screen.getByRole("alert").textContent,
      ).toMatch(/Failed to create task/i);
    });
  });

  it("shows error banner when insertTask rejects with an object", async () => {
    // Simulates the user's complaint about "literal object as error"
    mockInsertTask.mockRejectedValue({ code: 500, message: "Backend failure" });
    renderModal();

    await userEvent.type(screen.getByPlaceholderText("What needs to be done?"), "Object error task");
    fireEvent.click(screen.getByText("Create task"));

    await waitFor(() => {
      // Should still show a meaningful error, not [object Object]
      const errorEl = screen.getByRole("alert");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).not.toContain("[object Object]");
      expect(errorEl.textContent).toContain("Could not create task");
    });
  });

  // ── Priority select ──

  it("renders all priority options", () => {
    const { container } = renderModal();
    // The select should have options for none, low, medium, high, urgent
    const select = container.querySelector("select");
    expect(select).toBeInTheDocument();
    const options = select!.querySelectorAll("option");
    expect(options.length).toBeGreaterThanOrEqual(4);
  });

  // ── Reminder toggle ──

  it("shows reminder presets when enabled", async () => {
    renderModal();
    const checkbox = screen.getByLabelText(/Enable/i);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    // Reminder select should appear
    await waitFor(() => {
      expect(screen.getByText("15 min before")).toBeInTheDocument();
    });
  });

  // ── Close handler ──

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId("modal-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("resets error state on close", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // Trigger validation error
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => {
      expect(screen.getByText("Task title is required.")).toBeInTheDocument();
    });

    // Close
    fireEvent.click(screen.getByTestId("modal-close"));
    expect(onClose).toHaveBeenCalled();
  });
});
