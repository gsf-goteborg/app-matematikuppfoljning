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
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { EquityPoint, KommunKpi } from "../api/client";
import { useFetch } from "../useFetch";
import AlertsPanel from "../components/AlertsPanel";
import { LoopTerminChart } from "../components/LoopStats";
import SchoolComparison from "../components/SchoolComparison";
import { ErrorBox, Loading, Section } from "../components/Section";

function KpiBand({ kpi }: { kpi: KommunKpi }) {
  const stats = [
    {
      value: kpi.n_students.toLocaleString("sv-SE"),
      label: "Elever följs",
      sub: `${kpi.n_schools} skolor · FK–Åk9`,
      accent: "text-gbg-blue",
      to: "/risk",
    },
    {
      value: kpi.n_critical.toLocaleString("sv-SE"),
      label: "I kritisk risk",
      sub: "Risknivå 3 – kräver åtgärd",
      accent: "text-gbg-red",
      to: "/risk?risk_level=3",
    },
    {
      value: `${Math.round(kpi.share_elevated * 100)}%`,
      label: "I förhöjd risk",
      sub: `${kpi.n_elevated.toLocaleString("sv-SE")} elever (nivå ≥ 2)`,
      accent: "text-gbg-orange-dark",
      to: "/risk",
    },
    {
      value: `${Math.round(kpi.andel_stangda_inom_en_termin * 100)}%`,
      label: "Luckor stängda inom en termin",
      sub: `${kpi.n_utan_insats.toLocaleString("sv-SE")} väntar på en insats`,
      accent:
        kpi.andel_stangda_inom_en_termin >= 0.4
          ? "text-gbg-green-dark"
          : kpi.andel_stangda_inom_en_termin >= 0.25
            ? "text-gbg-orange-dark"
            : "text-gbg-red",
      to: null,
    },
    {
      value: `${Math.round(kpi.f_rate_ak9 * 100)}%`,
      label: "F-andel åk 9",
      sub: "Syns först när det är för sent",
      accent: "text-ink",
      to: null,
    },
    {
      value: `${kpi.schools_with_gate_gap}`,
      label: "Skolor med tröskellucka",
      sub: "Systematisk N12-miss",
      accent: kpi.schools_with_gate_gap > 0 ? "text-gbg-red" : "text-gbg-green-dark",
      to: null,
    },
  ];
  return (
    <div className="bg-paper-card rounded-lg border border-paper-line shadow-card mb-5 overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y divide-paper-line lg:divide-y-0 lg:divide-x">
        {stats.map((s, i) => {
          const body = (
            <>
              <div className={`font-display text-4xl font-semibold tnum leading-none ${s.accent}`}>
                {s.value}
              </div>
              <div className="text-sm font-semibold text-ink mt-2 flex items-center gap-1">
                {s.label}
                {s.to && (
                  <span className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                )}
              </div>
              <div className="text-2xs text-ink-faint mt-0.5">{s.sub}</div>
            </>
          );
          const cls = "block p-4 sm:p-5 animate-rise-in";
          const style = { animationDelay: `${i * 60}ms` };
          return s.to ? (
            <Link
              key={s.label}
              to={s.to}
              className={`${cls} group hover:bg-gbg-blue-light/10 transition-colors`}
              style={style}
            >
              {body}
            </Link>
          ) : (
            <div key={s.label} className={cls} style={style}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EquityChart({ points, title }: { points: EquityPoint[]; title: string }) {
  const data = points.map((p) => ({ ...p, pct: Math.round(p.f_rate * 100) }));
  return (
    <div>
      <h3 className="text-2xs uppercase tracking-wider font-semibold text-ink-soft mb-2">
        {title}
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d4" />
            <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#5a6573" }} />
            <YAxis tick={{ fontSize: 11, fill: "#5a6573" }} unit="%" />
            <Tooltip
              formatter={(v: number) => [`${v}%`, "F-andel"]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e4e0d4",
                fontSize: 12,
              }}
            />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill="#7f3f98" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function HuvudmanView() {
  const { data, loading, error } = useFetch(() => api.huvudmanOverview(), []);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "okänt fel"} />;

  return (
    <div>
      <div className="mb-6">
        <span className="text-2xs uppercase tracking-[0.2em] text-gbg-blue font-semibold">
          Huvudmannaöversikt
        </span>
        <h1 className="text-3xl sm:text-4xl font-semibold text-ink mt-1 leading-tight">
          {data.huvudman_namn}
        </h1>
        <p className="text-ink-soft mt-1.5 max-w-2xl">
          Kontinuerlig matematikuppföljning FK–Åk9. Fokus: var i kunskapskedjan eleverna är – inte
          bara slutbetyget.
        </p>
      </div>

      <KpiBand kpi={data.kpi} />

      <Section
        title="Sluts loopen?"
        subtitle="Andel upptäckta luckor som stängs inom en termin, per den termin de upptäcktes."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoopTerminChart points={data.loop_by_termin} />
          <div className="text-sm text-ink-soft space-y-2">
            <p>
              <strong className="text-ink">Så läser du talet.</strong> En hög stängningsgrad är
              trovärdig bara tillsammans med en rimlig upptäcktsgrad – en skola som hittar få
              luckor kan se ut att stänga nästan alla. Båda talen står bredvid varandra i
              skoljämförelsen nedan.
            </p>
            <p>
              Nämnaren är{" "}
              <span className="tnum">{data.loop.n_bedomningsbara.toLocaleString("sv-SE")}</span>{" "}
              luckor hos{" "}
              <span className="tnum">
                {data.loop.n_elever_bedomningsbara.toLocaleString("sv-SE")}
              </span>{" "}
              elever. Luckor som upptäckts den här terminen räknas inte in ännu – de har inte haft
              en hel termin på sig.
            </p>
            <p>
              En registrerad insats sänker aldrig en elevs risk. Bara en ommätning gör det.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Skoljämförelse – trösklar & F-andel"
        subtitle="Grön = stark genomströmning, röd = systematisk lucka. Klicka för skolvy."
      >
        <SchoolComparison schools={data.schools} />
      </Section>

      <Section title="Systemvarningar" subtitle="Tidiga signaler – inte slutbetyg i efterhand.">
        <AlertsPanel alerts={data.alerts} />
      </Section>

      <Section
        title="Likvärdighet (analys – ej riskinput)"
        subtitle="Systemet ser mönstret mot elevunderlag och socioekonomi, men använder det aldrig för att förutsäga en enskild elevs risk."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EquityChart points={data.equity_by_intag} title="F-andel per elevunderlag (skola)" />
          <EquityChart points={data.equity_by_ses} title="F-andel per socioekonomisk kategori" />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Elevunderlag är ett index för hur gynnsam skolans socioekonomiska elevsammansättning är
          (syntetiskt i demon). En skola med systematisk tröskellucka kan ha hög F-andel oberoende
          av elevunderlag – det är en undervisnings- och systemfråga, inte en elevbakgrundsfråga.
        </p>
      </Section>
    </div>
  );
}
