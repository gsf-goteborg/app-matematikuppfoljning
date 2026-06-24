import { useState } from "react";
import { Link } from "react-router-dom";
import type { ClassHeatmap } from "../api/client";
import { RISK_LABELS, masteryColor, riskColor } from "../ui";

// Redundant (non-colour) encoding so the heatmap is readable for colour-blind
// users: gaps get a dark inset ring, unmeasured cells a dashed border.
function cellShape(m: number | null): string {
  if (m === null || m === undefined) return "border border-dashed border-ink-faint/60";
  if (m < 0.5) return "ring-2 ring-inset ring-ink/55"; // lucka – syns utan färg
  return "";
}

function cellText(m: number | null, label: string): string {
  if (m === null || m === undefined) return `${label}: ej mätt`;
  const pct = Math.round(m * 100);
  return `${label}: ${pct}% – ${m < 0.5 ? "lucka" : "bemästrad"}`;
}

// Pupils x knowledge nodes, colour-coded by mastery. Hover for detail.
export default function MasteryHeatmap({ data }: { data: ClassHeatmap }) {
  const [hover, setHover] = useState<{ sid: string; nid: string; m: number | null } | null>(null);
  const gates = new Set(data.gate_node_ids);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <caption className="sr-only">
          Mastery per elev och kunskapsnod i klass {data.beteckning}. Celler med streckad ram är ej
          mätta; celler med mörk inre ram är luckor (under godkäntgränsen).
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-paper-card text-left text-xs font-medium pr-2">
              Elev
            </th>
            {data.node_ids.map((nid) => (
              <th
                key={nid}
                scope="col"
                className={`text-[10px] font-medium align-bottom ${
                  gates.has(nid) ? "text-gbg-red" : "text-ink-faint"
                }`}
                title={data.node_labels[nid]}
              >
                <div className="rotate-180 [writing-mode:vertical-rl] h-16 mx-auto">
                  {nid}
                  {gates.has(nid) ? " ⛳" : ""}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.student_id}>
              <th
                scope="row"
                className="sticky left-0 bg-paper-card pr-2 whitespace-nowrap text-xs font-normal text-left"
              >
                <span
                  className="inline-grid place-items-center w-4 h-4 rounded-full mr-1 align-middle text-white text-[8px] font-bold tnum"
                  style={{ background: riskColor(row.risk_level) }}
                  title={`Risknivå ${row.risk_level} – ${RISK_LABELS[row.risk_level]}`}
                >
                  {row.risk_level}
                </span>
                <Link className="hover:underline text-ink" to={`/elev/${row.student_id}`}>
                  {row.student_id}
                </Link>
              </th>
              {row.cells.map((cell) => {
                const label = data.node_labels[cell.node_id];
                return (
                  <td key={cell.node_id}>
                    <div
                      className={`w-5 h-5 rounded-sm cursor-pointer ${cellShape(cell.mastery)}`}
                      style={{ background: masteryColor(cell.mastery) }}
                      title={cellText(cell.mastery, label)}
                      onMouseEnter={() =>
                        setHover({ sid: row.student_id, nid: cell.node_id, m: cell.mastery })
                      }
                      onMouseLeave={() => setHover(null)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-6 mt-2 text-xs text-ink-soft" aria-live="polite">
        {hover ? (
          <span>
            <b>{hover.sid}</b> · {hover.nid} {data.node_labels[hover.nid]} ·{" "}
            {hover.m === null ? "ej mätt" : `mastery ${Math.round(hover.m * 100)}%`}
          </span>
        ) : (
          <span className="text-ink-faint">
            Hovra över en cell för detalj. ⛳ = tröskel · ▦ mörk ram = lucka · streckad ram = ej mätt.
          </span>
        )}
      </div>
    </div>
  );
}
