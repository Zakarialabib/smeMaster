export interface LayoutProps {
  children?: React.ReactNode;
  className?: string;
}

export interface SidebarContentLayoutProps extends LayoutProps {
  /** Header content rendered at the top */
  header?: React.ReactNode;
  /** Sidebar content rendered alongside the main content */
  sidebar?: React.ReactNode;
  /** Main content area content */
  content?: React.ReactNode;
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Custom sidebar width (default: 240px) */
  sidebarWidth?: string | number;
  /** Custom header height (default: 56px) */
  headerHeight?: string | number;
}

export interface SinglePageLayoutProps extends LayoutProps {
  /** Maximum width for content (default: 2xl) */
  maxWidth?: string;
  /** Whether to center content vertically */
  centerVertically?: boolean;
  /** Padding for content area */
  p?: string | number;
  /** Padding for content area on x-axis */
  px?: string | number;
  /** Padding for content area on y-axis */
  py?: string | number;
}

export interface TabbedSettingsLayoutProps extends LayoutProps {
  /** Array of tab definitions */
  tabs: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    disabled?: boolean;
  }>;
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** Whether tabs are vertical (default: true) */
  vertical?: boolean;
  /** Tab navigation width (default: 60px for vertical, auto for horizontal) */
  tabNavWidth?: string | number;
  /** Tab navigation height (default: auto) */
  tabNavHeight?: string | number;
}

export interface WizardLayoutProps extends LayoutProps {
  /** Current step index (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Labels for each step */
  stepLabels: string[];
  /** Whether to show step numbers */
  showStepNumbers?: boolean;
  /** Whether to show progress bar */
  showProgressBar?: boolean;
  /** Callback for back button */
  onBack?: () => void;
  /** Callback for next button */
  onNext?: () => void;
  /** Callback for skip button */
  onSkip?: () => void;
  /** Whether to show skip button */
  showSkip?: boolean;
  /** Label for back button */
  backLabel?: string;
  /** Label for next button */
  nextLabel?: string;
  /** Label for skip button */
  skipLabel?: string;
}
