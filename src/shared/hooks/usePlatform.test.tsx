import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { usePlatform, __resetPlatformCache, type FullPlatformInfo } from "./usePlatform";

// usePlatform routes its IPC through the app's typed command wrapper, not
// @tauri-apps/api/core directly. Mock the real module it imports.
vi.mock("@shared/services/db/invoke/command", () => ({
  invokeCommand: vi.fn(),
}));

import { invokeCommand } from "@shared/services/db/invoke/command";

// Tests below reference `invoke` for ergonomics; alias it to the real wrapper.
const invoke = invokeCommand;

// ── Helpers ───────────────────────────────────────────────────────────

/** Default screen info in jsdom (1024×768, no foldable). */
const DEFAULT_SCREEN = {
  isMobile: false,
  isDesktop: true,
  category: "desktop" as const,
  aspect: "landscape" as const,
  width: 1024,
  height: 768,
  isFoldable: false,
  hingeOffset: 0,
  visualHeight: 768,
  keyboardOpen: false,
};

function TestComponent() {
  const platform = usePlatform();
  return <div data-testid="platform">{JSON.stringify(platform)}</div>;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("usePlatform", () => {
  beforeEach(() => {
    __resetPlatformCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    __resetPlatformCache();
    vi.restoreAllMocks();
  });

  it("1: Default fallback on initial render (invoke returns undefined)", () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<TestComponent />);

    // When invoke returns undefined, the catch handler sets WEB_FALLBACK
    expect(screen.getByTestId("platform").textContent).toBe(
      JSON.stringify({
        mobile: false, desktop: true, os: "web", arch: "web",
        is_tablet: false, is_phone: false,
        screen: DEFAULT_SCREEN,
      })
    );
  });

  it("2: Successful Tauri invoke sets platform state", async () => {
    const platformData = {
      mobile: true, desktop: false, os: "android", arch: "arm64",
      is_tablet: false, is_phone: true,
    };
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(platformData);

    render(<TestComponent />);

    // Wait for the async invoke to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId("platform").textContent).toBe(
      JSON.stringify({ ...platformData, screen: DEFAULT_SCREEN })
    );
  });

  it("3: Invoke failure falls back to web defaults", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Tauri error"));

    render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId("platform").textContent).toBe(
      JSON.stringify({
        mobile: false, desktop: true, os: "web", arch: "web",
        is_tablet: false, is_phone: false,
        screen: DEFAULT_SCREEN,
      })
    );
  });

  it("4: Caching prevents redundant invocations", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      mobile: true, desktop: false, os: "android", arch: "arm64",
      is_tablet: false, is_phone: true,
    });

    const { unmount } = render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    unmount();

    const invokeCount = (invoke as ReturnType<typeof vi.fn>).mock.calls.length;

    render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect((invoke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(invokeCount);
  });

  it("5: Invoke rejection falls back to web defaults", async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Tauri error"));

    render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId("platform").textContent).toBe(
      JSON.stringify({
        mobile: false, desktop: true, os: "web", arch: "web",
        is_tablet: false, is_phone: false,
        screen: DEFAULT_SCREEN,
      })
    );
  });

  it("6: Module-level cache persists across renders", async () => {
    const platformData = {
      mobile: true, desktop: false, os: "android", arch: "arm64",
      is_tablet: false, is_phone: true,
    };
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(platformData);

    const { unmount } = render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const firstRenderData = screen.getByTestId("platform").textContent;
    expect(firstRenderData).toBe(
      JSON.stringify({ ...platformData, screen: DEFAULT_SCREEN })
    );

    unmount();

    (invoke as ReturnType<typeof vi.fn>).mockClear();

    render(<TestComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Second mount should use cached platform (no extra invoke call)
    expect(screen.getByTestId("platform").textContent).toBe(
      JSON.stringify({ ...platformData, screen: DEFAULT_SCREEN })
    );
    expect((invoke as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
