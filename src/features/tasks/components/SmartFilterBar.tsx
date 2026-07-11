import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ArrowUpDown, Sparkles, X } from "lucide-react";
import type { TaskPriority } from "@features/tasks/db/tasks";
import type { TaskGroupBy, TaskFilterStatus } from "@features/tasks/stores/taskStore";
import { FOCUS_RING } from "@shared/styles/ui-tokens";

/**
 * Priority dot colors matching TasksPage.tsx
 */
const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
  none: "bg-text-tertiary/30",
};

/**
 * Priority labels for display
 */
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

/**
 * Date filter options for quick filter chips
 */
type DateFilterValue = "all" | "today" | "thisWeek" | "overdue";

const DATE_FILTER_OPTIONS: { value: DateFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "thisWeek", label: "This Week" },
  { value: "overdue", label: "Overdue" },
];

/**
 * Sort options
 */
type SortOption = "dueDate" | "priority" | "created" | "alphabetical";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "dueDate", label: "Due Date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
  { value: "alphabetical", label: "Alphabetical" },
];

/**
 * Props for SmartFilterBar component
 */
export interface SmartFilterBarProps {
  /** Current status filter: 'incomplete' (Active), 'all', or 'completed' (Done) */
  filterStatus: TaskFilterStatus;
  /** Handler for status filter changes */
  onFilterStatusChange: (status: TaskFilterStatus) => void;
  /** Current priority filter */
  filterPriority: TaskPriority | "all";
  /** Handler for priority filter changes */
  onFilterPriorityChange: (priority: TaskPriority | "all") => void;
  /** Current group by setting */
  groupBy: TaskGroupBy;
  /** Handler for group by changes */
  onGroupByChange: (groupBy: TaskGroupBy) => void;
  /** Current sort option */
  sortBy?: SortOption;
  /** Handler for sort changes */
  onSortChange?: (sort: SortOption) => void;
  /** Current date quick filter */
  dateFilter?: DateFilterValue;
  /** Handler for date filter changes */
  onDateFilterChange?: (filter: DateFilterValue) => void;
  /** Whether to show AI suggestion banner */
  showAISuggestion?: boolean;
  /** AI suggestion text to display */
  aiSuggestionText?: string;
  /** Handler for AI suggestion action */
  onAISuggestionAction?: () => void;
}

/**
 * SmartFilterBar - A beautiful filter bar with segmented controls and dropdown chips.
 *
 * Features:
 * - StatusFilter: Segmented pill control (Active / All / Done)
 * - PriorityFilter: Dropdown chip with colored dots
 * - GroupBySelector: Dropdown chip
 * - Sort dropdown: Chip with arrow icon
 * - DateQuickFilter: Horizontal scrollable chip row (All / Today / This Week / Overdue)
 * - AI suggestion banner (conditional)
 */
