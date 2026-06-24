import { Link } from "react-router-dom";
import type { Alert } from "../api/client";

const STYLE: Record<Alert["severity"], string> = {
  critical: "border-gbg-red bg-gbg-red-light/25 text-ink",
  warning: "border-gbg-orange bg-gbg-orange-light/20 text-ink",
  info: "border-gbg-blue-light bg-gbg-blue-light/15 text-ink",
};

const DOT: Record<Alert["severity"], string> = {
  critical: "bg-gbg-red",
  warning: "bg-gbg-orange",
  info: "bg-gbg-blue",
};

const TAG: Record<Alert["severity"], string> = {
  critical: "Kritiskt",
  warning: "Varning",
  info: "Info",
};

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="space-y-2.5">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`rounded-r-lg border-l-4 p-3.5 text-sm flex gap-3 items-start animate-sweep-in ${STYLE[a.severity]}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${DOT[a.severity]}`} />
          <div className="flex-1">
            <span className="text-2xs uppercase tracking-wider font-semibold text-ink-soft mr-2">
              {TAG[a.severity]}
            </span>
            {a.text}
            {a.school_id !== null && (
              <Link
                to={`/skola/${a.school_id}`}
                className="ml-2 font-medium text-gbg-blue hover:text-gbg-blue-dark underline decoration-from-font underline-offset-2 whitespace-nowrap"
              >
                → öppna skola
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
