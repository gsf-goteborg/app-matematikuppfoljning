import { useState } from "react";
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
import GapItem from "../components/LoopGap";
import { LoopFunnel, LoopStatBand, LoopTerminChart } from "../components/LoopStats";
import { ErrorBox, Loading, Section } from "../components/Section";
import { gradeLabel } from "../ui";

export default function SchoolView() {
  const { id } = useParams();
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useFetch(() => api.school(id!), [id, version]);

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
      <Link to="/" className="text-sm text-ink-soft hover:text-gbg-blue transition-colors">
        ← Huvudman
      </Link>
      <span className="block text-2xs uppercase tracking-[0.2em] text-gbg-blue font-semibold mt-2">
        Skola
      </span>
      <h1 className="text-3xl sm:text-4xl font-semibold text-ink mb-1 mt-0.5">{data.namn}</h1>
      <p className="text-ink-soft mb-5 tnum">
        {data.n_students} elever · intag-index {data.intag_index.toFixed(2)} (endast
        likvärdighetsanalys) · F-andel åk 9:{" "}
        <span className="font-semibold text-ink">{Math.round(data.f_rate_ak9 * 100)}%</span>
      </p>

      <div className="mb-5">
        <LoopStatBand loop={data.loop} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Luckflöde"
          subtitle="Från upptäckt till stängd. Tappet mellan stegen är där loopen brister."
        >
          <LoopFunnel loop={data.loop} />
        </Section>

        <Section
          title="Stängda inom en termin"
          subtitle="Per upptäcktstermin – sluts loopen tätare över tid, eller glider den?"
        >
          <LoopTerminChart points={data.loop_by_termin} />
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Kohorttrend – andel elever i förhöjd risk"
          subtitle="Per årskurs (risknivå ≥ 2). Stiger risken redan i mellanstadiet?"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d4" />
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: "#5a6573" }} />
                <YAxis tick={{ fontSize: 12, fill: "#5a6573" }} unit="%" />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Förhöjd risk"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e4e0d4", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#e8364a"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#e8364a" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Tröskelstatus per årskurs" subtitle="Andel som bemästrar tröskeln.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gateData} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d4" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5a6573" }} />
                <YAxis tick={{ fontSize: 12, fill: "#5a6573" }} unit="%" />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, "Bemästrar"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e4e0d4", fontSize: 12 }}
                />
                <Bar dataKey="pct" fill="#005293" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {data.att_folja_upp.length > 0 && (
        <Section
          title="Luckor som står still"
          subtitle="Försenade ommätningar och luckor utan påbörjad insats – det rektor kan göra något åt idag."
        >
          <ul className="space-y-3">
            {data.att_folja_upp.map((g) => (
              <GapItem
                key={g.id}
                gap={g}
                showStudent
                onUpdated={() => setVersion((v) => v + 1)}
              />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Klasser som driver risk" subtitle="Sorterat på andel i förhöjd risk. Klicka för klassvy.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.classes_driving_risk.map((c) => (
            <Link
              key={c.klass_id}
              to={`/klass/${c.klass_id}`}
              className="rounded-lg border border-paper-line bg-white p-3.5 hover:border-gbg-blue hover:shadow-card transition-all group"
            >
              <div className="font-display font-semibold text-ink group-hover:text-gbg-blue transition-colors">
                {c.beteckning}
              </div>
              <div className="text-xs text-ink-soft tnum">
                {gradeLabel(c.arskurs)} · {c.n} elever
              </div>
              <div className="text-3xl font-display font-semibold text-gbg-red mt-1.5 tnum">
                {Math.round(c.share_high_risk * 100)}%
              </div>
              <div className="text-2xs uppercase tracking-wider text-ink-faint">i förhöjd risk</div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
