import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";
import RiskTrajectory from "../components/RiskTrajectory";
import { ErrorBox, Loading } from "../components/Section";
import { BETYG_COLORS, gradeLabel } from "../ui";

export default function ComparisonView() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(() => api.comparison(id!), [id]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "okänt fel"} />;

  const today = data.todays_view;
  const modern = data.modern_view;

  return (
    <div>
      <Link to={`/elev/${data.student_id}`} className="text-sm text-slate-500 hover:underline">
        ← Elevkort {data.student_id}
      </Link>
      <h1 className="text-2xl font-bold mt-1">Dagens vs Modern uppföljning</h1>
      <p className="text-slate-500 mb-4">
        Samma elev ({data.student_id}), två sätt att se. Detta är poängen med hela verktyget.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---- Today's view ---- */}
        <div className="rounded-xl border-2 border-slate-300 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-700">Dagens uppföljning</h2>
          <p className="text-sm text-slate-500 mb-4">{today.beskrivning}</p>

          <div className="flex items-end gap-1 h-40 border-b border-slate-200 pb-0">
            {today.timeline.map((t) => {
              const isFinal = t.arskurs === 9;
              return (
                <div key={t.arskurs} className="flex-1 flex flex-col items-center justify-end h-full">
                  {isFinal && today.provbetyg && (
                    <div
                      className="w-full rounded-t flex items-center justify-center text-white font-bold text-xl"
                      style={{
                        height: "70%",
                        background: BETYG_COLORS[today.provbetyg] ?? "#64748b",
                      }}
                    >
                      {today.provbetyg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 text-[10px] text-slate-400 mt-1">
            {today.timeline.map((t) => (
              <div key={t.arskurs} className="flex-1 text-center">
                {gradeLabel(t.arskurs)}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            Ett <b>{today.provbetyg ?? "F"}</b> dyker upp i åk 9 – utan förvarning. Inga
            leading indicators, ingen åtgärd i tid.
          </div>
        </div>

        {/* ---- Modern view ---- */}
        <div className="rounded-xl border-2 border-emerald-400 bg-white p-5">
          <h2 className="text-lg font-semibold text-emerald-800">Modern uppföljning</h2>
          <p className="text-sm text-slate-500 mb-4">{modern.beskrivning}</p>

          <RiskTrajectory trajectory={modern.trajectory} />

          {modern.first_red_grade !== null && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-900">
              Risken syntes redan i <b>{gradeLabel(modern.first_red_grade)}</b>
              {modern.missing_node_label && (
                <>
                  {" "}
                  – saknad nod: <b>{modern.missing_node_label}</b> ({modern.missing_node})
                </>
              )}
              .
              {modern.suggested_action && (
                <div className="mt-2 text-emerald-800">
                  💡 Åtgärd som hade kunnat sättas in: {modern.suggested_action}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Risken byggde uteslutande på färdighetssignal – aldrig på elevens bakgrund.
          </p>
        </div>
      </div>

      <div className="mt-4 text-center text-slate-600 text-sm">
        {modern.first_red_grade !== null && (
          <>
            Skillnaden:{" "}
            <b>{9 - modern.first_red_grade} år</b> tidigare varning i den moderna vyn.
          </>
        )}
      </div>
    </div>
  );
}
