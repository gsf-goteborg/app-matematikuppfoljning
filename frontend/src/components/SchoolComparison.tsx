import { useNavigate } from "react-router-dom";
import type { SchoolGateSummary } from "../api/client";

const GATES = [
  { id: "N6", label: "Talfakta (åk 3)" },
  { id: "N12", label: "Proportionalitet (åk 6)" },
  { id: "N17", label: "Algebra (åk 9)" },
];

function cell(share: number | undefined): string {
  if (share === undefined) return "bg-slate-100 text-slate-400";
  if (share >= 0.8) return "bg-green-100 text-green-900";
  if (share >= 0.65) return "bg-yellow-100 text-yellow-900";
  if (share >= 0.5) return "bg-orange-100 text-orange-900";
  return "bg-red-200 text-red-900 font-semibold";
}

function fCell(f: number): string {
  if (f >= 0.3) return "bg-red-200 text-red-900 font-semibold";
  if (f >= 0.18) return "bg-orange-100 text-orange-900";
  if (f >= 0.1) return "bg-yellow-100 text-yellow-900";
  return "bg-green-100 text-green-900";
}

export default function SchoolComparison({ schools }: { schools: SchoolGateSummary[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2 pr-3">Skola</th>
            {GATES.map((g) => (
              <th key={g.id} className="py-2 px-3 text-center">
                {g.label}
              </th>
            ))}
            <th className="py-2 px-3 text-center">F-andel åk 9</th>
            <th className="py-2 pl-3 text-center">Intag*</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr
              key={s.school_id}
              className="border-b hover:bg-slate-50 cursor-pointer"
              onClick={() => navigate(`/skola/${s.school_id}`)}
            >
              <td className="py-2 pr-3 font-medium">{s.namn}</td>
              {GATES.map((g) => {
                const share = s.gate_shares[g.id];
                return (
                  <td key={g.id} className="py-1 px-1 text-center">
                    <span className={`inline-block w-full rounded px-2 py-1 ${cell(share)}`}>
                      {share === undefined ? "–" : `${Math.round(share * 100)}%`}
                    </span>
                  </td>
                );
              })}
              <td className="py-1 px-1 text-center">
                <span className={`inline-block w-full rounded px-2 py-1 ${fCell(s.f_rate_ak9)}`}>
                  {Math.round(s.f_rate_ak9 * 100)}%
                </span>
              </td>
              <td className="py-2 pl-3 text-center text-slate-500">{s.intag_index.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2">
        * Intag-index visas endast för likvärdighetsanalys och påverkar aldrig en elevs risk-score.
        Klicka på en rad för skolvy.
      </p>
    </div>
  );
}
