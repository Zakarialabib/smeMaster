import { useState, useEffect, useCallback } from "react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { getSetting, setSetting } from "@features/settings/db/settings";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup, SettingRow, ButtonGroup } from "@features/settings/components/SettingsHelpers";
import { TextField } from "@shared/components/ui/TextField";
import { Button } from "@shared/components/ui/Button";
import { notify } from "@shared/services/notifications/toastHelper";
import { Trash2, Archive, Send, Loader2, CheckCircle2, XCircle, Plus } from "lucide-react";

type CleanupAction = "delete" | "archive" | "move_to" | "mark_read" | "unsubscribe";

interface CleanupRule {
  id: string;
  name: string;
  rule_type: "sender" | "subject" | "age" | "unsubscribe";
  condition_json: string;
  action: CleanupAction;
  target_folder?: string;
  retention_days?: number;
  is_scheduled: boolean;
  schedule_cron?: string;
  next_run_at?: number;
}

interface CleanupHistory {
  id: string;
  rule_id?: string;
  action: string;
  thread_count: number;
  message_count: number;
  status: string;
  error_message?: string;
  executed_at: number;
}

interface AccountCleaningProps {
  accountId?: string;
}

export default function AccountCleaningTab({ accountId }: AccountCleaningProps) {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const targetAccountId = accountId || activeAccountId;
  const [rules, setRules] = useState<CleanupRule[]>([]);
  const [history, setHistory] = useState<CleanupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [retentionDays, setRetentionDays] = useState("365");
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    rule_type: "sender" as CleanupRule["rule_type"],
    condition: "",
    action: "delete" as CleanupAction,
    target_folder: "",
    retention_days: 30,
    is_scheduled: false,
    schedule_cron: "0 2 * * *", // Daily at 2 AM
  });

  const loadData = useCallback(async () => {
    if (!targetAccountId) return;
    setLoading(true);
    try {
      const [rulesData, historyData] = await Promise.all([
        invokeCommand<CleanupRule[]>("db_list_cleanup_rules", { account_id: targetAccountId }),
        invokeCommand<CleanupHistory[]>("db_list_cleanup_history", { account_id: targetAccountId, limit: 50 }),
      ]);
      setRules(rulesData);
      setHistory(historyData);
    } catch (err) {
      console.error("Failed to load cleanup data:", err);
    } finally {
      setLoading(false);
    }
  }, [targetAccountId]);

  const loadRetention = useCallback(async () => {
    const days = await getSetting("default_cleanup_days");
    setRetentionDays(days || "365");
  }, []);

  useEffect(() => {
    if (!targetAccountId) return;
    loadData();
    loadRetention();
  }, [targetAccountId, loadData, loadRetention]);

  const handleAddRule = async () => {
    if (!targetAccountId || !newRule.name.trim()) return;
    try {
      const rule: CleanupRule = {
        id: crypto.randomUUID(),
        ...newRule,
        condition_json: JSON.stringify({
          [newRule.rule_type]: newRule.condition,
          ...(newRule.retention_days && { retention_days: newRule.retention_days }),
        }),
      };
      await invokeCommand("db_upsert_cleanup_rule", {
        id: rule.id,
        account_id: targetAccountId,
        name: rule.name,
        rule_type: rule.rule_type,
        condition_json: rule.condition_json,
        action: rule.action,
        target_folder: rule.action === "move_to" ? rule.target_folder : null,
        retention_days: rule.rule_type === "age" ? rule.retention_days : null,
        is_scheduled: rule.is_scheduled ? 1 : 0,
        schedule_cron: rule.is_scheduled ? rule.schedule_cron : null,
      });
      setShowAddRule(false);
      setNewRule({
        name: "",
        rule_type: "sender",
        condition: "",
        action: "delete",
        target_folder: "",
        retention_days: 30,
        is_scheduled: false,
        schedule_cron: "0 2 * * *",
      });
      loadData();
      notify("Cleanup", "Rule added successfully.");
    } catch (err) {
      console.error("Failed to add rule:", err);
      notify("Cleanup", "Failed to add rule.");
    }
  };

  const handleRunRule = async (ruleId: string) => {
    try {
      const result = await invokeCommand<{ thread_count: number; message_count: number }>("db_execute_cleanup_rule", {
        account_id: targetAccountId,
        rule_id: ruleId,
      });
      notify("Cleanup", `Processed ${result.thread_count} threads, ${result.message_count} messages.`);
      loadData();
    } catch (err) {
      console.error("Failed to run rule:", err);
      notify("Cleanup", "Failed to execute rule.");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await invokeCommand("db_delete_cleanup_rule", { id: ruleId });
      loadData();
      notify("Cleanup", "Rule deleted.");
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const actionIcons = {
    delete: Trash2,
    archive: Archive,
    move_to: Send,
    mark_read: CheckCircle2,
    unsubscribe: XCircle,
  };

  const actionLabels = {
    delete: "Delete",
    archive: "Archive",
    move_to: "Move to",
    mark_read: "Mark Read",
    unsubscribe: "Unsubscribe",
  };

  if (!targetAccountId) {
    return <p className="text-sm text-text-tertiary">No account selected.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-text-tertiary">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading cleanup rules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Retention Policy Section */}
      <SettingGroup title="Retention Policies">
        <div className="space-y-3">
          <SettingRow label="Default retention period">
            <ButtonGroup
              value={retentionDays}
              onChange={async (val) => {
                setRetentionDays(val);
                await setSetting("default_cleanup_days", val);
                notify("Cleanup", "Retention period updated.");
              }}
              options={[
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
                { value: "180", label: "180 days" },
                { value: "365", label: "1 year" },
                { value: "0", label: "Forever" },
              ]}
            />
          </SettingRow>
          <p className="text-xs text-text-tertiary">
            Emails older than the retention period can be automatically cleaned up.
          </p>
        </div>
      </SettingGroup>

      {/* ── Education: Account Cleaning ───────────────────────────── */}
      <HelpCard
        items={[
          { type: "why", text: "Account cleaning helps you maintain a tidy inbox by automatically deleting, archiving, or categorizing old or unwanted emails based on rules you define." },
          { type: "how", text: "Set retention policies to define how long emails are kept. Create cleanup rules that match by sender, subject, age, or unsubscribe status — then choose an action like delete or archive." },
          { type: "when", text: "Use for clearing old newsletters, auto-deleting spammy senders, archiving aged threads, or bulk-unsubscribing from unwanted mailing lists." },
          { type: "tip", text: "Start with a 'mark read' or 'archive' rule before using 'delete' to avoid accidentally removing emails you might need. Scheduled rules run automatically at your chosen interval." },
        ]}
      />

      {/* Cleanup Rules Section */}
      <SettingGroup title="Cleanup Rules">
        <div className="space-y-3">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowAddRule(true)}
          >
            Add Cleanup Rule
          </Button>

          {rules.length === 0 ? (
            <p className="text-sm text-text-tertiary py-4 text-center">
              No cleanup rules configured. Add a rule to automatically clean up emails.
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const Icon = actionIcons[rule.action] || Trash2;
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between py-2.5 px-3 bg-bg-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className="text-accent" />
                      <div>
                        <div className="text-sm font-medium text-text-primary">{rule.name}</div>
                        <div className="text-xs text-text-tertiary">
                          {actionLabels[rule.action]} • {rule.rule_type}
                          {rule.is_scheduled && " • Scheduled"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRunRule(rule.id)}
                      >
                        Run Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-danger"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SettingGroup>

      {/* Add Rule Modal */}
      {showAddRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-primary rounded-lg p-5 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Add Cleanup Rule</h3>
            <div className="space-y-3">
              <TextField
                label="Rule Name"
                value={newRule.name}
                onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Clean old newsletters"
              />
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Rule Type</label>
                <select
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule((p) => ({ ...p, rule_type: e.target.value as CleanupRule["rule_type"] }))}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm"
                >
                  <option value="sender">Sender</option>
                  <option value="subject">Subject</option>
                  <option value="age">Age</option>
                  <option value="unsubscribe">Unsubscribe</option>
                </select>
              </div>
              <TextField
                label={newRule.rule_type === "age" ? "Days old" : "Condition"}
                value={newRule.rule_type === "age" ? String(newRule.retention_days) : newRule.condition}
                onChange={(e) => {
                  const val = e.target.value;
                  if (newRule.rule_type === "age") {
                    setNewRule((p) => ({ ...p, retention_days: parseInt(val) || 30 }));
                  } else {
                    setNewRule((p) => ({ ...p, condition: val }));
                  }
                }}
                placeholder={newRule.rule_type === "age" ? "30" : "newsletter@domain.com"}
              />
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Action</label>
                <select
                  value={newRule.action}
                  onChange={(e) => setNewRule((p) => ({ ...p, action: e.target.value as CleanupAction }))}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm"
                >
                  <option value="delete">Delete</option>
                  <option value="archive">Archive</option>
                  <option value="move_to">Move to Folder</option>
                  <option value="mark_read">Mark Read</option>
                  <option value="unsubscribe">Unsubscribe</option>
                </select>
              </div>
              {newRule.action === "move_to" && (
                <TextField
                  label="Target Folder"
                  value={newRule.target_folder}
                  onChange={(e) => setNewRule((p) => ({ ...p, target_folder: e.target.value }))}
                  placeholder="Trash"
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newRule.is_scheduled}
                  onChange={(e) => setNewRule((p) => ({ ...p, is_scheduled: e.target.checked }))}
                  id="scheduled"
                />
                <label htmlFor="scheduled" className="text-sm text-text-secondary">
                  Run automatically on schedule
                </label>
              </div>
              {newRule.is_scheduled && (
                <TextField
                  label="Cron Schedule (UTC)"
                  value={newRule.schedule_cron}
                  onChange={(e) => setNewRule((p) => ({ ...p, schedule_cron: e.target.value }))}
                  placeholder="0 2 * * * (daily at 2 AM)"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowAddRule(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddRule}>
                Add Rule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup History */}
      <SettingGroup title="Recent Cleanup History">
        {history.length === 0 ? (
          <p className="text-sm text-text-tertiary py-4 text-center">No cleanup history yet.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between py-2 px-3 text-xs bg-bg-secondary rounded"
              >
                <span className="text-text-secondary">
                  {new Date(h.executed_at * 1000).toLocaleString()}
                </span>
                <span className="text-text-primary">
                  {h.action}: {h.message_count} emails
                </span>
                <span className={h.status === "completed" ? "text-success" : "text-danger"}>
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </SettingGroup>
    </div>
  );
}
