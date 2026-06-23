import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import ProgressionGraph from "../components/ProgressionGraph";
import RiskTrajectory from "../components/RiskTrajectory";
import { ErrorBox, Loading, Section } from "../components/Section";
import { BETYG_COLORS, RISK_COLORS, RISK_LABELS, gradeLabel } from "../ui";

export default function StudentView() {
  const { id } = useParams();
  const card = useFetch(() => api.student(id!), [id]);
  const graph = useFetch(() => api.progressionGraph(), []);

  if (card.loading || graph.loading) return <Loading />;
  if (card.error || !card.data) return <ErrorBox error={card.error ?? "okänt fel"} />;
  const s = card.data;

  const gaps = s.node_mastery.filter((n) => n.status === "lucka");
  const nextGap = gaps[0];

  return (
    <div>
      <Link to={`/klass/${s.klass_id}`} className="text-sm text-slate-500 hover:underline">
        ← Klass {s.klass_beteckning}
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-2 mt-1 mb-4">
        <h1 className="text-2xl font-bold">
          {s.id}{" "}
          <span className="text-slate-400 font-normal">
            · {gradeLabel(s.arskurs)} · {s.school_namn}
          </span>
        </h1>
        <Link
          to={`/elev/${s.id}/jamforelse`}
          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-700"
        >
          Jämför: Dagens vs Modern uppföljning →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div
          className="rounded-xl p-4 text-white"
          style={{ background: RISK_COLORS[s.current_risk_level] }}
        >
          <div className="text-sm opacity-90">Aktuell risknivå</div>
          <div className="text-4xl font-bold">{s.current_risk_level}/3</div>
          <div className="text-sm">{RISK_LABELS[s.current_risk_level]}</div>
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-slate-500">Nästa lucka</div>
          {nextGap ? (
            <>
              <div className="text-xl font-semibold">
                {nextGap.node_id} {nextGap.label_sv}
              </div>
              <div className="text-sm text-slate-500">
                Bemästrad till {Math.round((nextGap.mastery ?? 0) * 100)}%
              </div>
            </>
          ) : (
            <div className="text-xl font-semibold text-green-700">Inga öppna luckor 🎉</div>
          )}
        </div>
        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-slate-500">Åk 9-betyg</div>
          {s.provbetyg ? (
            <div className="flex gap-4 mt-1">
              <Betyg label="Prov" value={s.provbetyg} />
              <Betyg label="Slut" value={s.slutbetyg} />
            </div>
          ) : (
            <div className="text-sm text-slate-400 mt-2">Ännu ej i åk 9</div>
          )}
        </div>
      </div>

      <Section title="Föreslagen åtgärd" subtitle="Varje röd siffra leder till ett nästa steg.">
        {s.suggested_focus.length === 0 ? (
          <p className="text-sm text-slate-500">Inga åtgärder behövs just nu.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {s.suggested_focus.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Risktrajektoria"
        subtitle="Risk 0–3 över årskurserna. Punktlinjen markerar förhöjd risk."
      >
        <RiskTrajectory trajectory={s.trajectory} />
      </Section>

      <Section
        title="Progressionsgraf"
        subtitle="Hela kunskaps-DAG:en. Röda kanter = bruten förkunskapskedja."
      >
        {graph.data && <ProgressionGraph graph={graph.data} mastery={s.node_mastery} />}
      </Section>
    </div>
  );
}

function Betyg({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div
        className="text-2xl font-bold w-10 h-10 rounded-lg text-white flex items-center justify-center"
        style={{ background: value ? BETYG_COLORS[value] ?? "#64748b" : "#cbd5e1" }}
      >
        {value ?? "–"}
      </div>
    </div>
  );
}
