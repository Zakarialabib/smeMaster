import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskViewPrefs } from "./useTaskViewPrefs";

// Mock zustand persist middleware
vi.mock("zustand/middleware", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    persist: vi.fn((configFn: any) => configFn),
  };
});

describe("useTaskViewPrefs", () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    const store = useTaskViewPrefs.getState();
    store.reset();
  });

  it("returns default preferences on initial load", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    expect(result.current.viewMode).toBe("list");
    expect(result.current.density).toBe("normal");
    expect(result.current.groupBy).toBe("none");
    expect(result.current.sortField).toBe("priority");
    expect(result.current.sortDirection).toBe("asc");
    expect(result.current.filterStatus).toBe("incomplete");
    expect(result.current.filterPriority).toBe("all");
    expect(result.current.dateFilter).toBe("all");
  });

  it("setViewMode updates viewMode", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    act(() => {
      result.current.setViewMode("kanban");
    });

    expect(result.current.viewMode).toBe("kanban");
  });

  it("setDensity updates density", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    act(() => {
      result.current.setDensity("compact");
    });

    expect(result.current.density).toBe("compact");
  });

  it("setGroupBy updates groupBy", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    act(() => {
      result.current.setGroupBy("priority");
    });

    expect(result.current.groupBy).toBe("priority");
  });

  it("setSort updates sortField and sortDirection", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    act(() => {
      result.current.setSort("dueDate", "desc");
    });

    expect(result.current.sortField).toBe("dueDate");
    expect(result.current.sortDirection).toBe("desc");
  });

  it("setFilterStatus updates filterStatus", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    act(() => {
      result.current.setFilterStatus("completed");
    });

    expect(result.current.filterStatus).toBe("completed");
  });

  it("setFilterPriority updates filterPriority", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    act(() => {
      result.current.setFilterPriority("high");
    });

    expect(result.current.filterPriority).toBe("high");
  });

  it("setDateFilter updates dateFilter", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    act(() => {
      result.current.setDateFilter("today");
    });

    expect(result.current.dateFilter).toBe("today");
  });

  it("reset restores all preferences to defaults", () => {
    const { result } = renderHook(() => useTaskViewPrefs());

    // Set custom values
    act(() => {
      result.current.setViewMode("calendar");
      result.current.setDensity("compact");
      result.current.setGroupBy("dueDate");
      result.current.setSort("title", "desc");
      result.current.setFilterStatus("all");
      result.current.setFilterPriority("urgent");
      result.current.setDateFilter("overdue");
    });

    // Verify they're set
    expect(result.current.viewMode).toBe("calendar");
    expect(result.current.density).toBe("compact");
    expect(result.current.groupBy).toBe("dueDate");
    expect(result.current.sortField).toBe("title");
    expect(result.current.sortDirection).toBe("desc");
    expect(result.current.filterStatus).toBe("all");
    expect(result.current.filterPriority).toBe("urgent");
    expect(result.current.dateFilter).toBe("overdue");

    // Reset
    act(() => {
      result.current.reset();
    });

    // Verify defaults restored
    expect(result.current.viewMode).toBe("list");
    expect(result.current.density).toBe("normal");
    expect(result.current.groupBy).toBe("none");
    expect(result.current.sortField).toBe("priority");
    expect(result.current.sortDirection).toBe("asc");
    expect(result.current.filterStatus).toBe("incomplete");
    expect(result.current.filterPriority).toBe("all");
    expect(result.current.dateFilter).toBe("all");
  });
});