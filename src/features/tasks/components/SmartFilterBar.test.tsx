import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SmartFilterBar } from "./SmartFilterBar";

describe("SmartFilterBar", () => {
  const defaultProps = {
    filterStatus: "incomplete" as const,
    onFilterStatusChange: vi.fn(),
    filterPriority: "all" as const,
    onFilterPriorityChange: vi.fn(),
    groupBy: "none" as const,
    onGroupByChange: vi.fn(),
    sortBy: "dueDate" as const,
    onSortChange: vi.fn(),
    dateFilter: "all" as const,
    onDateFilterChange: vi.fn(),
  };

  it("renders status options and calls onFilterStatusChange", () => {
    render(<SmartFilterBar {...defaultProps} />);
    const activeBtn = screen.getByText("Active");
    const doneBtn = screen.getByText("Done");

    expect(activeBtn).toBeInTheDocument();
    expect(doneBtn).toBeInTheDocument();

    fireEvent.click(doneBtn);
    expect(defaultProps.onFilterStatusChange).toHaveBeenCalledWith("completed");
  });

  it("renders priority dropdown and selects an option", () => {
    render(<SmartFilterBar {...defaultProps} />);
    const priorityBtn = screen.getByLabelText("Select priority filter");

    fireEvent.click(priorityBtn);

    const highOption = screen.getByText("High");
    fireEvent.click(highOption);

    expect(defaultProps.onFilterPriorityChange).toHaveBeenCalledWith("high");
  });

  it("renders group by dropdown and selects an option", () => {
    render(<SmartFilterBar {...defaultProps} />);
    const groupByBtn = screen.getByLabelText("Select group by option");

    fireEvent.click(groupByBtn);

    const groupPriorityOption = screen.getByText("Group by priority");
    fireEvent.click(groupPriorityOption);

    expect(defaultProps.onGroupByChange).toHaveBeenCalledWith("priority");
  });

  it("renders sort dropdown and selects an option", () => {
    render(<SmartFilterBar {...defaultProps} />);
    const sortBtn = screen.getByLabelText("Select sort option");

    fireEvent.click(sortBtn);

    const alphabeticalOption = screen.getByText("Alphabetical");
    fireEvent.click(alphabeticalOption);

    expect(defaultProps.onSortChange).toHaveBeenCalledWith("alphabetical");
  });

  it("renders date filter chips and calls onDateFilterChange", () => {
    render(<SmartFilterBar {...defaultProps} />);
    const todayChip = screen.getByText("Today");

    fireEvent.click(todayChip);
    expect(defaultProps.onDateFilterChange).toHaveBeenCalledWith("today");
  });
});
