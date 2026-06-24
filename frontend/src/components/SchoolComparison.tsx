import { useNavigate } from "react-router-dom";
import type { SchoolGateSummary } from "../api/client";

const GATES = [
  { id: "N6", label: "Talfakta (åk 3)" },
  { id: "N12", label: "Proportionalitet (åk 6)" },
  { id: "N17", label: "Algebra (åk 9)" },
];

function cell(share: number | undefined): string {
  if (share === undefined) return "bg-paper-line/40 text-ink-faint";
  if (share >= 0.8) return "bg-gbg-green/15 text-gbg-green-dark";
  if (share >= 0.65) return "bg-gbg-orange-light/25 text-gbg-orange-dark";
  if (share >= 0.5) return "bg-gbg-orange/15 text-gbg-orange-dark font-medium";
  return "bg-gbg-red-light/40 text-gbg-red-dark font-semibold";
}

function fCell(f: number): string {
  if (f >= 0.3) return "bg-gbg-red-light/40 text-gbg-red-dark font-semibold";
  if (f >= 0.18) return "bg-gbg-orange/15 text-gbg-orange-dark";
  if (f >= 0.1) return "bg-gbg-orange-light/25 text-gbg-orange-dark";
  return "bg-gbg-green/15 text-gbg-green-dark";
}

export default function SchoolComparison({ schools }: { schools: SchoolGateSummary[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-faint border-b border-paper-line">
            <th className="py-2 pr-3 text-2xs uppercase tracking-wider font-semibold">Skola</th>
            {GATES.map((g) => (
              <th
                key={g.id}
                className="py-2 px-3 text-center text-2xs uppercase tracking-wider font-semibold"
              >
                {g.label}
              </th>
            ))}
            <th className="py-2 px-3 text-center text-2xs uppercase tracking-wider font-semibold">
              F-andel åk 9
            </th>
            <th className="py-2 pl-3 text-center text-2xs uppercase tracking-wider font-semibold">
              Intag*
            </th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr
              key={s.school_id}
              className="border-b border-paper-line/70 hover:bg-gbg-blue-light/10 cursor-pointer transition-colors"
              onClick={() => navigate(`/skola/${s.school_id}`)}
            >
              <td className="py-2.5 pr-3 font-semibold text-ink">{s.namn}</td>
              {GATES.map((g) => {
                const share = s.gate_shares[g.id];
                return (
                  <td key={g.id} className="py-1 px-1 text-center">
                    <span
                      className={`inline-block w-full rounded px-2 py-1 tnum ${cell(share)}`}
                    >
                      {share === undefined ? "–" : `${Math.round(share * 100)}%`}
                    </span>
                  </td>
                );
              })}
              <td className="py-1 px-1 text-center">
                <span
                  className={`inline-block w-full rounded px-2 py-1 tnum ${fCell(s.f_rate_ak9)}`}
                >
                  {Math.round(s.f_rate_ak9 * 100)}%
                </span>
              </td>
              <td className="py-2.5 pl-3 text-center text-ink-faint tnum">
                {s.intag_index.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-ink-faint mt-3">
        * Intag-index visas endast för likvärdighetsanalys och påverkar aldrig en elevs risk-score.
        Klicka på en rad för skolvy.
      </p>
    </div>
  );
}
