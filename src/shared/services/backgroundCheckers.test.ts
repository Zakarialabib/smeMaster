import { createBackgroundChecker } from "./backgroundCheckers";

describe("createBackgroundChecker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should run the check function immediately on start", () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const checker = createBackgroundChecker("Test", checkFn);

    checker.start();

    expect(checkFn).toHaveBeenCalledTimes(1);

    checker.stop();
  });

  it("should run the check function on each interval tick", async () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const checker = createBackgroundChecker("Test", checkFn, 1000);

    checker.start();
    expect(checkFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(checkFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(checkFn).toHaveBeenCalledTimes(3);

    checker.stop();
  });

  it("should not start a second interval if already running", () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const checker = createBackgroundChecker("Test", checkFn);

    checker.start();
    checker.start();

    expect(checkFn).toHaveBeenCalledTimes(1);

    checker.stop();
  });

  it("should stop the interval when stop is called", async () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const checker = createBackgroundChecker("Test", checkFn, 1000);

    checker.start();
    expect(checkFn).toHaveBeenCalledTimes(1);

    checker.stop();

    await vi.advanceTimersByTimeAsync(3000);
    expect(checkFn).toHaveBeenCalledTimes(1);
  });

  it("should catch and log errors without stopping the interval", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("check failed");
    const checkFn = vi.fn().mockRejectedValue(error);
    const checker = createBackgroundChecker("TestChecker", checkFn, 1000);

    checker.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(consoleSpy).toHaveBeenCalledWith("[TestChecker] check failed:", error);

    await vi.advanceTimersByTimeAsync(1000);
    expect(checkFn).toHaveBeenCalledTimes(2);

    checker.stop();
    consoleSpy.mockRestore();
  });

  it("should use 60s default interval", async () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const checker = createBackgroundChecker("Test", checkFn);

    checker.start();
    expect(checkFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(checkFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(checkFn).toHaveBeenCalledTimes(2);

    checker.stop();
  });

  it("should allow restart after stop", async () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const checker = createBackgroundChecker("Test", checkFn, 1000);

    checker.start();
    expect(checkFn).toHaveBeenCalledTimes(1);

    checker.stop();

    checker.start();
    expect(checkFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(checkFn).toHaveBeenCalledTimes(3);

    checker.stop();
  });

  it("should be safe to call stop when not running", () => {
    const checkFn = vi.fn().mockResolvedValue(undefined);
    const checker = createBackgroundChecker("Test", checkFn);

    expect(() => checker.stop()).not.toThrow();
  });
});
