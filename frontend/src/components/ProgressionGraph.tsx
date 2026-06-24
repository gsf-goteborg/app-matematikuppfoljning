import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Position,
  ReactFlow,
  ReactFlowProvider,
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

  // Trace the cascade: every node strictly downstream of a gap ("lucka") is
  // blocked *because* the chain broke upstream. This is the whole pedagogical
  // point, so we make that path dominate the picture.
  const { gapNodes, cascade } = useMemo(() => {
    const childrenOf: Record<string, string[]> = {};
    for (const e of graph.edges) (childrenOf[e.prereq_id] ??= []).push(e.node_id);
    const gaps = graph.nodes
      .filter((n) => statusById[n.id]?.status === "lucka")
      .map((n) => n.id);
    const down = new Set<string>();
    const queue = [...gaps];
    while (queue.length) {
      const id = queue.shift()!;
      for (const c of childrenOf[id] ?? []) {
        if (!down.has(c)) {
          down.add(c);
          queue.push(c);
        }
      }
    }
    return { gapNodes: new Set(gaps), cascade: down };
  }, [graph, statusById]);

  const cascadeBlocked = useMemo(
    () => [...cascade].filter((id) => statusById[id]?.status === "blockerad").length,
    [cascade, statusById]
  );

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
      const isGap = gapNodes.has(n.id);
      const inCascade = cascade.has(n.id);
      const affected = isGap || inCascade;
      // When a cascade exists, recede everything that isn't part of it.
      const dim = cascade.size > 0 && !affected;
      return {
        id: n.id,
        position: { x: col * 210, y: row * 78 },
        // Explicit dimensions so edge geometry renders even before the
        // container is measured (avoids the client-nav init race, error#004).
        width: 180,
        height: 48,
        data: {
          label: `${isGap ? "⚠ " : ""}${n.id} ${n.label_sv}${isGate ? " ⛳" : ""}`,
        },
        style: {
          background: STATUS_COLORS[status],
          color: status === "omatt" ? "#475569" : "#fff",
          border: isGap
            ? "3px solid #e8364a"
            : isGate
              ? "3px solid #00395f"
              : "1px solid #94a3b8",
          boxShadow: isGap ? "0 0 0 4px rgba(232,54,74,0.25)" : undefined,
          borderRadius: 8,
          fontSize: 10,
          width: 180,
          padding: 6,
          opacity: dim ? 0.35 : 1,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    const rfEdges: Edge[] = graph.edges.map((e) => {
      // An edge is "broken" if it feeds a cascade node from a gap/cascade source.
      const broken =
        cascade.has(e.node_id) && (gapNodes.has(e.prereq_id) || cascade.has(e.prereq_id));
      const dim = cascade.size > 0 && !broken;
      return {
        id: `${e.prereq_id}-${e.node_id}`,
        source: e.prereq_id,
        target: e.node_id,
        animated: broken,
        style: {
          stroke: broken ? "#e8364a" : "#cbd5e1",
          strokeWidth: broken ? 2.5 : 1,
          opacity: dim ? 0.4 : 1,
        },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, statusById, gapNodes, cascade]);

  // Signature of the current colouring; changes when we switch students so the
  // uncontrolled ReactFlow remounts with fresh node/edge data.
  const signature = useMemo(
    () => mastery.map((m) => `${m.node_id}:${m.status}`).join("|"),
    [mastery]
  );

  const hasCascade = gapNodes.size > 0;

  // Mount ReactFlow only after the first layout pass so its container has a
  // measured size — otherwise edges/fitView silently fail on client-side nav.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // useEffect runs after the DOM is committed, so the 440px container is
    // already laid out and ReactFlow will measure a non-zero size.
    setReady(true);
  }, []);

  return (
    <div className="w-full border border-paper-line rounded-lg bg-white overflow-hidden">
      <div
        className={`px-4 py-2.5 text-sm border-b ${
          hasCascade
            ? "bg-gbg-red-light/20 border-gbg-red/30 text-ink"
            : "bg-gbg-green/10 border-gbg-green/30 text-ink"
        }`}
      >
        {hasCascade ? (
          <span>
            <b className="text-gbg-red-dark">
              {gapNodes.size} {gapNodes.size === 1 ? "bruten förkunskap" : "brutna förkunskaper"}
            </b>
            {cascadeBlocked > 0 && (
              <>
                {" "}
                blockerar <b>{cascadeBlocked} ej ännu mätta moment</b> nedströms
              </>
            )}
            . Den röda kedjan visar hur en lucka fortplantar sig nedströms mot algebra och åk 9.
          </span>
        ) : (
          <span>
            <b className="text-gbg-green-dark">Kedjan håller.</b> Inga brutna förkunskaper – inget
            nedströms blockeras.
          </span>
        )}
      </div>
      <div className="h-[440px] w-full" style={{ height: 440 }}>
        {ready && (
          <ReactFlowProvider>
            <ReactFlow
              key={signature}
              nodes={nodes}
              edges={edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e4e0d4" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs px-3 py-2 border-t border-paper-line bg-paper text-ink-soft">
      {(["bemastrad", "lucka", "blockerad", "omatt"] as const).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS[s] }} />
          {STATUS_LABELS[s]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm border-2 border-gbg-blue-dark" /> Tröskel ⛳
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm" style={{ boxShadow: "0 0 0 2px rgba(232,54,74,0.4)", background: "#e8364a" }} />
        ⚠ Bruten förkunskap
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-5 border-t-2 border-gbg-red" /> Kaskad nedströms
      </span>
    </div>
  );
}
