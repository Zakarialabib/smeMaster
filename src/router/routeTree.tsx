import { lazy, Suspense, type ReactNode } from "react";
import { createRootRoute, createRoute, redirect } from "@tanstack/react-router";
import App from "@/App";
import { ErrorBoundary } from "@shared/components/ui/ErrorBoundary";
import { SkeletonPage } from "@shared/components/ui/Skeleton";

// Lazy-load heavy pages — these include many sub-components and service imports
const SettingsPage = lazy(() =>
  import("@features/settings/components/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);

const HelpPage = lazy(() =>
  import("@features/settings/components/help/HelpPage").then((m) => ({
    default: m.HelpPage,
  })),
);
const CalendarPage = lazy(() =>
  import("@features/calendar/components/CalendarPage").then((m) => ({
    default: m.CalendarPage,
  })),
);
const TasksPage = lazy(() =>
  import("@features/tasks/components/TasksPage").then((m) => ({
    default: m.TasksPage,
  })),
);
const AttachmentLibrary = lazy(() =>
  import("@features/mail/components/attachments/AttachmentLibrary").then(
    (m) => ({ default: m.AttachmentLibrary }),
  ),
);
const AutomationCampaignsPage = lazy(() =>
  import("@features/automation/pages/AutomationCampaignsPage").then((m) => ({
    default: m.AutomationCampaignsPage,
  })),
);
const VaultPage = lazy(() =>
  import("@features/vault/pages/VaultPage").then((m) => ({
    default: m.VaultPage,
  })),
);

const InvoicingDashboard = lazy(() =>
  import("@features/invoicing/components/InvoicingDashboard").then((m) => ({
    default: m.default,
  })),
);

const InvoiceEditor = lazy(() =>
  import("@features/invoicing/components/InvoiceEditor").then((m) => ({
    default: m.default,
  })),
);
const DevicePairingPage = lazy(() =>
  import("@features/settings/pages/DevicePairingPage").then((m) => ({
    default: m.DevicePairingPage,
  })),
);
const ContactDetailPage = lazy(() =>
  import("@features/contacts/pages/ContactDetailPage").then((m) => ({
    default: m.ContactDetailPage,
  })),
);
const DashboardPage = lazy(() =>
  import("@features/dashboard/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const AiAssistantPage = lazy(() =>
  import("@features/assistant/pages/AiAssistantPage").then((m) => ({
    default: m.AiAssistantPage,
  })),
);
const MobileDashboardPage = lazy(() =>
  import("@features/dashboard/pages/MobileDashboardPage").then((m) => ({
    default: m.MobileDashboardPage,
  })),
);
const MergedCRMPage = lazy(() =>
  import("@features/crm/pages/MergedCRMPage").then((m) => ({
    default: m.MergedCRMPage,
  })),
);

const POSPage = lazy(() =>
  import("@features/pos/components/POSPage").then((m) => ({
    default: m.POSPage,
  })),
);

const ErpPage = lazy(() =>
  import("@features/erp/ErpPage").then((m) => ({
    default: m.default,
  })),
);

// ── Generic page wrapper helper ──────────────────────────────────────────
// All pages go through DesktopShell (which owns PremiumSidebar + icon rail),
// so AppPageWrapper is never needed — it would create double-sidebar chrome.
type LazyComponent = React.LazyExoticComponent<() => ReactNode>;

function createPageWrapper(name: string, Component: LazyComponent) {
  const Wrapper = () => (
    <ErrorBoundary name={name}>
      <Suspense fallback={<SkeletonPage />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
  Wrapper.displayName = `${name}PageWrapper`;
  return Wrapper;
}

// ---------- Search param validation ----------
const VALID_CATEGORIES = [
  "Primary",
  "Updates",
  "Promotions",
  "Social",
  "Newsletters",
] as const;

type MailSearch = {
  q?: string;
  category?: (typeof VALID_CATEGORIES)[number];
};

function validateMailSearch(search: Record<string, unknown>): MailSearch {
  const result: MailSearch = {};
  if (typeof search["q"] === "string" && search["q"]) {
    result.q = search["q"];
  }
  const cat = search["category"];
  if (
    typeof cat === "string" &&
    (VALID_CATEGORIES as readonly string[]).includes(cat)
  ) {
    result.category = cat as MailSearch["category"];
  }
  return result;
}

// ---------- Root (shell: TitleBar, Sidebar, overlays) ----------
export const rootRoute = createRootRoute({
  component: App,
});

// ---------- / (index) â†’ redirect to /mail/inbox ----------
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/mail/$label", params: { label: "inbox" } });
  },
});

// ---------- Mail routes: render MailLayout for all mail views ----------
function MailPage() {
  const MailLayout = lazy(() =>
    import("@features/mail/components/layout/MailLayout").then((m) => ({
      default: m.MailLayout,
    })),
  );
  return (
    <ErrorBoundary name="MailLayout">
      <Suspense fallback={<SkeletonPage />}>
        <MailLayout />
      </Suspense>
    </ErrorBoundary>
  );
}

function SettingsTabPage() {
  return (
    <ErrorBoundary name="SettingsPage">
      <Suspense fallback={<SkeletonPage />}>
        <SettingsPage />
      </Suspense>
    </ErrorBoundary>
  );
}

// ---------- /settings (redirect to /settings/general) ----------
const settingsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  beforeLoad: () => {
    throw redirect({ to: "/settings/$tab", params: { tab: "general" } });
  },
});

