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

const pct = (v: number) => `${Math.round(v * 100)}%`;

function closureColor(share: number): string {
  if (share >= 0.5) return "#6a9a1f"; // gbg-green
  if (share >= 0.3) return "#9ec038";
  if (share >= 0.2) return "#f9b000";
  return "#e8364a"; // gbg-red
}

/**
 * The loop KPIs. Closure rate is deliberately printed next to the detection
 * rate: on its own it rewards a school for finding fewer gaps.
 */
export function LoopStatBand({ loop }: { loop: LoopSummary }) {
  const stats = [
    {
      value: pct(loop.andel_stangda_inom_en_termin),
      label: "Luckor stängda inom en termin",
      sub: `${loop.n_stangda_inom_en_termin} av ${loop.n_bedomningsbara} bedömningsbara`,
      color: closureColor(loop.andel_stangda_inom_en_termin),
    },
    {
      value: `${loop.upptackta_per_100_elever}`,
      label: "Upptäckta luckor per 100 elever",
      sub: "Läses tillsammans med stängningsgraden",
      color: "#005293",
    },
    {
      value: pct(loop.andel_med_insats),
      label: "Har påbörjad insats",
      sub: `${pct(loop.andel_insats_i_tid)} inom fyra veckor`,
      color: loop.andel_med_insats < 0.35 ? "#f47815" : "#005293",
    },
    {
      value: `${loop.n_insats_saknas}`,
      label: "Saknar insats",
      sub: `${loop.n_ommatning_forsenad} väntar på försenad ommätning`,
      color: loop.n_insats_saknas > 0 ? "#e8364a" : "#6a9a1f",
    },
    {
      value:
        loop.median_dagar_till_stangning === null
          ? "–"
          : `${loop.median_dagar_till_stangning}`,
      label: "Dagar till stängning",
      sub: "Median, från upptäckt till bemästrad",
      color: "#5a6573",
    },
  ];

  return (
    <div className="bg-paper-card rounded-lg border border-paper-line shadow-card overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y divide-paper-line lg:divide-y-0 lg:divide-x">
        {stats.map((s, i) => (
          <div key={s.label} className="p-4 sm:p-5 animate-rise-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div
              className="font-display text-4xl font-semibold tnum leading-none"
              style={{ color: s.color }}
            >
              {s.value}
            </div>
            <div className="text-sm font-semibold text-ink mt-2">{s.label}</div>
            <div className="text-2xs text-ink-faint mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Where the gaps stand right now: found -> acted on -> re-measured -> closed. */
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
        Av {loop.n_stangda.toLocaleString("sv-SE")} stängda luckor stängdes{" "}
        <strong>{loop.n_stangda_med_insats.toLocaleString("sv-SE")}</strong> efter en registrerad
        insats och {loop.n_stangda_utan_insats.toLocaleString("sv-SE")} utan – och{" "}
        {loop.n_kvarstar.toLocaleString("sv-SE")} kvarstod efter ommätning.
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
