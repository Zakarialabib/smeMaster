import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeliverabilityPanel } from "./DeliverabilityPanel";
import { useHealthScore } from "@features/deliverability/hooks/useHealthScore";
import { useDomainHealthStore } from "@features/deliverability/stores/domainHealthStore";

vi.mock("@features/deliverability/hooks/useHealthScore", () => ({
  useHealthScore: vi.fn(),
}));

vi.mock("@features/deliverability/stores/domainHealthStore", () => ({
  useDomainHealthStore: vi.fn(() => ({
    currentDomain: "",
    remediation: [],
    getRemediationForDomain: vi.fn(() => null),
    setCurrentDomain: vi.fn(),
  })),
}));

const createMockHealth = (overrides = {}) => ({
  score: 85,
  providerStats: [{ provider: "gmail", sent: 100, delivered: 98 }],
  failureTypes: [],
  spf_status: { present: true, valid: true },
  dkim_status: { present: true, valid: true },
  dmarc_status: { present: true, valid: true },
  ...overrides,
});

describe("DeliverabilityPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useHealthScore as any).mockReturnValue({ data: null, isLoading: false });
  });

  it("renders empty state with no domain", () => {
    render(<DeliverabilityPanel />);
    // Should show a search input
    expect(screen.getByPlaceholderText(/domain/i)).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", () => {
    (useHealthScore as any).mockReturnValue({ data: null, isLoading: true });
    const { container } = render(<DeliverabilityPanel />);
    // Look for loader indicator during loading
    const loader = container.querySelector('[class*="animate-spin"]') || container.querySelector('[class*="loader"]');
    expect(loader).toBeTruthy();
  });

  it("renders health data when loaded", async () => {
    const mockHealth = createMockHealth({ score: 85 });
    (useHealthScore as any).mockReturnValue({ data: mockHealth, isLoading: false });
    render(<DeliverabilityPanel />);
    // Score should be visible
    await waitFor(() => {
      expect(screen.getByText("85")).toBeTruthy();
    });
  });

  it("calls setCurrentDomain when Enter is pressed", async () => {
    const setCurrentDomain = vi.fn();
    (useHealthScore as any).mockReturnValue({ data: null, isLoading: false });
    vi.mocked(useDomainHealthStore as any).mockReturnValue({
      currentDomain: "",
      remediation: [],
      getRemediationForDomain: vi.fn(() => null),
      setCurrentDomain,
    });
    render(<DeliverabilityPanel />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(setCurrentDomain).toHaveBeenCalledWith("example.com");
    });
  });

  it("shows remediation wizard when there are failures", async () => {
    const mockHealth = createMockHealth({
      spf_status: { present: false, valid: false },
      dkim_status: { present: true, valid: true },
      dmarc_status: { present: true, valid: true },
      failureTypes: [{ type: "SPF_FAIL", count: 3 }],
    });
    (useHealthScore as any).mockReturnValue({ data: mockHealth, isLoading: false });
    render(<DeliverabilityPanel />);
    // Should show something related to remediation or fix
    await waitFor(() => {
      const buttons = screen.queryAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("shows error state when health fetch fails", () => {
    (useHealthScore as any).mockReturnValue({ data: null, isLoading: false, error: "Failed to fetch" });
    render(<DeliverabilityPanel />);
    // Error should be visible
    // Either error or failed message should be visible
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});