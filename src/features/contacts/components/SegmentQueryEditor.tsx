import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus, Save, X, Trash2, Filter } from "lucide-react";
import { upsertContactSegment } from "@features/contacts/db/contactSegments";
import { useContactStore } from "@features/contacts/stores/contactStore";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface QueryRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface SegmentQueryEditorProps {
  accountId: string;
  initialSegment?: {
    id: string;
    name: string;
    query: string;
    description?: string;
    color?: string;
  };
  onSave?: () => void;
  onCancel?: () => void;
}

// â”€â”€â”€ Field definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type FieldType = "string" | "number" | "boolean" | "date" | "enum";

const FIELD_CONFIG: Record<string, { label: string; type: FieldType; enumValues?: string[] }> = {
  from: { label: "From (Email)", type: "string" },
  has_attachment: { label: "Has Attachment", type: "boolean" },
  last_contact: { label: "Last Contact", type: "date" },
  health_status: {
    label: "Health Status",
    type: "enum",
    enumValues: ["cold", "lukewarm", "warm", "hot"],
  },
  engagement_score: { label: "Engagement Score", type: "number" },
  tag: { label: "Tag", type: "string" },
  domain: { label: "Domain", type: "string" },
};

const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
  string: [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Doesn't Equal" },
  ],
  number: [
    { value: ">=", label: "≥" },
    { value: "<=", label: "≤" },
    { value: "=", label: "=" },
    { value: ">", label: ">" },
    { value: "<", label: "<" },
    { value: "crosses_threshold", label: "Crosses threshold" },
  ],
  boolean: [
    { value: "is_true", label: "Yes" },
    { value: "is_false", label: "No" },
  ],
  date: [
    { value: "in_last", label: "In Last (days)" },
    { value: "before", label: "Before (days)" },
    { value: "after", label: "After (days)" },
  ],
  enum: [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Doesn't Equal" },
  ],
};

const PRESET_COLORS = [
  { value: "blue", bg: "bg-blue-500", hex: "#3b82f6" },
  { value: "green", bg: "bg-green-500", hex: "#22c55e" },
  { value: "purple", bg: "bg-purple-500", hex: "#a855f7" },
  { value: "orange", bg: "bg-orange-500", hex: "#f97316" },
  { value: "red", bg: "bg-red-500", hex: "#ef4444" },
  { value: "teal", bg: "bg-teal-500", hex: "#14b8a6" },
];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getFieldType(field: string): FieldType {
  return FIELD_CONFIG[field]?.type ?? "string";
}

function getDefaultOperator(field: string): string {
  const type = getFieldType(field);
  return OPERATORS[type]?.[0]?.value ?? "contains";
}

function getDefaultValue(field: string): string {
  const type = getFieldType(field);
  if (type === "boolean") return "is_true";
  return "";
}

function createBlankRule(): QueryRule {
  const id = crypto.randomUUID();
  return { id, field: "from", operator: "contains", value: "" };
}

function parseQueryString(query: string): { rules: QueryRule[]; logicalOp: "AND" | "OR" } {
  if (!query.trim()) return { rules: [], logicalOp: "AND" };

  const upper = query.toUpperCase();
  const hasOR = upper.includes(" OR ");
  const logicalOp: "AND" | "OR" = hasOR ? "OR" : "AND";

  const separator = hasOR ? /\s+OR\s+/i : /\s+AND\s+/i;
  const parts = query.split(separator).map((p) => p.trim()).filter(Boolean);

  const rules: QueryRule[] = parts.map((part) => {
    if (part === "has:attachment") {
      return { id: crypto.randomUUID(), field: "has_attachment", operator: "is_true", value: "" };
    }
    const fromMatch = part.match(/^from:(.+)/i);
    if (fromMatch) {
      return { id: crypto.randomUUID(), field: "from", operator: "equals", value: fromMatch[1]!.trim() };
    }
    const lastContactMatch = part.match(/^last_contact:<(\d+)/i);
    if (lastContactMatch) {
      return { id: crypto.randomUUID(), field: "last_contact", operator: "in_last", value: lastContactMatch[1]! };
    }
    const healthMatch = part.match(/^health:(.+)/i);
    if (healthMatch) {
      return { id: crypto.randomUUID(), field: "health_status", operator: "equals", value: healthMatch[1]!.trim() };
    }
    const scoreMatch = part.match(/^score(>=|<=|>|<|=)(.+)/i);
    if (scoreMatch) {
      return {
        id: crypto.randomUUID(),
        field: "engagement_score",
        operator: scoreMatch[1]!,
        value: scoreMatch[2]!.trim(),
      };
    }
    const tagMatch = part.match(/^tag:(.+)/i);
    if (tagMatch) {
      return { id: crypto.randomUUID(), field: "tag", operator: "equals", value: tagMatch[1]!.trim() };
    }
    const domainMatch = part.match(/^domain:(.+)/i);
    if (domainMatch) {
      return { id: crypto.randomUUID(), field: "domain", operator: "equals", value: domainMatch[1]!.trim() };
    }
    return { id: crypto.randomUUID(), field: "from", operator: "contains", value: part };
  });

  return { rules, logicalOp };
}

