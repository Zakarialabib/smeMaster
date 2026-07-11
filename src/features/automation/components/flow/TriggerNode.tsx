import { memo, useCallback, type ChangeEvent } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Zap } from "lucide-react";
import { useAutomationStore } from "@features/automation/stores/automationStore";

export type TriggerNodeData = Node<
  {
    event: string;
    conditions: string;
  },
  "trigger"
>;

const TRIGGER_EVENTS = [
  { value: "email_received", label: "Email Received" },
  { value: "no_reply_after_days", label: "No Reply After Days" },
  { value: "time_based", label: "Time Based" },
  { value: "label_applied", label: "Label Applied" },
  { value: "starred", label: "Email Starred" },
];

export const TriggerNode = memo(function TriggerNode({
  data,
}: NodeProps<TriggerNodeData>) {
  const setEditorField = useAutomationStore((s) => s.setEditorField);

  const handleEventChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newEvent = e.target.value;
      let defaultConditions = "";
      if (newEvent === "time_based") {
        defaultConditions = JSON.stringify({ cron: "0 9 * * 1" });
      } else if (newEvent === "no_reply_after_days") {
        defaultConditions = JSON.stringify({ days: 3 });
      } else {
        defaultConditions = JSON.stringify({
          from_domain: "",
          subject_contains: "",
        });
      }
      setEditorField("triggerEvent", newEvent);
      setEditorField("triggerConditions", defaultConditions);
    },
    [setEditorField],
  );

  const handleConditionsChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const parsed = JSON.parse(data.conditions || "{}");
      parsed[e.target.name] = e.target.value;
      setEditorField("triggerConditions", JSON.stringify(parsed));
    },
    [data.conditions, setEditorField],
  );

  const conditions = (() => {
    try {
      return JSON.parse(data.conditions || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  return (
    <div className="rounded-xl border-2 border-accent bg-bg-secondary shadow-lg min-w-[240px]">
      <Handle type="source" position={Position.Bottom} className="!bg-accent" />
      <div className="flex items-center gap-2 p-3 border-b border-border-primary">
        <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center">
          <Zap size={14} className="text-accent" />
        </div>
        <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          Trigger
        </span>
      </div>
      <div className="p-3 space-y-2">
        <select
          value={data.event}
          onChange={handleEventChange}
          className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-accent"
        >
          {TRIGGER_EVENTS.map((ev) => (
            <option key={ev.value} value={ev.value}>
              {ev.label}
            </option>
          ))}
        </select>

        {data.event === "email_received" && (
          <div className="space-y-1.5">
            <input
              type="text"
              name="from_domain"
              value={(conditions.from_domain as string) ?? ""}
              onChange={handleConditionsChange}
              placeholder="From domain (e.g. example.com)"
              className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-accent"
            />
            <input
              type="text"
              name="subject_contains"
              value={(conditions.subject_contains as string) ?? ""}
              onChange={handleConditionsChange}
              placeholder="Subject contains"
              className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-accent"
            />
          </div>
        )}

        {data.event === "no_reply_after_days" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">After</span>
            <input
              type="number"
              name="days"
              min={1}
              max={365}
              value={(conditions.days as number) ?? 3}
              onChange={(e) => {
                const parsed = JSON.parse(data.conditions || "{}");
                parsed.days = Math.max(1, Number(e.target.value));
                setEditorField("triggerConditions", JSON.stringify(parsed));
              }}
              className="w-16 bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-border-primary outline-none focus:border-accent"
            />
            <span className="text-xs text-text-secondary">days</span>
          </div>
        )}

        {data.event === "time_based" && (
          <input
            type="text"
            name="cron"
            value={(conditions.cron as string) ?? ""}
            onChange={handleConditionsChange}
            placeholder="Cron: 0 9 * * 1"
            className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-accent"
          />
        )}
      </div>
    </div>
  );
});
