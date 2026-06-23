import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { ErrorBox, Loading, Section } from "../components/Section";
import { gradeLabel } from "../ui";

export default function SchoolView() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(() => api.school(id!), [id]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "okänt fel"} />;

  const trend = data.cohort_trend.map((p) => ({
    grade: gradeLabel(p.arskurs),
    pct: Math.round(p.share_high_risk * 100),
    n: p.n,
  }));

  // Gate status grouped per gate node for a small multiples bar.
  const gateData = data.gate_status_by_grade.map((g) => ({
    label: `${g.node_id} ${gradeLabel(g.arskurs)}`,
    pct: Math.round(g.share_mastered * 100),
  }));

  return (
    <div>
      <Link to="/" className="text-sm text-slate-500 hover:underline">
        ← Huvudman
      </Link>
      <h1 className="text-2xl font-bold mb-1 mt-1">{data.namn}</h1>
      <p className="text-slate-500 mb-4">
        {data.n_students} elever · intag-index {data.intag_index.toFixed(2)} (endast
        likvärdighetsanalys) · F-andel åk 9:{" "}
        <span className="font-semibold text-slate-700">
          {Math.round(data.f_rate_ak9 * 100)}%
        </span>
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Kohorttrend – andel elever i förhöjd risk"
          subtitle="Per årskurs (risknivå ≥ 2). Stiger risken redan i mellanstadiet?"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, "Förhöjd risk"]} />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#dc2626"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Grindstatus per årskurs" subtitle="Andel som bemästrar grinden.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gateData} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, "Bemästrar"]} />
                <Bar dataKey="pct" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section title="Klasser som driver risk" subtitle="Sorterat på andel i förhöjd risk. Klicka för klassvy.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.classes_driving_risk.map((c) => (
            <Link
              key={c.klass_id}
              to={`/klass/${c.klass_id}`}
              className="rounded-lg border p-3 hover:bg-slate-50"
            >
              <div className="font-semibold">{c.beteckning}</div>
              <div className="text-xs text-slate-500">
                {gradeLabel(c.arskurs)} · {c.n} elever
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {Math.round(c.share_high_risk * 100)}%
              </div>
              <div className="text-xs text-slate-400">i förhöjd risk</div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
