import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";

interface Item {
  id: string;
  label: string;
  sub?: string;
  to: string;
  group: string;
  badge?: string;
}

// Normalise free-text into a pseudonymous student id, e.g. "987" -> "elev-00987".
function elevIdFrom(query: string): string | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  const m = q.match(/^(?:elev-?)?(\d{1,5})$/);
  if (!m) return null;
  return `elev-${m[1].padStart(5, "0")}`;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Lazy: only fetch the index while the palette is mounted/open.
  const overview = useFetch(() => api.huvudmanOverview(), []);
  const scenarios = useFetch(() => api.demoScenarios(), []);

  const baseItems = useMemo<Item[]>(() => {
    const items: Item[] = [
      { id: "nav-huvudman", label: "Huvudmannaöversikt", sub: "Kommunens samlade läge", to: "/", group: "Vyer" },
      { id: "nav-risk", label: "Åtgärdslista", sub: "Elever som behöver uppmärksamhet", to: "/risk", group: "Vyer" },
      {
        id: "nav-risk3",
        label: "Elever i kritisk risk",
        sub: "Risknivå 3",
        to: "/risk?risk_level=3",
        group: "Vyer",
        badge: "Risk 3",
      },
    ];
    const sc = scenarios.data;
    if (sc?.tysta_eleven) {
      items.push({
        id: "demo-tyst",
        label: "Tysta eleven – jämförelse",
        sub: `${sc.tysta_eleven} · dagens och modern uppföljning`,
        to: `/elev/${sc.tysta_eleven}/jamforelse`,
        group: "Demo-scenarier",
      });
    }
    if (sc?.aterhamtaren) {
      items.push({
        id: "demo-ater",
        label: "Återhämtaren",
        sub: `${sc.aterhamtaren} · risk som faller`,
        to: `/elev/${sc.aterhamtaren}`,
        group: "Demo-scenarier",
      });
    }
    for (const s of overview.data?.schools ?? []) {
      items.push({
        id: `school-${s.school_id}`,
        label: s.namn,
        sub: `${s.n_students} elever · F-andel ${Math.round(s.f_rate_ak9 * 100)}%`,
        to: `/skola/${s.school_id}`,
        group: "Skolor",
      });
    }
    return items;
  }, [overview.data, scenarios.data]);

  const results = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const elev = elevIdFrom(query);
    const dynamic: Item[] = elev
      ? [{ id: "elev-jump", label: `Öppna ${elev}`, sub: "Gå direkt till elevkortet", to: `/elev/${elev}`, group: "Elev" }]
      : [];
    if (!q) return [...dynamic, ...baseItems];
    const filtered = baseItems.filter((it) =>
      `${it.label} ${it.sub ?? ""} ${it.group}`.toLowerCase().includes(q)
    );
    return [...dynamic, ...filtered];
  }, [query, baseItems]);

  // Reset selection when results change; clamp active.
  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after mount paint.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const go = (it: Item | undefined) => {
    if (!it) return;
    navigate(it.to);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  // Group consecutive results under headers while keeping a flat index for nav.
  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-gbg-blue-dark/40 backdrop-blur-sm animate-rise-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sök och navigera"
        className="w-full max-w-xl bg-paper-card rounded-xl border border-paper-line shadow-lift overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 border-b border-paper-line">
          <span className="text-ink-faint">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök skola, demo-elev, eller skriv ett elev-id (t.ex. 987)…"
            className="flex-1 py-3.5 bg-transparent outline-none text-ink placeholder:text-ink-faint"
          />
          <kbd className="text-2xs text-ink-faint border border-paper-line rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-faint">
              Inga träffar. Tips: skriv ett elev-id som <span className="tnum">00987</span>.
            </div>
          ) : (
            results.map((it, i) => {
              const header = it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              return (
                <div key={it.id}>
                  {header && (
                    <div className="px-4 pt-2 pb-1 text-2xs uppercase tracking-wider font-semibold text-ink-faint">
                      {header}
                    </div>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it)}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 ${
                      i === active ? "bg-gbg-blue text-white" : "hover:bg-gbg-blue-light/10"
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{it.label}</span>
                      {it.sub && (
                        <span
                          className={`block text-xs truncate ${
                            i === active ? "text-gbg-blue-light" : "text-ink-faint"
                          }`}
                        >
                          {it.sub}
                        </span>
                      )}
                    </span>
                    {it.badge && (
                      <span
                        className={`text-2xs px-1.5 py-0.5 rounded ${
                          i === active ? "bg-white/20" : "bg-gbg-red-light/30 text-gbg-red-dark"
                        }`}
                      >
                        {it.badge}
                      </span>
                    )}
                    {i === active && <span className="text-xs opacity-80">↵</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-paper-line flex items-center gap-4 text-2xs text-ink-faint">
          <span>
            <kbd className="border border-paper-line rounded px-1">↑</kbd>{" "}
            <kbd className="border border-paper-line rounded px-1">↓</kbd> navigera
          </span>
          <span>
            <kbd className="border border-paper-line rounded px-1">↵</kbd> öppna
          </span>
          <span className="ml-auto">Göteborgs Stad · matematikuppföljning</span>
        </div>
      </div>
    </div>
  );
}

// Helper hook: wire ⌘K / Ctrl-K to toggle, exposed for App.
export function useCommandPalette(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return [open, () => setOpen(true), () => setOpen(false)];
}
