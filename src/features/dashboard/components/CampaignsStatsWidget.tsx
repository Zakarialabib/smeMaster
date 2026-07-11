import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import {
  dashboardCampaignsTotal,
  dashboardCampaignsSent,
  dashboardCampaignsOpenRate,
  dashboardCampaignsClickRate,
} from "@shared/services/db/db-invoke";
import { WidgetHeader, WidgetSkeleton, WidgetError } from "./WidgetHelpers";
import { StatBox } from "./StatBox";

export function CampaignsStatsWidget() {
  const [total, setTotal] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [openRate, setOpenRate] = useState<number | null>(null);
  const [clickRate, setClickRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [totalRow, sentRow, openRow, clickRow] = await Promise.all([
          dashboardCampaignsTotal(),
          dashboardCampaignsSent(),
          dashboardCampaignsOpenRate(),
          dashboardCampaignsClickRate(),
        ]);
        if (!cancelled) {
          setTotal(totalRow);
          setSent(sentRow);
          setOpenRate(openRow);
          setClickRate(clickRow);
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
      <WidgetHeader icon={<Target size={16} />} title="Campaigns Overview" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Total" value={total ?? 0} />
        <StatBox label="Sent" value={sent ?? 0} />
        <StatBox label="Open Rate" value={`${openRate ?? 0}%`} variant={openRate != null && openRate > 30 ? "default" : "warning"} />
        <StatBox label="Click Rate" value={`${clickRate ?? 0}%`} variant={clickRate != null && clickRate > 10 ? "default" : "warning"} />
      </div>
    </>
  );
}
