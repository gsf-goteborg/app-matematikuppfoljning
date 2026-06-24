import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../useFetch";

const STEPS = [
  {
    n: 1,
    color: "var(--gbg-blue)",
    title: "Mät kontinuerligt – inte bara i slutet",
    body: "Vi följer var i kunskapskedjan varje elev är, från förskoleklass till åk 9. Dagens betyg i åk 9 är en lagging indicator som kommer för sent.",
  },
  {
    n: 2,
    color: "var(--gbg-orange)",
    title: "Se kunskapsluckan flera år tidigare",
    body: "Tre trösklar (talfakta N6, proportionalitet N12, algebra N17) avgör fortsättningen. En missad tröskel kaskaderar nedströms – ofta osynligt fram till åk 9.",
  },
  {
    n: 3,
    color: "var(--gbg-green)",
    title: "Led till nästa steg – aldrig en stämpel",
    body: "Varje röd siffra pekar på en konkret förkunskap att repetera. Risken bygger enbart på färdighetssignal – aldrig på elevens bakgrund.",
  },
];

export default function WelcomeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const scenarios = useFetch(() => api.demoScenarios(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tysta = scenarios.data?.tysta_eleven;
  const grindskola = scenarios.data?.grindskolan_school_id ?? "1";

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  const jumps = [
    { label: "Börja här: kommunens läge", sub: "Huvudmannaöversikt", to: "/", accent: "text-gbg-blue" },
    {
      label: "Tröskelskolan",
      sub: "Skola där N12 systematiskt missas",
      to: `/skola/${grindskola}`,
      accent: "text-gbg-orange-dark",
    },
    ...(tysta
      ? [
          {
            label: "Demons höjdpunkt",
            sub: "Tysta eleven: Dagens vs Modern",
            to: `/elev/${tysta}/jamforelse`,
            accent: "text-gbg-green-dark",
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-gbg-blue-dark/45 backdrop-blur-sm animate-rise-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        className="w-full max-w-2xl bg-paper-card rounded-2xl border border-paper-line shadow-lift overflow-hidden max-h-[84vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header plate */}
        <div className="bg-gbg-blue text-white px-6 py-5 flex items-start justify-between gap-4">
          <div>
            <span className="text-2xs uppercase tracking-[0.22em] text-gbg-blue-light">
              Göteborgs Stad · matematikuppföljning
            </span>
            <h2 id="guide-title" className="font-display text-2xl font-semibold mt-1">
              Så funkar uppföljningen
            </h2>
            <p className="text-sm text-gbg-blue-light mt-1 max-w-lg">
              Mät var i kunskapskedjan varje elev är – så att ingen tyst halkar efter och ingen blir
              chockad av många F i åk 9.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Stäng"
            className="shrink-0 w-8 h-8 grid place-items-center rounded-md bg-white/10 hover:bg-white/20 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Three steps */}
        <div className="p-6 space-y-4">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span
                className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-white font-display font-semibold tnum"
                style={{ background: s.color }}
              >
                {s.n}
              </span>
              <div>
                <div className="font-semibold text-ink">{s.title}</div>
                <p className="text-sm text-ink-soft mt-0.5">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Guided jumps */}
        <div className="px-6 pb-6">
          <div className="text-2xs uppercase tracking-wider font-semibold text-ink-faint mb-2">
            Guidad demo
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {jumps.map((j) => (
              <button
                key={j.to}
                onClick={() => go(j.to)}
                className="text-left rounded-lg border border-paper-line bg-white p-3 hover:border-gbg-blue hover:shadow-card transition-all group"
              >
                <div className={`font-display font-semibold ${j.accent} group-hover:translate-x-0.5 transition-transform`}>
                  {j.label} →
                </div>
                <div className="text-xs text-ink-faint mt-0.5">{j.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-paper-line flex items-center justify-between gap-4 text-xs text-ink-faint">
          <span>Allt är syntetisk data – inga riktiga elever.</span>
          <button
            onClick={onClose}
            className="font-medium text-gbg-blue hover:text-gbg-blue-dark"
          >
            Utforska själv →
          </button>
        </div>
      </div>
    </div>
  );
}

const SEEN_KEY = "matematik_guide_seen_v1";

// Auto-opens once per browser; re-openable via the returned `open` callback.
export function useWelcomeGuide(): [boolean, () => void, () => void] {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setIsOpen(true);
    } catch {
      /* localStorage unavailable – just skip auto-open */
    }
  }, []);

  const close = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };
  const open = () => setIsOpen(true);
  return [isOpen, open, close];
}
