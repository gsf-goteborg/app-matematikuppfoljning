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
import { api } from "../api/client";
import type { EquityPoint } from "../api/client";
import { useFetch } from "../useFetch";
import AlertsPanel from "../components/AlertsPanel";
import SchoolComparison from "../components/SchoolComparison";
import { ErrorBox, Loading, Section } from "../components/Section";

function EquityChart({ points, title }: { points: EquityPoint[]; title: string }) {
  const data = points.map((p) => ({ ...p, pct: Math.round(p.f_rate * 100) }));
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-600 mb-1">{title}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v: number) => [`${v}%`, "F-andel"]} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill="#64748b" />
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
      <h1 className="text-2xl font-bold mb-1">{data.huvudman_namn} – huvudmannaöversikt</h1>
      <p className="text-slate-500 mb-4">
        Kontinuerlig matematikuppföljning FK–Åk9. Fokus: var i kunskapskedjan eleverna är – inte
        bara slutbetyget.
      </p>

      <Section
        title="Skoljämförelse – grindar & F-andel"
        subtitle="Grön = stark genomströmning, röd = systematisk lucka. Klicka för skolvy."
      >
        <SchoolComparison schools={data.schools} />
      </Section>

      <Section title="Systemvarningar" subtitle="Leading indicators, inte slutbetyg.">
        <AlertsPanel alerts={data.alerts} />
      </Section>

      <Section
        title="Likvärdighet (analys – ej riskinput)"
        subtitle="Systemet ser mönstret mot intag och socioekonomi, men använder det aldrig för att förutsäga en enskild elevs risk."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EquityChart points={data.equity_by_intag} title="F-andel per intagsnivå" />
          <EquityChart points={data.equity_by_ses} title="F-andel per socioekonomisk kategori" />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Notera: en skola med systematisk grind-lucka (t.ex. proportionalitet) kan ha hög F-andel
          oberoende av intag – det är en undervisnings- och systemfråga, inte en elevbakgrundsfråga.
        </p>
      </Section>
    </div>
  );
}
