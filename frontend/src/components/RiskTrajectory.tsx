import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RiskPoint } from "../api/client";
import { RISK_LABELS, gradeLabel } from "../ui";

// Risk 0-3 over the grades (Recharts). The dramatic "red from year 6" story.
export default function RiskTrajectory({ trajectory }: { trajectory: RiskPoint[] }) {
  const data = trajectory.map((p) => ({
    arskurs: p.arskurs,
    grade: gradeLabel(p.arskurs),
    risk: p.risk_level,
    pfail: Math.round(p.p_fail_ak9 * 100),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => String(v)}
          />
          <ReferenceLine y={2} stroke="#f97316" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === "risk"
                ? [`${value} – ${RISK_LABELS[value]}`, "Risknivå"]
                : [`${value}%`, "p(F i åk 9)"]
            }
          />
          <Line
            type="stepAfter"
            dataKey="risk"
            stroke="#dc2626"
            strokeWidth={3}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
