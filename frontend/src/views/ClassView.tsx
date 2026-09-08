import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import GateStatusCards from "../components/GateStatusCards";
import GapItem from "../components/LoopGap";
import MasteryHeatmap from "../components/MasteryHeatmap";
import { ErrorBox, Loading, Section } from "../components/Section";
import { gradeLabel } from "../ui";

export default function ClassView() {
  const { id } = useParams();
  const [version, setVersion] = useState(0);
  const heatmap = useFetch(() => api.classHeatmap(id!), [id]);
  const focus = useFetch(() => api.classFocus(id!), [id, version]);

  if (heatmap.loading || focus.loading) return <Loading />;
  if (heatmap.error || !heatmap.data) return <ErrorBox error={heatmap.error ?? "okänt fel"} />;
  const h = heatmap.data;

  return (
    <div>
      <span className="text-2xs uppercase tracking-[0.2em] text-gbg-blue font-semibold">
        Klassvy · Lärare
      </span>
      <h1 className="text-3xl sm:text-4xl font-semibold text-ink mb-1 mt-0.5">
        Klass {h.beteckning}{" "}
        <span className="text-ink-faint font-normal text-2xl">
          · {gradeLabel(h.arskurs)} · {h.school_namn}
        </span>
      </h1>
      <p className="text-ink-soft mb-5">
        Lärarvyn: läs av läget. Det enda som fylls i är två saker per lucka – att en insats
        påbörjats, och vad ommätningen visade.
      </p>

      {focus.data && (
        <Section title="Tröskelstatus i klassen" subtitle="De tre kritiska trösklarna.">
          <GateStatusCards gates={focus.data.gates} />
        </Section>
      )}

      {focus.data && (
        <Section
          title="Fokus denna vecka"
          subtitle="Konkret: vilka noder att repetera för vilka elever, innan nästa moment byggs på."
        >
          {focus.data.focus_groups.length === 0 ? (
            <p className="text-sm text-slate-500">
              Inga större gemensamma luckor just nu – klassen ligger bra till.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {focus.data.focus_groups.map((g, i) => (
                <li
                  key={g.node_id}
                  className={`rounded-lg border-l-4 p-3.5 animate-sweep-in ${
                    g.is_gate
                      ? "border-gbg-red bg-gbg-red-light/20"
                      : "border-paper-line bg-white"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="font-medium text-ink">
                    {g.is_gate && "⛳ "}
                    {g.rationale}
                  </div>
                  <div className="text-2xs mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-gbg-blue-dark font-semibold">
                      {g.n_med_insats} med påbörjad insats
                    </span>
                    {g.n_utan_insats > 0 && (
                      <span className="text-gbg-red-dark font-semibold">
                        {g.n_utan_insats} utan insats
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-2 flex flex-wrap gap-1.5">
                    {g.student_ids.map((sid) => (
                      <Link
                        key={sid}
                        to={`/elev/${sid}`}
                        className="px-2 py-0.5 bg-white border border-paper-line rounded-md text-ink-soft hover:border-gbg-blue hover:text-gbg-blue transition-colors tnum"
                      >
                        {sid}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {focus.data && focus.data.att_folja_upp.length > 0 && (
        <Section
          title="Att följa upp"
          subtitle="Sorterat efter vad som är mest angeläget: försenade ommätningar först." 
        >
          <ul className="space-y-3">
            {focus.data.att_folja_upp.map((g) => (
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

      <Section
        title="Mastery-heatmap"
        subtitle="Elever × kunskapsnoder. Klicka på en elev för elevkortet."
      >
        <MasteryHeatmap data={h} />
      </Section>
    </div>
  );
}
