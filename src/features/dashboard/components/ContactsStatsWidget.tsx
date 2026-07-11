import { useEffect, useState } from "react";
import { Users, Activity, Layers, Tags, Filter } from "lucide-react";
import {
  dashboardContactsTotal,
  dashboardContactsActive,
  dashboardContactsNewWeek,
} from "@shared/services/db/db-invoke";
import { listContactLabels, listContactGroups, listSegments } from "@shared/services/db/db-invoke";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { WidgetHeader, WidgetSkeleton, WidgetError } from "./WidgetHelpers";
import { StatBox } from "./StatBox";

export function ContactsStatsWidget() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [total, setTotal] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [newThisWeek, setNewThisWeek] = useState<number | null>(null);
  const [groupCount, setGroupCount] = useState<number | null>(null);
  const [tagCount, setTagCount] = useState<number | null>(null);
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [totalRow, activeRow, newRow] = await Promise.all([
          dashboardContactsTotal(),
          dashboardContactsActive(),
          dashboardContactsNewWeek(),
        ]);
        if (!cancelled) {
          setTotal(totalRow);
          setActive(activeRow);
          setNewThisWeek(newRow);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load group/tag/segment counts
  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    (async () => {
      try {
        const [groups, tags, segs] = await Promise.all([
          listContactGroups(activeAccountId),
          listContactLabels(activeAccountId),
          listSegments(activeAccountId),
        ]);
        if (!cancelled) {
          setGroupCount(groups.length);
          setTagCount(tags.length);
          setSegmentCount(segs.length);
        }
      } catch {
        // optional metadata, don't block
      }
    })();
    return () => { cancelled = true; };
  }, [activeAccountId]);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  return (
    <>
      <WidgetHeader icon={<Users size={16} />} title="Contacts Stats" />
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatBox
            label="Total"
            value={total ?? 0}
            icon={<Users size={13} />}
          />
          <StatBox
            label="Active"
            value={active ?? 0}
            icon={<Users size={13} />}
            subtitle={`${((active ?? 0) / Math.max(total ?? 1, 1)) * 100}%`}
          />
          <StatBox
            label="New/Week"
            value={newThisWeek ?? 0}
            icon={<Activity size={13} />}
            variant={newThisWeek != null && newThisWeek > 0 ? "default" : "muted"}
          />
        </div>
        <div className="flex items-center justify-around text-xs text-text-tertiary border-t border-border-secondary pt-2">
          <span className="flex items-center gap-1">
            <Layers size={12} />
            {groupCount ?? "â€”"} groups
          </span>
          <span className="flex items-center gap-1">
            <Tags size={12} />
            {tagCount ?? "â€”"} tags
          </span>
          <span className="flex items-center gap-1">
            <Filter size={12} />
            {segmentCount ?? "â€”"} segments
          </span>
        </div>
      </div>
    </>
  );
}
