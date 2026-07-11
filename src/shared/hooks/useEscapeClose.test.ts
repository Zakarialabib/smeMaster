import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEscapeClose } from "./useEscapeClose";

describe("useEscapeClose", () => {
  it("attaches a keydown listener when isOpen is true", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(true, onClose));
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    window.dispatchEvent(event);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for other keys", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(true, onClose));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not attach listener when isOpen is false", () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeClose(false, onClose));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeClose(true, onClose));
    unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("updates the listener when onClose changes", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    const { rerender } = renderHook(({ cb }: { cb: () => void }) => useEscapeClose(true, cb), {
      initialProps: { cb: onClose1 },
    });
    rerender({ cb: onClose2 });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalledTimes(1);
  });
});
