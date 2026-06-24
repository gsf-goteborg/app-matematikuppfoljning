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
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d4" />
          <XAxis dataKey="grade" tick={{ fontSize: 12, fill: "#5a6573" }} />
          <YAxis
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tick={{ fontSize: 12, fill: "#5a6573" }}
            tickFormatter={(v) => String(v)}
          />
          <ReferenceLine y={2} stroke="#f47815" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === "risk"
                ? [`${value} – ${RISK_LABELS[value]}`, "Risknivå"]
                : [`${value}%`, "p(F i åk 9)"]
            }
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e0d4", fontSize: 12 }}
          />
          <Line
            type="stepAfter"
            dataKey="risk"
            stroke="#e8364a"
            strokeWidth={3}
            dot={{ r: 4, fill: "#e8364a" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
