import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Connection,
  type Node,
  type NodeTypes,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, X, Plus, LayoutTemplate } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { usePlatform } from "@shared/hooks/usePlatform";
import { useAutomationStore } from "@features/automation/stores/automationStore";
import { AutomationTriggerPicker } from "@features/automation/components/AutomationTriggerPicker";
import { AutomationActionPicker } from "@features/automation/components/AutomationActionPicker";
import { TriggerNode } from "./flow/TriggerNode";
import { ConditionNode } from "./flow/ConditionNode";
import { ActionNode } from "./flow/ActionNode";
import type { AutomationAction } from "@features/automation/stores/automationStore";

// ── Node type registry ───────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};

// ── Node defaults ─────────────────────────────────────────────────────────────

const TRIGGER_NODE_DEFAULTS = {
  type: "trigger" as const,
  position: { x: 250, y: 25 },
};

const CONDITION_NODE_DEFAULTS = {
  type: "condition" as const,
  position: { x: 250, y: 200 },
};

const ACTION_NODE_DEFAULTS = {
  type: "action" as const,
  position: { x: 250, y: 375 },
};

const DEFAULT_SPACING = 175;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AutomationBuilderProps {
  accountId: string;
  onSaveSuccess?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInitialNodes(
  triggerEvent: string,
  triggerConditions: string,
  actions: AutomationAction[],
  onActionUpdate: (index: number, action: AutomationAction) => void,
  onActionDelete: (index: number) => void,
): Node[] {
  const nodes: Node[] = [];

  // Trigger node
  nodes.push({
    id: "trigger-1",
    ...TRIGGER_NODE_DEFAULTS,
    data: { event: triggerEvent, conditions: triggerConditions },
  } as Node);

  // Condition node (only if conditions exist and are meaningful)
  const hasConditions = (() => {
    try {
      const parsed = JSON.parse(triggerConditions || "{}");
      return Object.values(parsed).some((v) => v !== "" && v !== null && v !== undefined);
    } catch {
      return false;
    }
  })();
  if (hasConditions) {
    nodes.push({
      id: "condition-1",
      ...CONDITION_NODE_DEFAULTS,
      data: { conditions: triggerConditions },
    } as Node);
  }

  // Action nodes
  actions.forEach((action, index) => {
    nodes.push({
      id: `action-${index}`,
      position: {
        x: 250,
        y: hasConditions ? ACTION_NODE_DEFAULTS.position.y + index * DEFAULT_SPACING : CONDITION_NODE_DEFAULTS.position.y + index * DEFAULT_SPACING,
      },
      data: { index, action, onUpdate: onActionUpdate, onDelete: onActionDelete },
    } as Node);
  });

  return nodes;
}

function buildEdges(
  hasConditions: boolean,
  actionCount: number,
): Edge[] {
  const edges: Edge[] = [];
  const edgeStyle = { stroke: "#78716c", strokeWidth: 2 };
  const markerEnd = { type: MarkerType.ArrowClosed, color: "#78716c" };

  if (hasConditions) {
    edges.push({
      id: "e-trigger-condition",
      source: "trigger-1",
      target: "condition-1",
      style: edgeStyle,
      markerEnd,
    });
    for (let i = 0; i < actionCount; i++) {
      const source = i === 0 ? "condition-1" : `action-${i - 1}`;
      edges.push({
        id: `e-action-${i}`,
        source,
        target: `action-${i}`,
        style: edgeStyle,
        markerEnd,
      });
    }
  } else {
    for (let i = 0; i < actionCount; i++) {
      const source = i === 0 ? "trigger-1" : `action-${i - 1}`;
      edges.push({
        id: `e-action-${i}`,
        source,
        target: `action-${i}`,
        style: edgeStyle,
        markerEnd,
      });
    }
  }

  return edges;
}

// ── Action types used by the builder (for desktop add-action button) ──────────

// ── Mobile Step List ──────────────────────────────────────────────────────────

function MobileStepList({
  triggerEvent,
  triggerConditions,
  actions,
  onTriggerChange,
  onActionsChange,
  ruleName,
  onNameChange,
}: {
  triggerEvent: string;
  triggerConditions: string;
  actions: AutomationAction[];
  onTriggerChange: (event: string, conditions: string) => void;
  onActionsChange: (actions: AutomationAction[]) => void;
  ruleName: string;
  onNameChange: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Rule name */}
      <div>
        <label className="text-xs font-medium text-text-secondary mb-1 block">
          Rule Name
        </label>
        <input
          type="text"
          value={ruleName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Auto-archive newsletters"
          className="w-full bg-bg-tertiary text-text-primary text-sm px-3 py-2 rounded-lg border border-border-primary outline-none focus:border-accent"
        />
      </div>

      {/* Step 1: Trigger */}
      <div className="rounded-xl border border-accent/30 bg-bg-secondary p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
            <span className="text-xs font-bold text-accent">1</span>
          </div>
          <span className="text-sm font-semibold text-text-primary">Trigger</span>
        </div>
        <AutomationTriggerPicker
          event={triggerEvent}
          conditions={triggerConditions}
          onChange={onTriggerChange}
        />
      </div>

      {/* Step 2+: Actions */}
      <div className="rounded-xl border border-success/30 bg-bg-secondary p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-success/15 flex items-center justify-center">
            <span className="text-xs font-bold text-success">2</span>
          </div>
          <span className="text-sm font-semibold text-text-primary">Actions</span>
        </div>
        <AutomationActionPicker
          actions={actions}
          onChange={onActionsChange}
        />
      </div>
    </div>
  );
}

// ── Tablet Two-Column View ────────────────────────────────────────────────────

function TabletTwoColumn({
  triggerEvent,
  triggerConditions,
  actions,
  onTriggerChange,
  onActionsChange,
  ruleName,
  onNameChange,
}: {
  triggerEvent: string;
  triggerConditions: string;
  actions: AutomationAction[];
  onTriggerChange: (event: string, conditions: string) => void;
  onActionsChange: (actions: AutomationAction[]) => void;
  ruleName: string;
  onNameChange: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Left column: Trigger + Name */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">
            Rule Name
          </label>
          <input
            type="text"
            value={ruleName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Auto-archive newsletters"
            className="w-full bg-bg-tertiary text-text-primary text-sm px-3 py-2 rounded-lg border border-border-primary outline-none focus:border-accent"
          />
        </div>
        <div className="rounded-xl border border-accent/30 bg-bg-secondary p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-xs font-bold text-accent">1</span>
            </div>
            <span className="text-sm font-semibold text-text-primary">Trigger</span>
          </div>
          <AutomationTriggerPicker
            event={triggerEvent}
            conditions={triggerConditions}
            onChange={onTriggerChange}
          />
        </div>
      </div>

      {/* Right column: Actions */}
      <div className="rounded-xl border border-success/30 bg-bg-secondary p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-success/15 flex items-center justify-center">
            <span className="text-xs font-bold text-success">2</span>
          </div>
          <span className="text-sm font-semibold text-text-primary">Actions</span>
        </div>
        <AutomationActionPicker
          actions={actions}
          onChange={onActionsChange}
        />
      </div>

      {/* Flow preview */}
      <div className="col-span-2">
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
          <div className="flex items-center gap-2 mb-3">
            <LayoutTemplate size={14} className="text-text-tertiary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Flow Preview
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span className="bg-accent/10 text-accent px-2 py-1 rounded">
              {TRIGGER_EVENT_LABELS[triggerEvent] ?? triggerEvent}
            </span>
            {actions.length > 0 && (
              <>
                <span className="text-text-tertiary">&rarr;</span>
                <span className="bg-success/10 text-success px-2 py-1 rounded">
                  {actions.length} action{actions.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const TRIGGER_EVENT_LABELS: Record<string, string> = {
  email_received: "Email Received",
  no_reply_after_days: "No Reply After Days",
  time_based: "Time Based",
  label_applied: "Label Applied",
  starred: "Email Starred",
};

// ── Main Builder Component ────────────────────────────────────────────────────

export function AutomationBuilder({
  accountId,
  onSaveSuccess,
}: AutomationBuilderProps) {
  const { screen } = usePlatform();
  const isDesktop = screen.isDesktop;
  const isMobile = screen.isMobile;
  const isTablet = !isMobile && !isDesktop;

  const editor = useAutomationStore((s) => s.editor);
  const setEditorField = useAutomationStore((s) => s.setEditorField);
  const closeBuilder = useAutomationStore((s) => s.closeBuilder);
  const saveRule = useAutomationStore((s) => s.saveRule);
  const loading = useAutomationStore((s) => s.isLoading);

  // ── Action handlers that sync to the store ────────────────────────────

  const handleActionUpdate = useCallback(
    (index: number, action: AutomationAction) => {
      const next = editor.actions.map((a, i) =>
        i === index ? action : a,
      );
      setEditorField("actions", next);
    },
    [editor.actions, setEditorField],
  );

  const handleActionDelete = useCallback(
    (index: number) => {
      const next = editor.actions.filter((_, i) => i !== index);
      setEditorField("actions", next);
    },
    [editor.actions, setEditorField],
  );

  const handleActionAdd = useCallback(() => {
    const newAction: AutomationAction = { type: "apply_label", labelId: "" };
    setEditorField("actions", [...editor.actions, newAction]);
  }, [editor.actions, setEditorField]);

  const handleTriggerChange = useCallback(
    (event: string, conditions: string) => {
      setEditorField("triggerEvent", event);
      setEditorField("triggerConditions", conditions);
    },
    [setEditorField],
  );

  const handleActionsChange = useCallback(
    (actions: AutomationAction[]) => {
      setEditorField("actions", actions);
    },
    [setEditorField],
  );

  // ── Flow nodes/edges derived from store state ─────────────────────────

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);

  const hasConditions = useMemo(() => {
    try {
      const parsed = JSON.parse(editor.triggerConditions || "{}");
      return Object.values(parsed).some(
        (v) => v !== "" && v !== null && v !== undefined,
      );
    } catch {
      return false;
    }
  }, [editor.triggerConditions]);

  // Sync store state → flow nodes/edges
  useEffect(() => {
    if (!isDesktop) return;
    const flowNodes = buildInitialNodes(
      editor.triggerEvent,
      editor.triggerConditions,
      editor.actions,
      handleActionUpdate,
      handleActionDelete,
    );
    const flowEdges = buildEdges(hasConditions, editor.actions.length);
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [
    editor.triggerEvent,
    editor.triggerConditions,
    editor.actions,
    hasConditions,
    handleActionUpdate,
    handleActionDelete,
    isDesktop,
    setNodes,
    setEdges,
  ]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            style: { stroke: "#78716c", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#78716c" },
          } as Edge,
          eds,
        ),
      );
    },
    [setEdges],
  );

  const handleSave = useCallback(async () => {
    const success = await saveRule(accountId);
    if (success && onSaveSuccess) {
      onSaveSuccess();
    }
  }, [saveRule, accountId, onSaveSuccess]);

  // ── Render ────────────────────────────────────────────────────────────

  // Mobile: step list
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Visual Builder
          </h3>
          <button
            type="button"
            onClick={closeBuilder}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Close builder"
          >
            <X size={14} />
          </button>
        </div>

        <MobileStepList
          triggerEvent={editor.triggerEvent}
          triggerConditions={editor.triggerConditions}
          actions={editor.actions}
          onTriggerChange={handleTriggerChange}
          onActionsChange={handleActionsChange}
          ruleName={editor.name}
          onNameChange={(name) => setEditorField("name", name)}
        />

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            onClick={handleSave}
            disabled={!editor.name.trim() || loading}
            loading={loading}
          >
            Save Rule
          </Button>
          <Button variant="secondary" size="sm" onClick={closeBuilder}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Tablet: two-column view
  if (isTablet) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Visual Builder
          </h3>
          <button
            type="button"
            onClick={closeBuilder}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Close builder"
          >
            <X size={14} />
          </button>
        </div>

        <TabletTwoColumn
          triggerEvent={editor.triggerEvent}
          triggerConditions={editor.triggerConditions}
          actions={editor.actions}
          onTriggerChange={handleTriggerChange}
          onActionsChange={handleActionsChange}
          ruleName={editor.name}
          onNameChange={(name) => setEditorField("name", name)}
        />

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            onClick={handleSave}
            disabled={!editor.name.trim() || loading}
            loading={loading}
          >
            Save Rule
          </Button>
          <Button variant="secondary" size="sm" onClick={closeBuilder}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Desktop: full ReactFlow canvas
  return (
    <div className="flex flex-col h-full">
      {/* Builder header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={editor.name}
            onChange={(e) => setEditorField("name", e.target.value)}
            placeholder="Rule name (e.g. Auto-archive newsletters)"
            className="flex-1 bg-bg-tertiary text-text-primary text-sm px-3 py-1.5 rounded-lg border border-border-primary outline-none focus:border-accent max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Add action node */}
          {editor.actions.length < 8 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={14} />}
              onClick={handleActionAdd}
            >
              Action
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            onClick={handleSave}
            disabled={!editor.name.trim() || loading}
            loading={loading}
          >
            Save Rule
          </Button>
          <Button variant="secondary" size="sm" onClick={closeBuilder}>
            Close
          </Button>
        </div>
      </div>

      {/* ReactFlow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          minZoom={0.5}
          maxZoom={2}
          deleteKeyCode="Backspace"
          selectionOnDrag
          panOnDrag={[1, 2]}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(120, 113, 108, 0.15)"
          />
          <Controls
            className="!bg-bg-secondary !border-border-primary !rounded-lg"
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "trigger") return "#4f46e5";
              if (n.type === "condition") return "#d97706";
              if (n.type === "action") return "#059669";
              return "#78716c";
            }}
            className="!bg-bg-secondary !border-border-primary !rounded-lg"
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
