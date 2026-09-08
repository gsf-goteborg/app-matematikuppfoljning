import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LoopSummary, LoopTerminPoint } from "../api/client";

function closureColor(share: number): string {
  if (share >= 0.5) return "#6a9a1f"; // gbg-green
  if (share >= 0.3) return "#9ec038";
  if (share >= 0.2) return "#f9b000";
  return "#e8364a"; // gbg-red
}

/**
 * The headline and its companion, and nothing else. Closure rate on its own
 * rewards a school for finding fewer gaps, so the detection rate is never more
 * than a line away from it.
 */
export function LoopHeadline({ loop }: { loop: LoopSummary }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      <div>
        <div
          className="font-display text-5xl font-semibold tnum leading-none"
          style={{ color: closureColor(loop.andel_stangda_inom_en_termin) }}
        >
          {Math.round(loop.andel_stangda_inom_en_termin * 100)}%
        </div>
        <div className="text-sm font-semibold text-ink mt-2">
          av upptäckta luckor stängs inom en termin
        </div>
        <div className="text-2xs text-ink-faint mt-0.5 tnum">
          {loop.n_stangda_inom_en_termin.toLocaleString("sv-SE")} av{" "}
          {loop.n_bedomningsbara.toLocaleString("sv-SE")} luckor, hos{" "}
          {loop.n_elever_bedomningsbara.toLocaleString("sv-SE")} elever
        </div>
      </div>
      <div>
        <div className="font-display text-5xl font-semibold tnum leading-none text-gbg-blue">
          {loop.upptackta_per_100_elever.toLocaleString("sv-SE")}
        </div>
        <div className="text-sm font-semibold text-ink mt-2">
          upptäckta luckor per 100 elever
        </div>
        <div className="text-2xs text-ink-faint mt-0.5">
          Läses tillsammans med talet till vänster
        </div>
      </div>
      {loop.n_utan_insats > 0 && (
        <div>
          <div className="font-display text-5xl font-semibold tnum leading-none text-gbg-red">
            {loop.n_utan_insats.toLocaleString("sv-SE")}
          </div>
          <div className="text-sm font-semibold text-ink mt-2">luckor väntar på en insats</div>
          <div className="text-2xs text-ink-faint mt-0.5 tnum">
            {loop.n_ommatning_forsenad.toLocaleString("sv-SE")} väntar på en försenad ommätning
          </div>
        </div>
      )}
    </div>
  );
}

/** Where the gaps stand: found -> acted on -> re-measured -> closed. */
export function LoopFunnel({ loop }: { loop: LoopSummary }) {
  const steps = [
    { label: "Upptäckta", n: loop.n_luckor, color: "#005293" },
    { label: "Insats påbörjad", n: loop.n_med_insats, color: "#0073bc" },
    { label: "Ommätta", n: loop.n_ommatta, color: "#9ec038" },
    { label: "Stängda", n: loop.n_stangda, color: "#6a9a1f" },
  ];
  const max = Math.max(1, loop.n_luckor);
  return (
    <div>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-sm text-ink-soft">{s.label}</span>
            <div className="flex-1 h-6 bg-paper-line/40 rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center justify-end pr-2 text-2xs font-semibold text-white transition-all"
                style={{ width: `${Math.max(4, (s.n / max) * 100)}%`, background: s.color }}
              >
                {s.n.toLocaleString("sv-SE")}
              </div>
            </div>
            <span className="w-12 text-right text-2xs text-ink-faint tnum">
              {Math.round((s.n / max) * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-2xs text-ink-soft mt-3">
        Tappet mellan stegen är där loopen brister. {loop.n_kvarstar.toLocaleString("sv-SE")}{" "}
        luckor kvarstod efter ommätning.
      </p>
    </div>
  );
}

/** Closure rate per detection term -- is the loop tightening or slipping? */
export function LoopTerminChart({ points }: { points: LoopTerminPoint[] }) {
  const data = points.map((p) => ({
    ...p,
    pct: Math.round(p.andel_stangda_inom_en_termin * 100),
  }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d4" />
          <XAxis dataKey="termin" tick={{ fontSize: 11, fill: "#5a6573" }} />
          <YAxis tick={{ fontSize: 11, fill: "#5a6573" }} unit="%" domain={[0, 100]} />
          <Tooltip
            formatter={(v: number, _n, item) => [
              `${v}% (${item.payload.n_luckor} luckor)`,
              "Stängda inom en termin",
            ]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e0d4", fontSize: 12 }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={closureColor(d.andel_stangda_inom_en_termin)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
