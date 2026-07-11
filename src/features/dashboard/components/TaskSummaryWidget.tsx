import { useEffect, useState } from "react";
import { CheckSquare } from "lucide-react";
import {
  dashboardTasksIncomplete,
  dashboardTasksOverdue,
  dashboardTasksDueToday,
} from "@shared/services/db/db-invoke";
import { WidgetHeader, WidgetSkeleton, WidgetError } from "./WidgetHelpers";
import { StatBox } from "./StatBox";

export function TaskSummaryWidget() {
  const [incomplete, setIncomplete] = useState<number | null>(null);
  const [overdue, setOverdue] = useState<number | null>(null);
  const [dueToday, setDueToday] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [incRow, overRow, todayRow] = await Promise.all([
          dashboardTasksIncomplete(),
          dashboardTasksOverdue(),
          dashboardTasksDueToday(),
        ]);
        if (!cancelled) {
          setIncomplete(incRow);
          setOverdue(overRow);
          setDueToday(todayRow);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  return (
    <>
      <WidgetHeader icon={<CheckSquare size={16} />} title="Task Summary" />
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Open" value={incomplete ?? 0} />
        <StatBox label="Overdue" value={overdue ?? 0} variant="danger" />
        <StatBox label="Due Today" value={dueToday ?? 0} variant="warning" />
      </div>
    </>
  );
}
