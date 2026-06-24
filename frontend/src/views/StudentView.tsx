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
      <Link
        to={`/klass/${s.klass_id}`}
        className="text-sm text-ink-soft hover:text-gbg-blue transition-colors"
      >
        ← Klass {s.klass_beteckning}
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-3 mt-1 mb-5">
        <h1 className="text-3xl font-semibold text-ink">
          {s.id}{" "}
          <span className="text-ink-faint font-normal text-2xl">
            · {gradeLabel(s.arskurs)} · {s.school_namn}
          </span>
        </h1>
        <Link
          to={`/elev/${s.id}/jamforelse`}
          className="px-4 py-2 bg-gbg-blue text-white rounded-md text-sm font-medium hover:bg-gbg-blue-dark transition-colors shadow-card"
        >
          Jämför: Dagens vs Modern uppföljning →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div
          className="rounded-lg p-5 text-white shadow-lift animate-rise-in"
          style={{ background: RISK_COLORS[s.current_risk_level] }}
        >
          <div className="text-2xs uppercase tracking-wider opacity-90">Aktuell risknivå</div>
          <div className="text-5xl font-display font-semibold tnum mt-1">
            {s.current_risk_level}
            <span className="text-2xl opacity-80">/3</span>
          </div>
          <div className="text-sm font-medium mt-0.5">{RISK_LABELS[s.current_risk_level]}</div>
        </div>
        <div
          className="rounded-lg border border-paper-line p-5 bg-paper-card shadow-card animate-rise-in"
          style={{ animationDelay: "70ms" }}
        >
          <div className="text-2xs uppercase tracking-wider text-ink-faint">Nästa lucka</div>
          {nextGap ? (
            <>
              <div className="text-xl font-display font-semibold text-ink mt-1">
                {nextGap.node_id} {nextGap.label_sv}
              </div>
              <div className="text-sm text-ink-soft mt-0.5 tnum">
                Bemästrad till {Math.round((nextGap.mastery ?? 0) * 100)}%
              </div>
            </>
          ) : (
            <div className="text-xl font-display font-semibold text-gbg-green-dark mt-1">
              Inga öppna luckor 🎉
            </div>
          )}
        </div>
        <div
          className="rounded-lg border border-paper-line p-5 bg-paper-card shadow-card animate-rise-in"
          style={{ animationDelay: "140ms" }}
        >
          <div className="text-2xs uppercase tracking-wider text-ink-faint">Åk 9-betyg</div>
          {s.provbetyg ? (
            <div className="flex gap-5 mt-2">
              <Betyg label="Prov" value={s.provbetyg} />
              <Betyg label="Slut" value={s.slutbetyg} />
            </div>
          ) : (
            <div className="text-sm text-ink-faint mt-2">Ännu ej i åk 9</div>
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
      <div className="text-2xs uppercase tracking-wider text-ink-faint mb-1">{label}</div>
      <div
        className="text-2xl font-display font-semibold w-11 h-11 rounded-md text-white flex items-center justify-center shadow-card"
        style={{ background: value ? BETYG_COLORS[value] ?? "#5a6573" : "#c9cfd6" }}
      >
        {value ?? "–"}
      </div>
    </div>
  );
}
