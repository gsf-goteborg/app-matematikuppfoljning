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
import RiskListView from "./views/RiskListView";
import CommandPalette, { useCommandPalette } from "./components/CommandPalette";
import WelcomeGuide, { useWelcomeGuide } from "./components/WelcomeGuide";

type Role = "Huvudman" | "Rektor" | "Lärare";

const ROLE_HOME: Record<Role, string> = {
  Huvudman: "/",
  Rektor: "/skola/1",
  Lärare: "/klass/13",
};

const CRUMB_LEVELS = ["Huvudman", "Skola", "Klass", "Elev"] as const;

function activeCrumb(path: string): (typeof CRUMB_LEVELS)[number] {
  if (path.startsWith("/skola")) return "Skola";
  if (path.startsWith("/klass")) return "Klass";
  if (path.startsWith("/elev")) return "Elev";
  return "Huvudman";
}

function Navbar({
  role,
  setRole,
  onOpenSearch,
  onOpenGuide,
}: {
  role: Role;
  setRole: (r: Role) => void;
  onOpenSearch: () => void;
  onOpenGuide: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const scenarios = useFetch(() => api.demoScenarios(), []);
  const current = activeCrumb(location.pathname);

  return (
    <nav className="bg-gbg-blue text-white">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-3 flex items-center gap-5 flex-wrap">
        <Link to="/" className="flex items-center gap-3 whitespace-nowrap group">
          <span className="grid place-items-center w-9 h-9 bg-white text-gbg-blue-dark font-display font-semibold text-lg rounded-sm shadow-sm">
            π
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold tracking-tight">
              Matematikuppföljning
            </span>
            <span className="block text-2xs uppercase tracking-[0.22em] text-gbg-blue-light">
              Göteborgs Stad · FK–Åk9
            </span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1.5 text-sm ml-2">
          {CRUMB_LEVELS.map((lvl, i) => (
            <span key={lvl} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gbg-blue-light/60">›</span>}
              <span
                className={
                  lvl === current
                    ? "text-white font-semibold border-b-2 border-gbg-orange-light pb-0.5"
                    : "text-gbg-blue-light"
                }
              >
                {lvl}
              </span>
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <button
            onClick={onOpenGuide}
            className="hidden sm:flex items-center gap-1.5 text-gbg-blue-light hover:text-white transition-colors"
          >
            <span aria-hidden>?</span>
            <span className="text-2xs">Så funkar det</span>
          </button>
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 bg-gbg-blue-dark/60 hover:bg-gbg-blue-dark border border-white/15 rounded-md pl-2.5 pr-2 py-1.5 text-gbg-blue-light hover:text-white transition-colors"
            aria-label="Sök (Ctrl+K)"
          >
            <span className="text-sm">⌕</span>
            <span className="hidden sm:inline text-2xs">Sök</span>
            <kbd className="hidden sm:inline text-2xs bg-white/10 rounded px-1 py-0.5 border border-white/10">
              ⌘K
            </kbd>
          </button>
          {scenarios.data && (
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-2xs uppercase tracking-wider text-gbg-blue-light">
                Demo-elever
              </span>
              {scenarios.data.tysta_eleven && (
                <Link
                  className="px-2 py-1 rounded-sm bg-white/10 hover:bg-white/20 transition-colors"
                  to={`/elev/${scenarios.data.tysta_eleven}/jamforelse`}
                >
                  Tysta eleven
                </Link>
              )}
              {scenarios.data.aterhamtaren && (
                <Link
                  className="px-2 py-1 rounded-sm bg-white/10 hover:bg-white/20 transition-colors"
                  to={`/elev/${scenarios.data.aterhamtaren}`}
                >
                  Återhämtaren
                </Link>
              )}
            </div>
          )}
          <label className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider text-gbg-blue-light hidden sm:inline">
              Roll
            </span>
            <select
              aria-label="Välj roll att visa appen som"
              className="bg-gbg-blue-dark border border-white/20 rounded-sm px-2.5 py-1.5 text-white"
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
      </div>
    </nav>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("Huvudman");
  const [paletteOpen, openPalette, closePalette] = useCommandPalette();
  const [guideOpen, openGuide, closeGuide] = useWelcomeGuide();

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#innehall" className="skip-link">
        Hoppa till innehåll
      </a>
      <DemoBanner />
      <Navbar role={role} setRole={setRole} onOpenSearch={openPalette} onOpenGuide={openGuide} />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <WelcomeGuide open={guideOpen} onClose={closeGuide} />
      <main
        id="innehall"
        key={role}
        className="flex-1 px-4 sm:px-6 py-6 max-w-7xl w-full mx-auto animate-rise-in"
      >
        <Routes>
          <Route path="/" element={<HuvudmanView />} />
          <Route path="/risk" element={<RiskListView />} />
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