function buildQueryString(rules: QueryRule[], logicalOp: "AND" | "OR"): string {
  const parts = rules
    .map((rule) => {
      const val = rule.value.trim();
      if (!val && rule.field !== "has_attachment") return "";

      switch (rule.field) {
        case "from":
        case "domain":
          if (rule.operator === "equals" || rule.operator === "contains") return `from:${val}`;
          return "";
        case "has_attachment":
          return rule.operator === "is_true" ? "has:attachment" : "";
        case "last_contact":
          if (rule.operator === "in_last" || rule.operator === "before") return `last_contact:<${val}`;
          return "";
        case "health_status":
          return `health:${val}`;
        case "engagement_score":
          return `score${rule.operator}${val}`;
        case "tag":
          return `tag:${val}`;
        default:
          return "";
      }
    })
    .filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return parts.join(` ${logicalOp} `);
}

function updateRuleField(
  rules: QueryRule[],
  ruleId: string,
  field: string,
): QueryRule[] {
  return rules.map((r) => {
    if (r.id !== ruleId) return r;
    const newOp = getDefaultOperator(field);
    const newVal = getDefaultValue(field);
    return { ...r, field, operator: newOp, value: newVal };
  });
}

export function SegmentQueryEditor({
  accountId,
  initialSegment,
  onSave,
  onCancel,
}: SegmentQueryEditorProps) {
  const loadSegments = useContactStore((s) => s.loadSegments);

  const [name, setName] = useState(initialSegment?.name ?? "");
  const [description, setDescription] = useState(initialSegment?.description ?? "");
  const [color, setColor] = useState(initialSegment?.color ?? "blue");
  const [rules, setRules] = useState<QueryRule[]>(() => {
    if (initialSegment?.query) {
      const parsed = parseQueryString(initialSegment.query);
      return parsed.rules;
    }
    return [createBlankRule()];
  });
  const [logicalOp, setLogicalOp] = useState<"AND" | "OR">(() => {
    if (initialSegment?.query) {
      return parseQueryString(initialSegment.query).logicalOp;
    }
    return "AND";
  });
  const [saving, setSaving] = useState(false);

  // Re-parse if initialSegment.query changes
  useEffect(() => {
    if (initialSegment?.query) {
      const parsed = parseQueryString(initialSegment.query);
      setRules(parsed.rules.length > 0 ? parsed.rules : [createBlankRule()]);
      setLogicalOp(parsed.logicalOp);
    }
  }, [initialSegment?.query]);

  const queryString = useMemo(
    () => buildQueryString(rules, logicalOp),
    [rules, logicalOp],
  );

  const isNameValid = name.trim().length > 0;
  const hasRules = rules.some((r) => r.field && (r.value.trim() || r.field === "has_attachment"));

  const handleFieldChange = useCallback((ruleId: string, field: string) => {
    setRules((prev) => updateRuleField(prev, ruleId, field));
  }, []);

  const handleOperatorChange = useCallback((ruleId: string, operator: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, operator } : r)),
    );
  }, []);

  const handleValueChange = useCallback((ruleId: string, value: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, value } : r)),
    );
  }, []);

  const handleRemoveRule = useCallback((ruleId: string) => {
    setRules((prev) => {
      const next = prev.filter((r) => r.id !== ruleId);
      return next.length === 0 ? [createBlankRule()] : next;
    });
  }, []);

  const handleAddRule = useCallback(() => {
    setRules((prev) => [...prev, createBlankRule()]);
  }, []);

  const handleSave = useCallback(async () => {
    if (!isNameValid || saving) return;
    setSaving(true);
    try {
      await upsertContactSegment(initialSegment?.id, accountId, name.trim(), queryString);
      await loadSegments(accountId);
      onSave?.();
    } catch (err) {
      console.error("Failed to save segment:", err);
    } finally {
      setSaving(false);
    }
  }, [isNameValid, saving, initialSegment?.id, accountId, name, queryString, loadSegments, onSave]);

  return (
    <div className="space-y-4">
      {/* Name + Description */}
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Segment Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Hot leads this month"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Description <span className="text-text-tertiary">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this segment"
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Color
        </label>
        <div className="flex items-center gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              title={c.value}
              className={`w-5 h-5 rounded-full ${c.bg} transition-all ${
                color === c.value
                  ? "ring-2 ring-offset-1 ring-offset-bg-primary ring-accent scale-110"
                  : "opacity-60 hover:opacity-100"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Query Rules */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Conditions
          </label>
          {/* Logical operator toggle */}
          {rules.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[0.625rem] text-text-tertiary">Match</span>
              <button
                type="button"
                onClick={() => setLogicalOp("AND")}
                className={`px-2 py-0.5 text-[0.625rem] font-medium rounded transition-colors ${
                  logicalOp === "AND"
                    ? "bg-accent text-white"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                }`}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setLogicalOp("OR")}
                className={`px-2 py-0.5 text-[0.625rem] font-medium rounded transition-colors ${
                  logicalOp === "OR"
                    ? "bg-accent text-white"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                }`}
              >
                ANY
              </button>
            </div>
          )}
        </div>

        <div className="space-y-0">
          {rules.map((rule, index) => {
            const fieldType = getFieldType(rule.field);
            const operators = OPERATORS[fieldType] ?? [];
            const fieldDef = FIELD_CONFIG[rule.field];

            return (
              <div key={rule.id}>
                {/* Logical operator label between rules */}
                {index > 0 && (
                  <div className="flex items-center justify-center py-0.5">
                    <span className="text-[0.625rem] font-semibold text-accent uppercase tracking-wider bg-bg-secondary px-2 rounded">
                      {logicalOp}
                    </span>
                  </div>
                )}
              <div className="flex items-start gap-1.5 p-1.5 rounded bg-bg-secondary border border-border-primary">

                {/* Field selector */}
                <select
                  value={rule.field}
                  onChange={(e) => handleFieldChange(rule.id, e.target.value)}
                  className="flex-shrink-0 w-[130px] px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent transition-colors"
                >
                  {Object.entries(FIELD_CONFIG).map(([key, def]) => (
                    <option key={key} value={key}>
                      {def.label}
                    </option>
                  ))}
                </select>

                {/* Operator selector */}
                <select
                  value={rule.operator}
                  onChange={(e) => handleOperatorChange(rule.id, e.target.value)}
                  className="flex-shrink-0 w-[110px] px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent transition-colors"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value input */}
                <div className="flex-1 min-w-0">
                  {fieldType === "boolean" ? (
                    <div className="px-2 py-1 text-xs text-text-tertiary">
                      {rule.operator === "is_true" ? "Yes" : "No"}
                    </div>
                  ) : fieldType === "enum" && fieldDef?.enumValues ? (
                    <select
                      value={rule.value}
                      onChange={(e) => handleValueChange(rule.id, e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent transition-colors"
                    >
                      <option value="">Select...</option>
                      {fieldDef.enumValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : fieldType === "date" ? (
                    <input
                      type="number"
                      min={1}
                      value={rule.value}
                      onChange={(e) => handleValueChange(rule.id, e.target.value)}
                      placeholder="Days"
                      className="w-full px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent transition-colors"
                    />
                  ) : (
                    <input
                      type={fieldType === "number" ? "number" : "text"}
                      value={rule.value}
                      onChange={(e) => handleValueChange(rule.id, e.target.value)}
                      placeholder={
                        fieldType === "number"
                          ? "0â€“100"
                          : rule.field === "from"
                            ? "email or @domain"
                            : rule.field === "domain"
                              ? "example.com"
                              : "Value..."
                      }
                      className="w-full px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary outline-none focus:border-accent transition-colors"
                      step={fieldType === "number" ? "0.1" : undefined}
                    />
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveRule(rule.id)}
                  className="flex-shrink-0 p-1 text-text-tertiary hover:text-danger rounded hover:bg-bg-hover transition-colors"
                  title="Remove condition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            );
          })}
        </div>

        {/* Add Rule button */}
        <button
          type="button"
          onClick={handleAddRule}
          className="mt-1.5 flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded transition-colors"
        >
          <Plus size={12} />
          Add condition
        </button>
      </div>

      {/* Query Preview */}
      {queryString && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Query Preview
          </label>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-bg-tertiary border border-border-primary">
            <Filter size={12} className="text-text-tertiary shrink-0" />
            <code className="text-xs text-text-primary font-mono break-all">
              {queryString}
            </code>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isNameValid || !hasRules || saving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={12} />
          {saving ? "Saving..." : initialSegment ? "Update Segment" : "Save Segment"}
        </button>
      </div>
    </div>
  );
}
