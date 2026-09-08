import { useState } from "react";
import { api, DEMO_TODAY } from "../api/client";
import type { GapCard, GapStatus } from "../api/client";

// Status colours from the official palette, same scale as risk.
export const GAP_STATUS_COLORS: Record<GapStatus, string> = {
  vantar: "#e8364a", // gbg-red
  pagaende: "#005293", // gbg-blue
  kvarstar: "#f47815", // gbg-orange
  stangd: "#6a9a1f", // gbg-green
};

export function StatusPill({ gap }: { gap: GapCard }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="px-2 py-0.5 rounded-full text-2xs font-semibold text-white"
        style={{ background: GAP_STATUS_COLORS[gap.status] }}
      >
        {gap.status_label}
      </span>
      {gap.ommatning_forsenad && (
        <span className="text-2xs font-semibold text-gbg-red-dark">· försenad</span>
      )}
    </span>
  );
}

function Step({
  label,
  value,
  sub,
  done,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  done: boolean;
  warn?: boolean;
}) {
  const color = warn ? "#e8364a" : done ? "#005293" : "#c9cfd6";
  return (
    <li className="flex-1 min-w-[8.5rem] relative pl-5">
      <span
        className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-paper-card"
        style={{ background: color }}
        aria-hidden
      />
      <div className="text-2xs uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`text-sm mt-0.5 tnum ${done ? "font-semibold text-ink" : "text-ink-faint"}`}>
        {value}
      </div>
      {sub && <div className="text-2xs text-ink-soft mt-0.5">{sub}</div>}
    </li>
  );
}