export function SmartFilterBar({
  filterStatus,
  onFilterStatusChange,
  filterPriority,
  onFilterPriorityChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortChange,
  dateFilter = "all",
  onDateFilterChange,
  showAISuggestion = false,
  aiSuggestionText,
  onAISuggestionAction,
}: SmartFilterBarProps) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [groupByOpen, setGroupByOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const priorityRef = useRef<HTMLDivElement>(null);
  const groupByRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setPriorityOpen(false);
      }
      if (groupByRef.current && !groupByRef.current.contains(e.target as Node)) {
        setGroupByOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPriorityOpen(false);
        setGroupByOpen(false);
        setSortOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePrioritySelect = useCallback(
    (priority: TaskPriority | "all") => {
      onFilterPriorityChange(priority);
      setPriorityOpen(false);
    },
    [onFilterPriorityChange],
  );

  const handleGroupBySelect = useCallback(
    (value: TaskGroupBy) => {
      onGroupByChange(value);
      setGroupByOpen(false);
    },
    [onGroupByChange],
  );

  const handleSortSelect = useCallback(
    (value: SortOption) => {
      onSortChange?.(value);
      setSortOpen(false);
    },
    [onSortChange],
  );

  const handleDateFilterSelect = useCallback(
    (value: DateFilterValue) => {
      onDateFilterChange?.(value);
    },
    [onDateFilterChange],
  );

  // Status segmented control options
  const STATUS_OPTIONS: { value: TaskFilterStatus; label: string }[] = [
    { value: "incomplete", label: "Active" },
    { value: "all", label: "All" },
    { value: "completed", label: "Done" },
  ];

  // Group by options
  const GROUP_BY_OPTIONS: { value: TaskGroupBy; label: string }[] = [
    { value: "none", label: "No grouping" },
    { value: "priority", label: "Group by priority" },
    { value: "dueDate", label: "Group by due date" },
    { value: "tag", label: "Group by tag" },
  ];

  return (
    <div className="flex flex-col">
      {/* AI Suggestion Banner */}
      {showAISuggestion && aiSuggestionText && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/5 border-b border-accent/20">
          <Sparkles size={14} className="text-accent shrink-0" />
          <span className="text-xs text-text-secondary flex-1">{aiSuggestionText}</span>
          {onAISuggestionAction && (
            <button
              onClick={onAISuggestionAction}
              className="text-xs text-accent hover:text-accent-hover font-medium"
            >
              Apply
            </button>
          )}
        </div>
      )}

      {/* Main filter bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-primary bg-bg-primary/30 flex-nowrap overflow-x-auto">
        {/* Status Segmented Control */}
        <div
          role="radiogroup"
          aria-label="Filter by status"
          className="flex items-center bg-bg-tertiary rounded-lg p-0.5 shrink-0"
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              role="radio"
              aria-checked={filterStatus === option.value}
              onClick={() => onFilterStatusChange(option.value)}
              className={`
                px-3 py-1 text-xs font-medium rounded-md transition-all
                ${
                  filterStatus === option.value
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Priority Dropdown Chip */}
        <div ref={priorityRef} className="relative shrink-0">
          <button
            onClick={() => setPriorityOpen((o) => !o)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border
              ${
                filterPriority !== "all"
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-bg-tertiary border-border-primary text-text-secondary hover:text-text-primary"
              }
              transition-colors ${FOCUS_RING}
            `}
            aria-haspopup="listbox"
            aria-expanded={priorityOpen}
            aria-label="Select priority filter"
          >
            {filterPriority !== "all" && (
              <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[filterPriority as TaskPriority]}`} />
            )}
            <span>{filterPriority === "all" ? "Priority" : PRIORITY_LABELS[filterPriority as TaskPriority]}</span>
            <ChevronDown size={12} className="text-text-tertiary" />
          </button>

          {priorityOpen && (
            <div
              role="listbox"
              className="absolute inset-inline-start-0 top-full mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
            >
              <button
                role="option"
                aria-selected={filterPriority === "all"}
                onClick={() => handlePrioritySelect("all")}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover flex items-center gap-2 ${
                  filterPriority === "all" ? "text-accent" : "text-text-primary"
                }`}
              >
                All priorities
              </button>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((priority) => (
                <button
                  key={priority}
                  role="option"
                  aria-selected={filterPriority === priority}
                  onClick={() => handlePrioritySelect(priority)}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover flex items-center gap-2 ${
                    filterPriority === priority ? "text-accent" : "text-text-primary"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[priority]}`} />
                  <span>{PRIORITY_LABELS[priority]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group By Dropdown Chip */}
        <div ref={groupByRef} className="relative shrink-0">
          <button
            onClick={() => setGroupByOpen((o) => !o)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border
              ${
                groupBy !== "none"
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-bg-tertiary border-border-primary text-text-secondary hover:text-text-primary"
              }
              transition-colors ${FOCUS_RING}
            `}
            aria-haspopup="listbox"
            aria-expanded={groupByOpen}
            aria-label="Select group by option"
          >
            <span>{groupBy === "none" ? "Group" : GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label.replace("Group by ", "")}</span>
            <ChevronDown size={12} className="text-text-tertiary" />
          </button>

          {groupByOpen && (
            <div
              role="listbox"
              className="absolute inset-inline-start-0 top-full mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  role="option"
                  aria-selected={groupBy === option.value}
                  onClick={() => handleGroupBySelect(option.value)}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover ${
                    groupBy === option.value ? "text-accent" : "text-text-primary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Dropdown Chip */}
        {onSortChange && (
          <div ref={sortRef} className="relative shrink-0">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border
                ${
                  sortBy
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-bg-tertiary border-border-primary text-text-secondary hover:text-text-primary"
                }
                transition-colors ${FOCUS_RING}
              `}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              aria-label="Select sort option"
            >
              <ArrowUpDown size={12} className="text-text-tertiary" />
              <span>{sortBy ? SORT_OPTIONS.find((o) => o.value === sortBy)?.label : "Sort"}</span>
              <ChevronDown size={12} className="text-text-tertiary" />
            </button>

            {sortOpen && (
              <div
                role="listbox"
                className="absolute left-0 top-full mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
              >
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    role="option"
                    aria-selected={sortBy === option.value}
                    onClick={() => handleSortSelect(option.value)}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover ${
                      sortBy === option.value ? "text-accent" : "text-text-primary"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Date Quick Filter Chips - Horizontal scrollable row */}
      {onDateFilterChange && (
        <div className="flex overflow-x-auto gap-2 px-4 py-2 border-b border-border-primary bg-bg-primary/30 scrollbar-none flex-nowrap shrink-0">
          {DATE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleDateFilterSelect(option.value)}
              className={`
                shrink-0 px-4 py-1.5 text-xs font-medium rounded-full transition-all
                ${
                  dateFilter === option.value
                    ? "bg-accent text-white shadow-sm"
                    : "bg-bg-tertiary text-text-secondary border border-border-primary hover:text-text-primary"
                }
              `}
              aria-pressed={dateFilter === option.value}
            >
              {option.label}
            </button>
          ))}

          {dateFilter !== "all" && (
            <button
              onClick={() => handleDateFilterSelect("all")}
              className="shrink-0 px-2 py-1.5 text-xs text-text-tertiary hover:text-text-primary"
              aria-label="Clear date filter"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}