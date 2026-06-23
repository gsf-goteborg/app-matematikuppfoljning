import { useMemo } from "react";
import {
  Background,
  Controls,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { NodeMastery, ProgressionGraph as Graph } from "../api/client";
import { STATUS_COLORS, STATUS_LABELS } from "../ui";

// Approximate column (≈ introduction grade) per node, for left-to-right layout.
const GRADE_BAND_COL: Record<string, number> = {
  FK: 0,
  "1–3": 1,
  "4–6": 2,
  "5–6": 2,
  "7": 3,
  "7–8": 3,
  "8": 4,
  "7–9": 4,
  "8–9": 4,
  "9": 5,
};

interface Props {
  graph: Graph;
  mastery: NodeMastery[];
}

export default function ProgressionGraph({ graph, mastery }: Props) {
  const statusById = useMemo(() => {
    const m: Record<string, NodeMastery> = {};
    for (const nm of mastery) m[nm.node_id] = nm;
    return m;
  }, [mastery]);

  const { nodes, edges } = useMemo(() => {
    // Lay out nodes in columns by grade band, stacking within a column.
    const colCounts: Record<number, number> = {};
    const rfNodes: Node[] = graph.nodes.map((n) => {
      const col = GRADE_BAND_COL[n.grade_band] ?? 2;
      const row = colCounts[col] ?? 0;
      colCounts[col] = row + 1;
      const st = statusById[n.id];
      const status = st?.status ?? "omatt";
      const isGate = n.is_gate;
      return {
        id: n.id,
        position: { x: col * 210, y: row * 78 },
        data: {
          label: `${n.id} ${n.label_sv}${isGate ? " ⛳" : ""}`,
        },
        style: {
          background: STATUS_COLORS[status],
          color: status === "omatt" ? "#475569" : "#fff",
          border: isGate ? "3px solid #0f172a" : "1px solid #94a3b8",
          borderRadius: 8,
          fontSize: 10,
          width: 180,
          padding: 6,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const rfEdges: Edge[] = graph.edges.map((e) => {
      const childStatus = statusById[e.node_id]?.status;
      const prereqStatus = statusById[e.prereq_id]?.status;
      const broken = prereqStatus === "lucka" && (childStatus === "blockerad" || childStatus === "lucka");
      return {
        id: `${e.prereq_id}-${e.node_id}`,
        source: e.prereq_id,
        target: e.node_id,
        animated: broken,
        style: { stroke: broken ? "#dc2626" : "#cbd5e1", strokeWidth: broken ? 2 : 1 },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, statusById]);

  return (
    <div className="h-[480px] w-full border rounded-lg bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs px-3 py-2 border-t bg-slate-50">
      {(["bemastrad", "lucka", "blockerad", "omatt"] as const).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS[s] }} />
          {STATUS_LABELS[s]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm border-2 border-slate-900" /> Grind
      </span>
    </div>
  );
}
