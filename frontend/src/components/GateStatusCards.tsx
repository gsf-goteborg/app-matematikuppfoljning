import type { GateStatus } from "../api/client";

// The three gates summarised. Share mastered drives a colour.
function shareColor(share: number): string {
  if (share >= 0.8) return "bg-green-100 border-green-300 text-green-900";
  if (share >= 0.65) return "bg-yellow-100 border-yellow-300 text-yellow-900";
  if (share >= 0.5) return "bg-orange-100 border-orange-300 text-orange-900";
  return "bg-red-100 border-red-300 text-red-900";
}

export default function GateStatusCards({ gates }: { gates: GateStatus[] }) {
  if (gates.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Inga grindar är mätbara för den här årskursen ännu.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {gates.map((g) => (
        <div key={g.node_id} className={`rounded-lg border p-3 ${shareColor(g.share_mastered)}`}>
          <div className="text-xs uppercase tracking-wide opacity-70">Grind {g.node_id}</div>
          <div className="font-semibold">{g.label_sv}</div>
          <div className="text-3xl font-bold mt-1">{Math.round(g.share_mastered * 100)}%</div>
          <div className="text-xs mt-1">
            bemästrar · {g.n_at_risk} av {g.n_total} elever i riskzon
          </div>
        </div>
      ))}
    </div>
  );
}
