import { Link } from "react-router-dom";
import type { Alert } from "../api/client";

const STYLE: Record<Alert["severity"], string> = {
  critical: "border-l-4 border-red-500 bg-red-50 text-red-900",
  warning: "border-l-4 border-orange-400 bg-orange-50 text-orange-900",
  info: "border-l-4 border-slate-300 bg-slate-50 text-slate-700",
};

const ICON: Record<Alert["severity"], string> = {
  critical: "🔴",
  warning: "🟠",
  info: "ℹ️",
};

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`rounded p-3 text-sm flex gap-2 ${STYLE[a.severity]}`}>
          <span>{ICON[a.severity]}</span>
          <span className="flex-1">
            {a.text}
            {a.school_id !== null && (
              <Link to={`/skola/${a.school_id}`} className="ml-2 underline whitespace-nowrap">
                → öppna skola
              </Link>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
