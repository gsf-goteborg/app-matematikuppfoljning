import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import DemoBanner from "./components/DemoBanner";
import { api } from "./api/client";
import { useFetch } from "./useFetch";
import HuvudmanView from "./views/HuvudmanView";
import SchoolView from "./views/SchoolView";
import ClassView from "./views/ClassView";
import StudentView from "./views/StudentView";
import ComparisonView from "./views/ComparisonView";

type Role = "Huvudman" | "Rektor" | "Lärare";

const ROLE_HOME: Record<Role, string> = {
  Huvudman: "/",
  Rektor: "/skola/1",
  Lärare: "/klass/13",
};

function Navbar({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const scenarios = useFetch(() => api.demoScenarios(), []);

  return (
    <nav className="bg-slate-900 text-slate-100 px-4 py-2 flex items-center gap-4 flex-wrap">
      <Link to="/" className="font-bold text-base whitespace-nowrap">
        📐 Matematikuppföljning <span className="text-slate-400 font-normal">FK–Åk9</span>
      </Link>

      <div className="flex items-center gap-1 text-sm">
        {(["Huvudman", "Skola", "Klass", "Elev"] as const).map((lvl, i) => (
          <span key={lvl} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-500">▸</span>}
            <span
              className={
                location.pathname === "/" && lvl === "Huvudman"
                  ? "text-amber-300"
                  : "text-slate-300"
              }
            >
              {lvl}
            </span>
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3 text-sm">
        {scenarios.data && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Demo-elever:</span>
            {scenarios.data.tysta_eleven && (
              <Link
                className="underline decoration-dotted hover:text-amber-300"
                to={`/elev/${scenarios.data.tysta_eleven}/jamforelse`}
              >
                Tysta eleven
              </Link>
            )}
            {scenarios.data.aterhamtaren && (
              <Link
                className="underline decoration-dotted hover:text-amber-300"
                to={`/elev/${scenarios.data.aterhamtaren}`}
              >
                Återhämtaren
              </Link>
            )}
          </div>
        )}
        <label className="flex items-center gap-1">
          <span className="text-slate-400">Inloggad som:</span>
          <select
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1"
            value={role}
            onChange={(e) => {
              const r = e.target.value as Role;
              setRole(r);
              navigate(ROLE_HOME[r]);
            }}
          >
            <option>Huvudman</option>
            <option>Rektor</option>
            <option>Lärare</option>
          </select>
        </label>
      </div>
    </nav>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("Huvudman");

  return (
    <div className="min-h-screen flex flex-col">
      <DemoBanner />
      <Navbar role={role} setRole={setRole} />
      <main className="flex-1 p-4 max-w-7xl w-full mx-auto">
        <Routes>
          <Route path="/" element={<HuvudmanView />} />
          <Route path="/skola/:id" element={<SchoolView />} />
          <Route path="/klass/:id" element={<ClassView />} />
          <Route path="/elev/:id" element={<StudentView />} />
          <Route path="/elev/:id/jamforelse" element={<ComparisonView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