// ---------- /settings/$tab ----------
export const settingsTabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings/$tab",
  component: SettingsTabPage,
});

// ---------- Standalone page wrappers — all use createPageWrapper for consistency ----------
const HelpPageWrapper = createPageWrapper("Help", HelpPage as LazyComponent);

// ---------- /mail/$label ----------
export const mailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "mail/$label",
  validateSearch: validateMailSearch,
  component: MailPage,
});

// ---------- /mail/$label/thread/$threadId ----------
export const mailThreadRoute = createRoute({
  getParentRoute: () => mailRoute,
  path: "thread/$threadId",
  component: () => null, // MailLayout handles rendering via useSelectedThreadId()
});

// ---------- /label/$labelId ----------
export const labelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "label/$labelId",
  validateSearch: validateMailSearch,
  component: MailPage,
});

// ---------- /label/$labelId/thread/$threadId ----------
export const labelThreadRoute = createRoute({
  getParentRoute: () => labelRoute,
  path: "thread/$threadId",
});

// ---------- /smart-folder/$folderId ----------
export const smartFolderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "smart-folder/$folderId",
  validateSearch: validateMailSearch,
  component: MailPage,
});

// ---------- /smart-folder/$folderId/thread/$threadId ----------
export const smartFolderThreadRoute = createRoute({
  getParentRoute: () => smartFolderRoute,
  path: "thread/$threadId",
});

// ---------- /people (merged CRM with Contacts, Campaigns, Tasks, Calendar, Invoices) ----------
const ContactDetailPageWrapper = createPageWrapper("ContactDetail", ContactDetailPage as LazyComponent);

export const contactDetailRoute = createRoute({
  getParentRoute: () => peopleRoute,
  path: "$contactId",
  component: ContactDetailPageWrapper,
});

// ---------- /attachments ----------
const AttachmentLibraryWrapper = createPageWrapper("Attachments", AttachmentLibrary as LazyComponent);

export const attachmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "attachments",
  component: AttachmentLibraryWrapper,
});

// ---------- /tasks ----------
const TasksPageWrapper = createPageWrapper("Tasks", TasksPage as LazyComponent);

export const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "tasks",
  component: TasksPageWrapper,
});

// ---------- /calendar ----------
const CalendarPageWrapper = createPageWrapper("Calendar", CalendarPage as LazyComponent);

export const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "calendar",
  component: CalendarPageWrapper,
});

// ---------- /automation ----------
const AutomationPageWrapper = createPageWrapper("Automation & Campaigns", AutomationCampaignsPage as LazyComponent);

export const automationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "automation",
  component: AutomationPageWrapper,
});

// ---------- /business (legacy) → redirect to the real dashboard ----------
export const businessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "business",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});

const InvoicingDashboardWrapper = createPageWrapper("Invoicing", InvoicingDashboard as LazyComponent);

export const invoicingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "invoicing",
  component: InvoicingDashboardWrapper,
});

const InvoiceEditorWrapper = createPageWrapper("InvoiceEditor", InvoiceEditor as LazyComponent);

