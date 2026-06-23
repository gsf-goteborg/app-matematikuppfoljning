import { useState } from "react";
import { Link } from "react-router-dom";
import type { ClassHeatmap } from "../api/client";
import { masteryColor, riskColor } from "../ui";

// Pupils x knowledge nodes, colour-coded by mastery. Hover for detail.
export default function MasteryHeatmap({ data }: { data: ClassHeatmap }) {
  const [hover, setHover] = useState<{ sid: string; nid: string; m: number | null } | null>(null);
  const gates = new Set(data.gate_node_ids);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-white text-left text-xs font-medium pr-2">Elev</th>
            {data.node_ids.map((nid) => (
              <th
                key={nid}
                className={`text-[10px] font-medium align-bottom ${
                  gates.has(nid) ? "text-red-700" : "text-slate-500"
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
              <td className="sticky left-0 bg-white pr-2 whitespace-nowrap text-xs">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                  style={{ background: riskColor(row.risk_level) }}
                />
                <Link className="hover:underline" to={`/elev/${row.student_id}`}>
                  {row.student_id}
                </Link>
              </td>
              {row.cells.map((cell) => (
                <td key={cell.node_id}>
                  <div
                    className="w-5 h-5 rounded-sm cursor-pointer"
                    style={{ background: masteryColor(cell.mastery) }}
                    onMouseEnter={() =>
                      setHover({ sid: row.student_id, nid: cell.node_id, m: cell.mastery })
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-6 mt-2 text-xs text-slate-600">
        {hover ? (
          <span>
            <b>{hover.sid}</b> · {hover.nid} {data.node_labels[hover.nid]} ·{" "}
            {hover.m === null ? "ej mätt" : `mastery ${Math.round(hover.m * 100)}%`}
          </span>
        ) : (
          <span className="text-slate-400">
            Hovra över en cell för detalj. ⛳ = grind. Rött = lucka, grönt = bemästrad.
          </span>
        )}
      </div>
    </div>
  );
}
