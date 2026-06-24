import type { GateStatus } from "../api/client";

// The three gates summarised. Share mastered drives an official-palette colour.
function shareTheme(share: number): { bar: string; chip: string } {
  if (share >= 0.8) return { bar: "bg-gbg-green", chip: "bg-gbg-green/10 text-gbg-green-dark" };
  if (share >= 0.65)
    return { bar: "bg-gbg-orange-light", chip: "bg-gbg-orange-light/20 text-gbg-orange-dark" };
  if (share >= 0.5) return { bar: "bg-gbg-orange", chip: "bg-gbg-orange/10 text-gbg-orange-dark" };
  return { bar: "bg-gbg-red", chip: "bg-gbg-red-light/30 text-gbg-red-dark" };
}

export default function GateStatusCards({ gates }: { gates: GateStatus[] }) {
  if (gates.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Inga trösklar är mätbara för den här årskursen ännu.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {gates.map((g, i) => {
        const pct = Math.round(g.share_mastered * 100);
        const t = shareTheme(g.share_mastered);
        return (
          <div
            key={g.node_id}
            className="rounded-lg border border-paper-line bg-white p-4 shadow-card animate-rise-in"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xs uppercase tracking-wider text-ink-faint">
                Tröskel {g.node_id}
              </span>
              <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded ${t.chip}`}>
                {g.n_at_risk} i riskzon
              </span>
            </div>
            <div className="font-display font-semibold text-ink mt-0.5">{g.label_sv}</div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-display font-semibold tnum text-ink">{pct}</span>
              <span className="text-lg text-ink-faint">%</span>
            </div>
            <div className="text-xs text-ink-soft -mt-1">bemästrar</div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-paper-line overflow-hidden">
              <div
                className={`h-full rounded-full ${t.bar} transition-all duration-700`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-2xs text-ink-faint mt-1.5 tnum">
              {g.n_total - g.n_at_risk} av {g.n_total} elever
            </div>
          </div>
        );
      })}
    </div>
  );
}
