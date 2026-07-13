import { useState } from "react";
import { CheckSquare, Calendar } from "lucide-react";
import { cn } from "@shared/utils/cn";
import { TasksPage } from "@features/tasks/components/TasksPage";
import { CalendarPage } from "@features/calendar/components/CalendarPage";

type ScheduleTab = "tasks" | "calendar";

const TABS: { id: ScheduleTab; label: string; icon: typeof CheckSquare }[] = [
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
];

/**
 * Schedule — Tasks + Calendar.
 *
 * Both share account-scoped context behind a single nav item with an
 * in-page tab strip. Each tab reuses the existing self-contained page
 * component (load effects, empty states, views).
 */
export function SchedulePage() {
  const [tab, setTab] = useState<ScheduleTab>("tasks");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Segmented control */}
      <div className="flex items-center gap-1 px-3 sm:px-6 pt-3 border-b border-border/50">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-accent text-text-primary"
                  : "border-transparent text-text-tertiary hover:text-text-secondary",
              )}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active section */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {tab === "tasks" ? <TasksPage /> : <CalendarPage />}
      </div>
    </div>
  );
}