/** The loop, made visible: detected -> intervention -> re-measured -> outcome. */
export function GapTimeline({ gap }: { gap: GapCard }) {
  const utfallText =
    gap.utfall === "stangd" ? "Bemästrad" : gap.utfall === "kvarstar" ? "Kvarstår" : "–";
  return (
    <ol className="flex flex-wrap gap-y-3 gap-x-2 relative">
      <span
        className="absolute left-1 top-2 right-1 h-px bg-paper-line hidden sm:block"
        aria-hidden
      />
      <Step
        label="Upptäckt"
        value={gap.upptackt_datum}
        sub={`${gap.upptackt_termin} · åk ${gap.upptackt_arskurs}`}
        done
      />
      <Step
        label="Insats påbörjad"
        value={gap.insats_startad ?? "Ej påbörjad"}
        sub={gap.insats_ansvarig_namn ?? undefined}
        done={!!gap.insats_startad}
        warn={!gap.insats_startad}
      />
      <Step
        label="Ommätt"
        value={gap.ommatt_datum ?? "Ej ommätt"}
        sub={
          gap.ommatt_datum
            ? undefined
            : gap.planerad_ommatning
              ? `Planerad: ${gap.planerad_ommatning}`
              : undefined
        }
        done={!!gap.ommatt_datum}
        warn={gap.ommatning_forsenad}
      />
      <Step
        label="Utfall"
        value={utfallText}
        sub={
          gap.utfall === "stangd"
            ? gap.stangd_inom_en_termin
              ? "inom en termin"
              : "längre än en termin"
            : `Öppen i ${gap.dagar_oppen} dagar`
        }
        done={gap.utfall === "stangd"}
        warn={gap.utfall === "kvarstar"}
      />
    </ol>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm border border-paper-line rounded-md bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-gbg-blue/40 focus:border-gbg-blue";

function Buttons({
  busy,
  label,
  color,
  onCancel,
  disabled,
}: {
  busy: boolean;
  label: string;
  color: string;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 mt-3">
      <button
        type="submit"
        disabled={busy || disabled}
        className={`px-3 py-1.5 text-sm font-medium rounded-md text-white disabled:opacity-50 transition-colors ${color}`}
      >
        {busy ? "Sparar…" : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-sm rounded-md text-ink-soft hover:bg-paper-line/40 transition-colors"
      >
        Avbryt
      </button>
    </div>
  );
}

/** Field one: who started an intervention, and when. Two inputs, both prefilled. */
function InsatsForm({
  gap,
  onDone,
  onCancel,
}: {
  gap: GapCard;
  onDone: (g: GapCard) => void;
  onCancel: () => void;
}) {
  const [ansvarig, setAnsvarig] = useState(gap.insats_ansvarig_namn ?? "");
  const [datum, setDatum] = useState(DEMO_TODAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await api.registerInsats(gap, { ansvarig_namn: ansvarig, datum }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 p-3 rounded-md bg-gbg-blue-light/10 border border-gbg-blue/20"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
        <label className="block">
          <span className="block text-2xs uppercase tracking-wider text-ink-faint mb-1">
            Ansvarig
          </span>
          <input
            className={inputCls}
            value={ansvarig}
            onChange={(e) => setAnsvarig(e.target.value)}
            placeholder="Namn"
            required
          />
        </label>
        <label className="block">
          <span className="block text-2xs uppercase tracking-wider text-ink-faint mb-1">
            Påbörjad
          </span>
          <input
            type="date"
            className={inputCls}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            required
          />
        </label>
      </div>
      <p className="text-2xs text-ink-soft mt-2">
        Ommätning planeras tio veckor fram. Registreringen påverkar inte elevens risknivå – bara
        en ny mätning kan göra det.
      </p>
      {error && <p className="text-2xs text-gbg-red-dark mt-1.5 font-medium">{error}</p>}
      <Buttons
        busy={busy}
        label="Registrera insats"
        color="bg-gbg-blue hover:bg-gbg-blue-dark"
        onCancel={onCancel}
        disabled={!ansvarig.trim()}
      />
    </form>
  );
}

/** Field two: what the follow-up check showed. Two answers, at the granularity
 *  a teacher actually has -- a percentage would be false precision. */
function OmmatningForm({
  gap,
  onDone,
  onCancel,
}: {
  gap: GapCard;
  onDone: (g: GapCard) => void;
  onCancel: () => void;
}) {
  const [klarar, setKlarar] = useState<boolean | null>(null);
  const [datum, setDatum] = useState(DEMO_TODAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (klarar === null) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await api.registerOmmatning(gap, { mastery: klarar ? 0.7 : 0.3, datum }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  }

  const choice = (value: boolean, label: string, color: string) => (
    <button
      type="button"
      onClick={() => setKlarar(value)}
      aria-pressed={klarar === value}
      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
        klarar === value
          ? `${color} text-white border-transparent font-medium`
          : "bg-white border-paper-line text-ink-soft hover:border-gbg-blue"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form
      onSubmit={submit}
      className="mt-3 p-3 rounded-md bg-gbg-green/10 border border-gbg-green/25"
    >
      <div className="flex flex-wrap gap-4 items-end">
        <label className="block">
          <span className="block text-2xs uppercase tracking-wider text-ink-faint mb-1">
            Ommätt datum
          </span>
          <input
            type="date"
            className={`${inputCls} w-44`}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            required
          />
        </label>
        <div>
          <span className="block text-2xs uppercase tracking-wider text-ink-faint mb-1">
            Vad visade ommätningen?
          </span>
          <div className="flex gap-2">
            {choice(true, "Klarar momentet", "bg-gbg-green")}
            {choice(false, "Inte ännu", "bg-gbg-orange")}
          </div>
        </div>
      </div>
      <p className="text-2xs text-ink-soft mt-2">
        Sparas som en vanlig mätning och räknas om till risk på samma sätt som ett nationellt
        prov. Utfallet följer av mätningen – det väljs inte.
      </p>
      {error && <p className="text-2xs text-gbg-red-dark mt-1.5 font-medium">{error}</p>}
      <Buttons
        busy={busy}
        label="Registrera ommätning"
        color="bg-gbg-green hover:bg-gbg-green-dark"
        onCancel={onCancel}
        disabled={klarar === null}
      />
    </form>
  );
}

/** One gap with its lifecycle and the registration that moves it forward. */
export default function GapItem({
  gap,
  onUpdated,
  showStudent = false,
}: {
  gap: GapCard;
  onUpdated?: (g: GapCard) => void;
  showStudent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const done = (g: GapCard) => {
    setOpen(false);
    onUpdated?.(g);
  };
  const nextStep = gap.insats_startad ? "ommatning" : "insats";

  return (
    <li className="border border-paper-line rounded-lg p-4 bg-paper-card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {gap.is_gate && (
              <span className="px-1.5 py-0.5 rounded bg-gbg-blue-dark text-white text-2xs font-semibold uppercase tracking-wider">
                Tröskel
              </span>
            )}
            <span className="font-display text-lg font-semibold text-ink">
              {gap.node_id} {gap.label_sv}
            </span>
            <StatusPill gap={gap} />
          </div>
          {showStudent && (
            <div className="text-2xs text-ink-soft mt-0.5">
              {gap.student_id} · klass {gap.klass_beteckning}
            </div>
          )}
        </div>
        {gap.utfall !== "stangd" && (
          <button
            onClick={() => setOpen(!open)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md text-white transition-colors ${
              nextStep === "insats"
                ? "bg-gbg-blue hover:bg-gbg-blue-dark"
                : "bg-gbg-green hover:bg-gbg-green-dark"
            }`}
          >
            {nextStep === "insats" ? "Registrera insats" : "Registrera ommätning"}
          </button>
        )}
      </div>

      <div className="mt-3">
        <GapTimeline gap={gap} />
      </div>

      {open && nextStep === "insats" && (
        <InsatsForm gap={gap} onDone={done} onCancel={() => setOpen(false)} />
      )}
      {open && nextStep === "ommatning" && (
        <OmmatningForm gap={gap} onDone={done} onCancel={() => setOpen(false)} />
      )}
    </li>
  );
}
