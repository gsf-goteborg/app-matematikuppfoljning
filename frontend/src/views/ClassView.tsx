import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import GateStatusCards from "../components/GateStatusCards";
import MasteryHeatmap from "../components/MasteryHeatmap";
import { ErrorBox, Loading, Section } from "../components/Section";
import { gradeLabel } from "../ui";

export default function ClassView() {
  const { id } = useParams();
  const heatmap = useFetch(() => api.classHeatmap(id!), [id]);
  const focus = useFetch(() => api.classFocus(id!), [id]);

  if (heatmap.loading || focus.loading) return <Loading />;
  if (heatmap.error || !heatmap.data) return <ErrorBox error={heatmap.error ?? "okänt fel"} />;
  const h = heatmap.data;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        Klass {h.beteckning}{" "}
        <span className="text-slate-400 font-normal">
          · {gradeLabel(h.arskurs)} · {h.school_namn}
        </span>
      </h1>
      <p className="text-slate-500 mb-4">
        Lärarvyn: läs av läget – inga formulär att fylla i.
      </p>

      {focus.data && (
        <Section title="Grindstatus i klassen" subtitle="De tre kritiska grindarna.">
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
            <ul className="space-y-2">
              {focus.data.focus_groups.map((g) => (
                <li
                  key={g.node_id}
                  className={`rounded-lg border p-3 ${
                    g.is_gate ? "border-red-300 bg-red-50" : "border-slate-200"
                  }`}
                >
                  <div className="font-medium">
                    {g.is_gate && "⛳ "}
                    {g.rationale}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-1">
                    {g.student_ids.map((sid) => (
                      <Link
                        key={sid}
                        to={`/elev/${sid}`}
                        className="px-1.5 py-0.5 bg-white border rounded hover:bg-slate-100"
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

      <Section
        title="Mastery-heatmap"
        subtitle="Elever × kunskapsnoder. Klicka på en elev för elevkortet."
      >
        <MasteryHeatmap data={h} />
      </Section>
    </div>
  );
}
