import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const dashboardState = {
  widgets: [
    { id: "contacts", title: "Contacts Stats", visible: true, order: 0 },
    { id: "tasks", title: "Task Summary", visible: true, order: 1 },
  ],
  loaded: true,
  loadPreferences: vi.fn(),
  toggleWidget: vi.fn(),
  reorderWidgets: vi.fn(),
};

vi.mock("@features/dashboard/stores/dashboardStore", () => ({
  useDashboardStore: (sel?: (s: unknown) => unknown) => (sel ? sel(dashboardState) : dashboardState),
}));

vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: (sel: (s: { activeAccountId: string }) => unknown) =>
    sel({ activeAccountId: "acc1" }),
}));

vi.mock("@shared/services/db/db-invoke", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/services/db/db-invoke")>();
  return {
    ...actual,
    dashboardContactsTotal: vi.fn().mockResolvedValue(0),
    dashboardContactsActive: vi.fn().mockResolvedValue(0),
    dashboardContactsNewWeek: vi.fn().mockResolvedValue(0),
    dashboardTasksIncomplete: vi.fn().mockResolvedValue(0),
    dashboardTasksOverdue: vi.fn().mockResolvedValue(0),
    dashboardTasksDueToday: vi.fn().mockResolvedValue(0),
    dashboardRecentActivity: vi.fn().mockResolvedValue([]),
    dashboardCampaignsTotal: vi.fn().mockResolvedValue(0),
    dashboardCampaignsSent: vi.fn().mockResolvedValue(0),
    dashboardCampaignsOpenRate: vi.fn().mockResolvedValue(0),
    dashboardCampaignsClickRate: vi.fn().mockResolvedValue(0),
    dashboardWorkflowRulesTotal: vi.fn().mockResolvedValue(0),
    dashboardWorkflowRulesActive: vi.fn().mockResolvedValue(0),
    listContactLabels: vi.fn().mockResolvedValue([]),
    listContactGroups: vi.fn().mockResolvedValue([]),
    listSegments: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@shared/hooks/useMobile", () => ({ useMobile: () => false }));
vi.mock("@shared/services/events/eventBus", () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
    register: vi.fn(() => vi.fn()),
    onMany: vi.fn(() => vi.fn()),
    init: vi.fn(),
    destroy: vi.fn(),
  },
}));
vi.mock("@/router/navigate", () => ({ navigateToLabel: vi.fn() }));
vi.mock("@shared/components/ui/EmptyState", () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));
vi.mock("@shared/components/ui/Modal", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@shared/components/ui/Button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));
vi.mock("@shared/components/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { DashboardPage } from "./DashboardPage";

describe("DashboardPage — a11y: aria-busy + aria-live", () => {
  it("marks the widgets region as not busy when loaded", () => {
    render(<DashboardPage />);
    const region = screen.getByLabelText("Dashboard widgets");
    expect(region).toHaveAttribute("aria-busy", "false");
    expect(region).toHaveAttribute("aria-live", "polite");
  });
});
