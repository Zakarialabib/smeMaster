import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import {
  dashboardWorkflowRulesTotal,
  dashboardWorkflowRulesActive,
} from "@shared/services/db/db-invoke";
import { WidgetHeader, WidgetSkeleton, WidgetError } from "./WidgetHelpers";
import { StatBox } from "./StatBox";

export function AutomationRulesWidget() {
  const [total, setTotal] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [totalRow, activeRow] = await Promise.all([
          dashboardWorkflowRulesTotal(),
          dashboardWorkflowRulesActive(),
        ]);
        if (!cancelled) {
          setTotal(totalRow);
          setActive(activeRow);
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
      <WidgetHeader icon={<Workflow size={16} />} title="Automation Rules" />
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-3 flex-1">
          <StatBox label="Total Rules" value={total ?? 0} />
          <StatBox label="Active" value={active ?? 0} variant={active != null && active > 0 ? "default" : "warning"} />
        </div>
        <Link
          to="/automation"
          className="ml-3 text-xs text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
        >
          Manage
        </Link>
      </div>
    </>
  );
}
