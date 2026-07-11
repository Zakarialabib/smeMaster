import { useEffect, useRef, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { WidgetHeader, WidgetSkeleton, WidgetError } from "./WidgetHelpers";
import { Share2 } from "lucide-react";
import { invokeCommand } from "@shared/services/db/invoke/command";

// ── Types ─────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  entity_type: string;
  label: string;
  group: string;
  // Runtime properties set by d3-force
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

const ENTITY_COLORS: Record<string, string> = {
  contact: "var(--color-info)",
  deal: "var(--color-success)",
  task: "var(--color-warning)",
  campaign: "var(--color-danger)",
  company: "var(--color-accent)",
};

const ENTITY_RADII: Record<string, number> = {
  contact: 8,
  deal: 6,
  task: 5,
  campaign: 6,
  company: 7,
};

function getNodeColor(entityType: string): string {
  return ENTITY_COLORS[entityType] ?? "var(--color-muted-foreground)";
}

function getNodeRadius(entityType: string): number {
  return ENTITY_RADII[entityType] ?? 5;
}

function formatLabel(id: string): string {
  // id is "entity_type:entity_id" — split and show just the type + short id
  const sep = id.indexOf(":");
  if (sep > 0) {
    const type = id.slice(0, sep);
    const entityId = id.slice(sep + 1);
    const shortId = entityId.length > 8 ? `${entityId.slice(0, 8)}...` : entityId;
    return `${type} ${shortId}`;
  }
  return id;
}

// ── Main Component ────────────────────────────────────────────────────────

export function EntityNetworkGraph() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Fetch graph data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await invokeCommand<GraphData>("db_get_entity_graph", {
          depth: 2,
        });
        if (!cancelled) {
          setGraphData(data);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAccountId]);

  // Run force simulation when graph data changes
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0 || !svgRef.current) return;

    const svg = svgRef.current;
    const width = svg.clientWidth || 400;
    const height = svg.clientHeight || 250;

    // Build typed arrays for d3-force — the library mutates node objects
    const nodes: GraphNode[] = graphData.nodes.map((n) => ({ ...n }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Map edges to use node references (d3-force expects objects, not strings)
    const edges = graphData.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        relationship: e.relationship,
      }));

    // Create the simulation
    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, { source: string; target: string }>(edges)
          .id((d) => d.id)
          .distance(80)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-250))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide<GraphNode>(30))
      .alphaDecay(0.02)
      .on("tick", () => {
        // Update SVG on each tick
        renderGraph(svg, nodes, edges);
      });

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  // Render SVG
  function renderGraph(
    svg: SVGSVGElement,
    nodes: GraphNode[],
    edges: { source: string; target: string; relationship: string }[],
  ) {
    // Clear previous render
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Edges
    const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode || sourceNode.x == null || targetNode.x == null) return;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(sourceNode.x));
      line.setAttribute("y1", String(sourceNode.y));
      line.setAttribute("x2", String(targetNode.x));
      line.setAttribute("y2", String(targetNode.y));
      line.setAttribute("stroke", "var(--color-border)");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("stroke-opacity", "0.5");
      edgeGroup.appendChild(line);
    });
    svg.appendChild(edgeGroup);

    // Nodes
    const nodeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodes.forEach((node) => {
      if (node.x == null) return;

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute(
        "transform",
        `translate(${node.x}, ${node.y})`,
      );

      // Circle
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      const r = getNodeRadius(node.entity_type);
      circle.setAttribute("r", String(r));
      circle.setAttribute("fill", getNodeColor(node.entity_type));
      circle.setAttribute("stroke", "var(--color-bg-primary)");
      circle.setAttribute("stroke-width", "1.5");
      circle.setAttribute("cursor", "pointer");
      circle.setAttribute("opacity", "0.85");

      circle.addEventListener("mouseenter", () => {
        circle.setAttribute("opacity", "1");
        circle.setAttribute("stroke-width", "2.5");
        setHoveredNode(node);
        const rect = svg.getBoundingClientRect();
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = node.x ?? 0;
        svgPoint.y = (node.y ?? 0) - r - 8;
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const screenPt = svgPoint.matrixTransform(ctm);
          setTooltipPos({
            x: screenPt.x - rect.left,
            y: screenPt.y - rect.top,
          });
        }
      });

      circle.addEventListener("mouseleave", () => {
        circle.setAttribute("opacity", "0.85");
        circle.setAttribute("stroke-width", "1.5");
        setHoveredNode(null);
      });

      g.appendChild(circle);

      // Label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("y", String(r + 10));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "var(--color-text-tertiary)");
      text.setAttribute("font-size", "8");
      text.setAttribute("font-family", "inherit");
      text.textContent = formatLabel(node.id);
      g.appendChild(text);

      nodeGroup.appendChild(g);
    });
    svg.appendChild(nodeGroup);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return <WidgetSkeleton />;

  if (error) {
    return (
      <div>
        <WidgetHeader icon={<Share2 size={16} />} title="Entity Network" />
        <WidgetError message={error} />
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div>
        <WidgetHeader icon={<Share2 size={16} />} title="Entity Network" />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Share2
            size={32}
            className="text-text-tertiary mb-2"
            strokeWidth={1.5}
          />
          <p className="text-xs text-text-tertiary max-w-[200px]">
            No entity relationships found. Connect contacts to deals and tasks
            to see your network.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <WidgetHeader icon={<Share2 size={16} />} title="Entity Network" />
      <svg
        ref={svgRef}
        className="w-full h-[300px] overflow-visible"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid meet"
      />
      {hoveredNode && (
        <div
          className="absolute pointer-events-none z-10 bg-bg-primary border border-border-primary rounded-md px-2 py-1 text-xs shadow-lg"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-medium text-text-primary">
            {hoveredNode.entity_type}
          </p>
          <p className="text-text-tertiary">{hoveredNode.label}</p>
        </div>
      )}
      {graphData && (
        <p className="text-[0.625rem] text-text-tertiary mt-1 text-center">
          {graphData.nodes.length} nodes, {graphData.edges.length} edges
        </p>
      )}
    </div>
  );
}
