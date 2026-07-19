import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const baseState = {
  rules: [],
  isLoading: true,
  error: null,
  showEditor: false,
  deleteTargetId: null,
  deleting: false,
  loadRules: vi.fn(),
  toggleRule: vi.fn(),
  openEditor: vi.fn(),
  openEditorForEdit: vi.fn(),
  requestDelete: vi.fn(),
  cancelDelete: vi.fn(),
  confirmDelete: vi.fn(),
};

vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: (sel: (s: { activeAccountId: string }) => unknown) =>
    sel({ activeAccountId: "acc1" }),
}));

vi.mock("@features/automation/stores/automationStore", () => ({
  useAutomationStore: (sel: (s: typeof baseState) => unknown) => sel(baseState),
}));

vi.mock("@shared/hooks/useMobile", () => ({ useMobile: () => false }));
vi.mock("@shared/components/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@shared/components/ui/Button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock("@shared/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => <div data-testid="confirm-dialog" />,
}));
vi.mock("@features/workflows/components/WorkflowList", () => ({
  WorkflowList: () => <div data-testid="workflow-list" />,
}));
vi.mock("@features/workflows/components/WorkflowEditor", () => ({
  WorkflowEditor: () => <div data-testid="workflow-editor" />,
}));

import { WorkflowsPage } from "./WorkflowsPage";

describe("WorkflowsPage — a11y: aria-busy + aria-live", () => {
  it("marks the workflows list region as busy while loading with no workflows", () => {
    render(<WorkflowsPage />);
    const region = screen.getByLabelText("Workflows list");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});