export const invoiceEditorRoute = createRoute({
  getParentRoute: () => invoicingRoute,
  path: "edit/$invoiceId",
  component: InvoiceEditorWrapper,
});

export const invoiceCreateRoute = createRoute({
  getParentRoute: () => invoicingRoute,
  path: "new",
  component: InvoiceEditorWrapper,
});

const ErpPageWrapper = createPageWrapper("Erp", ErpPage as LazyComponent);

export const erpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "erp",
  component: ErpPageWrapper,
});

// ---------- /vault ----------
const VaultPageWrapper = createPageWrapper("Vault", VaultPage as LazyComponent);

export const vaultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "vault",
  component: VaultPageWrapper,
});

// ---------- /campaigns (legacy) → redirect to the merged automation page ----------
export const campaignsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "campaigns",
  beforeLoad: () => {
    throw redirect({ to: "/automation" });
  },
});

// ---------- /workflows (redirect to /automation) ----------
export const workflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "workflows",
  beforeLoad: () => {
    throw redirect({ to: "/automation" });
  },
});

const AiAssistantPageWrapper = createPageWrapper("AiAssistant", AiAssistantPage as LazyComponent);

// ---------- /ai-assistant ----------
export const aiAssistantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "ai-assistant",
  component: AiAssistantPageWrapper,
});

// ---------- /dashboard ----------
const DashboardPageWrapper = createPageWrapper("Dashboard", DashboardPage as LazyComponent);

// ---------- /settings/device-pairing ----------
const DevicePairingPageWrapper = createPageWrapper("DevicePairing", DevicePairingPage as LazyComponent);

export const devicePairingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings/device-pairing",
  component: DevicePairingPageWrapper,
});

// ---------- /people (merged CRM with Contacts, Campaigns, Tasks, Calendar, Invoices) ----------
const CRMPageWrapper = createPageWrapper("CRM", MergedCRMPage as LazyComponent);

export const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "people",
  component: CRMPageWrapper,
});

// ---------- /crm (alias redirects to /people) ----------
export const crmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "crm",
  beforeLoad: () => {
    throw redirect({ to: "/people" });
  },
});

// ---------- /dashboard (desktop) ----------
export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "dashboard",
  component: DashboardPageWrapper,
});

// ---------- /dashboard/mobile ----------
const MobileDashboardWrapper = createPageWrapper("MobileDashboard", MobileDashboardPage as LazyComponent);

export const mobileDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "dashboard/mobile",
  component: MobileDashboardWrapper,
});

// ---------- /pos ----------
const POSPageWrapper = createPageWrapper("POS", POSPage as LazyComponent);

export const posRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pos",
  component: POSPageWrapper,
});

// ---------- /help (redirect to /help/getting-started) ----------
const helpIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "help",
  beforeLoad: () => {
    throw redirect({
      to: "/help/$topic",
      params: { topic: "getting-started" },
    });
  },
});

// ---------- /help/$topic ----------
export const helpTopicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "help/$topic",
  component: HelpPageWrapper,
});

// ---------- / (catch-all 404) ----------
export const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: () => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold text-text-primary">Page Not Found</h1>
      <p className="text-text-secondary">The page you're looking for doesn't exist.</p>
      <a
        href="#/mail/inbox"
        className="text-accent hover:underline text-sm font-medium"
      >
        Back to Inbox
      </a>
    </div>
  ),
});

// ---------- Route tree ----------
export const routeTree = rootRoute.addChildren([
  indexRoute,
  mailRoute.addChildren([mailThreadRoute]),
  labelRoute.addChildren([labelThreadRoute]),
  smartFolderRoute.addChildren([smartFolderThreadRoute]),
  devicePairingRoute,
  settingsIndexRoute,
  settingsTabRoute,
  attachmentsRoute,
  tasksRoute,
  calendarRoute,
  peopleRoute.addChildren([contactDetailRoute]),
  automationRoute,
  vaultRoute,
  workflowsRoute,
  campaignsRoute,
  businessRoute,
  invoicingRoute.addChildren([invoiceEditorRoute, invoiceCreateRoute]),
  erpRoute,
  aiAssistantRoute,
  dashboardRoute,
  mobileDashboardRoute,
  crmRoute,
  posRoute,
  helpIndexRoute,
  helpTopicRoute,
  notFoundRoute,
]);
