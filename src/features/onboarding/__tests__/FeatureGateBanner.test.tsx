import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeatureGateBanner } from "../components/FeatureGateBanner";

// Mock AddAccount
vi.mock("@features/accounts/components/AddAccount", () => ({
  AddAccount: ({ onSuccess }: { onSuccess: () => void }) => (
    <div data-testid="add-account">
      <button onClick={onSuccess} data-testid="mock-add-success">
        Mock Add Account
      </button>
    </div>
  ),
}));

// Mock Button
vi.mock("@shared/components/ui/Button", () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button onClick={onClick} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Mail: () => <div data-testid="mail-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

describe("FeatureGateBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders with feature name", () => {
    render(<FeatureGateBanner featureName="Campaigns" />);
    // Text is split across elements: "Connect your email to use " <span>Campaigns</span> " features"
    expect(screen.getByText((content) => content.includes("Connect your email to use") && content.includes("features"))).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
  });

  it("renders Connect Email button", () => {
    render(<FeatureGateBanner featureName="Mail" />);
    expect(screen.getByText("Connect Email")).toBeInTheDocument();
  });

  it("renders dismiss button", () => {
    render(<FeatureGateBanner featureName="Mail" />);
    expect(screen.getByLabelText("Dismiss banner")).toBeInTheDocument();
  });

  it("opens AddAccount modal when Connect Email is clicked", () => {
    render(<FeatureGateBanner featureName="Campaigns" />);
    fireEvent.click(screen.getByText("Connect Email"));
    expect(screen.getByTestId("add-account")).toBeInTheDocument();
  });

  it("dismisses banner when X is clicked", () => {
    render(<FeatureGateBanner featureName="Campaigns" />);
    fireEvent.click(screen.getByLabelText("Dismiss banner"));
    // After dismiss, the entire banner returns null
    expect(screen.queryByText("Campaigns")).not.toBeInTheDocument();
  });

  it("persists dismissal in sessionStorage", () => {
    const { unmount } = render(<FeatureGateBanner featureName="Campaigns" />);
    fireEvent.click(screen.getByLabelText("Dismiss banner"));
    unmount();
    render(<FeatureGateBanner featureName="Campaigns" />);
    expect(screen.queryByText("Campaigns")).not.toBeInTheDocument();
  });

  it("uses custom storageKey when provided", () => {
    const { unmount } = render(<FeatureGateBanner featureName="Custom" storageKey="my-custom-key" />);
    fireEvent.click(screen.getByLabelText("Dismiss banner"));
    unmount();
    sessionStorage.setItem("smemaster.feature-banner.dismissed.my-custom-key", "true");
    render(<FeatureGateBanner featureName="Custom" storageKey="my-custom-key" />);
    expect(screen.queryByText("Custom")).not.toBeInTheDocument();
  });

  it("closes modal when account is added", () => {
    render(<FeatureGateBanner featureName="Campaigns" />);
    fireEvent.click(screen.getByText("Connect Email"));
    expect(screen.getByTestId("add-account")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mock-add-success"));
    expect(screen.queryByTestId("add-account")).not.toBeInTheDocument();
  });

  it("returns null when dismissed via sessionStorage on mount", () => {
    sessionStorage.setItem("smemaster.feature-banner.dismissed.campaigns", "true");
    const { container } = render(<FeatureGateBanner featureName="Campaigns" />);
    expect(container.innerHTML).toBe("");
  });
});
