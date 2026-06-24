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
      <Link
        to={`/elev/${data.student_id}`}
        className="text-sm text-ink-soft hover:text-gbg-blue transition-colors"
      >
        ← Elevkort {data.student_id}
      </Link>
      <h1 className="text-3xl sm:text-4xl font-semibold text-ink mt-1.5">
        Dagens <span className="text-ink-faint">vs</span> Modern uppföljning
      </h1>
      <p className="text-ink-soft mb-6 tnum">
        Samma elev ({data.student_id}), två sätt att se. Detta är poängen med hela verktyget.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ---- Today's view ---- */}
        <div className="rounded-xl border border-paper-line bg-white p-6 animate-rise-in">
          <span className="text-2xs uppercase tracking-[0.18em] text-ink-faint font-semibold">
            Idag
          </span>
          <h2 className="font-display text-xl font-semibold text-ink-soft mt-0.5">
            Dagens uppföljning
          </h2>
          <p className="text-sm text-ink-soft mb-4">{today.beskrivning}</p>

          <div className="flex items-end gap-1 h-40 border-b border-paper-line pb-0">
            {today.timeline.map((t) => {
              const isFinal = t.arskurs === 9;
              return (
                <div key={t.arskurs} className="flex-1 flex flex-col items-center justify-end h-full">
                  {isFinal && today.provbetyg ? (
                    <div
                      className="w-full rounded-t flex items-center justify-center text-white font-display font-semibold text-xl shadow-card"
                      style={{
                        height: "70%",
                        background: BETYG_COLORS[today.provbetyg] ?? "#5a6573",
                      }}
                    >
                      {today.provbetyg}
                    </div>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-paper-line" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 text-2xs text-ink-faint mt-1.5 tnum">
            {today.timeline.map((t) => (
              <div key={t.arskurs} className="flex-1 text-center">
                {gradeLabel(t.arskurs)}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3.5 bg-gbg-red-light/25 border-l-4 border-gbg-red rounded-r text-sm text-ink">
            Ett <b>{today.provbetyg ?? "F"}</b> dyker upp i åk 9 – utan förvarning. Inga leading
            indicators, ingen åtgärd i tid.
          </div>
        </div>

        {/* ---- Modern view ---- */}
        <div
          className="rounded-xl border-2 border-gbg-green bg-white p-6 shadow-lift animate-rise-in"
          style={{ animationDelay: "100ms" }}
        >
          <span className="text-2xs uppercase tracking-[0.18em] text-gbg-green-dark font-semibold">
            Kontinuerligt
          </span>
          <h2 className="font-display text-xl font-semibold text-gbg-green-dark mt-0.5">
            Modern uppföljning
          </h2>
          <p className="text-sm text-ink-soft mb-4">{modern.beskrivning}</p>

          <RiskTrajectory trajectory={modern.trajectory} />

          {modern.first_red_grade !== null && (
            <div className="mt-4 p-3.5 bg-gbg-green/10 border-l-4 border-gbg-green rounded-r text-sm text-ink">
              Risken syntes redan i <b>{gradeLabel(modern.first_red_grade)}</b>
              {modern.missing_node_label && (
                <>
                  {" "}
                  – saknad nod: <b>{modern.missing_node_label}</b> ({modern.missing_node})
                </>
              )}
              .
              {modern.suggested_action && (
                <div className="mt-2 text-gbg-green-dark font-medium">
                  💡 Åtgärd som hade kunnat sättas in: {modern.suggested_action}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-ink-faint mt-2">
            Risken byggde uteslutande på färdighetssignal – aldrig på elevens bakgrund.
          </p>
        </div>
      </div>

      {modern.first_red_grade !== null && (
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-3 bg-gbg-blue text-white rounded-full px-5 py-2.5 shadow-lift">
            <span className="font-display text-2xl font-semibold tnum">
              {9 - modern.first_red_grade} år
            </span>
            <span className="text-sm text-gbg-blue-light">
              tidigare varning i den moderna vyn
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
