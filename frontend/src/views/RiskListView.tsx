import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import { ErrorBox, Loading, Section } from "../components/Section";
import { RISK_COLORS, RISK_LABELS, gradeLabel, riskColor } from "../ui";

const GRADES = Array.from({ length: 10 }, (_, i) => i); // 0..9

function RiskBadge({ level }: { level: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-0.5 text-xs font-semibold text-white"
      style={{ background: riskColor(level) }}
    >
      <span className="w-4 h-4 rounded-full bg-white/25 grid place-items-center text-2xs tnum">
        {level}
      </span>
      {RISK_LABELS[level]}
    </span>
  );
}

export default function RiskListView() {
  const [params, setParams] = useSearchParams();
  const risk = params.get("risk_level");
  const arskurs = params.get("arskurs");
  const school = params.get("school_id");

  // School names for the filter dropdown (cheap, cached by the browser).
  const overview = useFetch(() => api.huvudmanOverview(), []);

  const query = {
    risk_level: risk !== null ? Number(risk) : undefined,
    arskurs: arskurs !== null ? Number(arskurs) : undefined,
    school_id: school !== null ? Number(school) : undefined,
  };
  const list = useFetch(() => api.students(query), [risk, arskurs, school]);

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  const schools = overview.data?.schools ?? [];

  return (
    <div>
      <Link to="/" className="text-sm text-ink-soft hover:text-gbg-blue transition-colors">
        ← Huvudman
      </Link>
      <span className="block text-2xs uppercase tracking-[0.2em] text-gbg-blue font-semibold mt-2">
        Åtgärdslista
      </span>
      <h1 className="text-3xl sm:text-4xl font-semibold text-ink mb-1 mt-0.5">
        Elever som behöver uppmärksamhet
      </h1>
      <p className="text-ink-soft mb-5 max-w-2xl">
        Sorterat på aktuell risknivå. Varje elev leder till ett nästa steg – inte en stämpel. Klicka
        på en rad för elevkortet.
      </p>

      <Section title="Filter" subtitle="Risknivå bygger enbart på färdighetssignal.">
        <div className="flex flex-wrap gap-4">
          <Field label="Risknivå">
            <Select
              value={risk ?? ""}
              onChange={(v) => setFilter("risk_level", v)}
              options={[
                { value: "", label: "Alla nivåer" },
                { value: "3", label: "3 – Kritisk risk" },
                { value: "2", label: "2 – Förhöjd risk" },
                { value: "1", label: "1 – Bevaka" },
                { value: "0", label: "0 – Ingen risk" },
              ]}
            />
          </Field>
          <Field label="Årskurs">
            <Select
              value={arskurs ?? ""}
              onChange={(v) => setFilter("arskurs", v)}
              options={[
                { value: "", label: "Alla årskurser" },
                ...GRADES.map((g) => ({ value: String(g), label: gradeLabel(g) })),
              ]}
            />
          </Field>
          <Field label="Skola">
            <Select
              value={school ?? ""}
              onChange={(v) => setFilter("school_id", v)}
              options={[
                { value: "", label: "Alla skolor" },
                ...schools.map((s) => ({ value: String(s.school_id), label: s.namn })),
              ]}
            />
          </Field>
          {(risk || arskurs || school) && (
            <button
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="self-end text-sm text-gbg-blue hover:text-gbg-blue-dark underline underline-offset-2"
            >
              Rensa filter
            </button>
          )}
        </div>
      </Section>

      {list.loading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorBox error={list.error ?? "okänt fel"} />
      ) : (
        <Section
          title={`${list.data.length.toLocaleString("sv-SE")} elever`}
          subtitle="Visar de elever som matchar filtret, hårdast risk först."
        >
          {list.data.length === 0 ? (
            <p className="text-sm text-ink-soft">Inga elever matchar filtret.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-faint border-b border-paper-line">
                    {["Elev", "Klass", "Skola", "Årskurs", "Risknivå", "p(F i åk 9)", "Största luckor"].map(
                      (h) => (
                        <th
                          key={h}
                          className="py-2 pr-3 text-2xs uppercase tracking-wider font-semibold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((s, i) => (
                    <tr
                      key={s.id}
                      className="border-b border-paper-line/70 hover:bg-gbg-blue-light/10 transition-colors animate-sweep-in"
                      style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
                    >
                      <td className="py-2.5 pr-3">
                        <Link
                          to={`/elev/${s.id}`}
                          className="font-semibold text-ink hover:text-gbg-blue tnum"
                        >
                          {s.id}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-soft">{s.klass_beteckning}</td>
                      <td className="py-2.5 pr-3 text-ink-soft">{s.school_namn}</td>
                      <td className="py-2.5 pr-3 text-ink-soft tnum">{gradeLabel(s.arskurs)}</td>
                      <td className="py-2.5 pr-3">
                        <RiskBadge level={s.risk_level} />
                      </td>
                      <td className="py-2.5 pr-3">
                        <PFailBar value={s.p_fail_ak9} />
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="flex flex-wrap gap-1">
                          {s.top_missing_nodes.length === 0 ? (
                            <span className="text-ink-faint">–</span>
                          ) : (
                            s.top_missing_nodes.map((n) => (
                              <span
                                key={n}
                                className="px-1.5 py-0.5 rounded bg-paper border border-paper-line text-2xs text-ink-soft tnum"
                              >
                                {n}
                              </span>
                            ))
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-2xs uppercase tracking-wider font-semibold text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white border border-paper-line rounded-md px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gbg-blue min-w-[10rem]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PFailBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.66 ? RISK_COLORS[3] : value >= 0.4 ? RISK_COLORS[2] : value >= 0.2 ? RISK_COLORS[1] : RISK_COLORS[0];
  return (
    <span className="flex items-center gap-2">
      <span className="w-16 h-1.5 rounded-full bg-paper-line overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="tnum text-ink-soft text-xs w-9">{pct}%</span>
    </span>
  );
}
