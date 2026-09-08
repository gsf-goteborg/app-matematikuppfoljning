import { useState } from "react";
import { api, DEMO_TODAY, INSATSTYPER } from "../api/client";
import type { GapCard, GapStatus } from "../api/client";

// Status colours from the official palette, same scale as risk.
export const GAP_STATUS_COLORS: Record<GapStatus, string> = {
  stangd: "#6a9a1f", // gbg-green
  pagaende: "#005293", // gbg-blue
  upptackt: "#f9b000", // gbg-orange-light
  kvarstar: "#f47815", // gbg-orange
  ommatning_forsenad: "#e8364a", // gbg-red
  insats_saknas: "#e8364a", // gbg-red
};

export function StatusPill({ gap }: { gap: GapCard }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold text-white whitespace-nowrap"
      style={{ background: GAP_STATUS_COLORS[gap.status] }}
    >
      {gap.status_label}
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
      <div
        className={`text-sm mt-0.5 tnum ${done ? "font-semibold text-ink" : "text-ink-faint"}`}
      >
        {value}
      </div>
      {sub && <div className="text-2xs text-ink-soft mt-0.5">{sub}</div>}
    </li>
  );
}

/** The loop, made visible: detected -> intervention -> re-measured -> outcome. */
export function GapTimeline({ gap }: { gap: GapCard }) {
  const utfallText =
    gap.utfall === "stangd"
      ? "Noden bemästrad"
      : gap.utfall === "kvarstar"
        ? "Kvarstår"
        : "–";
  return (
    <ol className="flex flex-wrap gap-y-3 gap-x-2 relative">
      <span
        className="absolute left-1 top-2 right-1 h-px bg-paper-line hidden sm:block"
        aria-hidden
      />
      <Step
        label="Upptäckt"
        value={gap.upptackt_datum}
        sub={`${gap.upptackt_termin} · åk ${gap.upptackt_arskurs} · ${Math.round(
          gap.upptackt_mastery * 100
        )}%`}
        done
      />
      <Step
        label="Insats påbörjad"
        value={gap.insats_startad ?? "Ej påbörjad"}
        sub={
          gap.insats_startad
            ? `${gap.insatstyp} · ${gap.insats_ansvarig_namn}`
            : `Frist: ${gap.insats_frist}`
        }
        done={!!gap.insats_startad}
        warn={!gap.insats_startad && gap.status === "insats_saknas"}
      />
      <Step
        label="Ommätt"
        value={gap.ommatt_datum ?? "Ej ommätt"}
        sub={
          gap.ommatt_datum
            ? `${Math.round((gap.ommatt_mastery ?? 0) * 100)}%`
            : gap.planerad_ommatning
              ? `Planerad: ${gap.planerad_ommatning}`
              : undefined
        }
        done={!!gap.ommatt_datum}
        warn={gap.status === "ommatning_forsenad"}
      />
      <Step
        label="Utfall"
        value={utfallText}
        sub={
          gap.utfall === "stangd"
            ? `${gap.dagar_oppen} dagar · ${
                gap.stangd_inom_en_termin ? "inom en termin" : "längre än en termin"
              }`
            : `Öppen i ${gap.dagar_oppen} dagar`
        }
        done={gap.utfall === "stangd"}
        warn={gap.utfall === "kvarstar"}
      />
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-2xs uppercase tracking-wider text-ink-faint mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm border border-paper-line rounded-md bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-gbg-blue/40 focus:border-gbg-blue";

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
  const [typ, setTyp] = useState(gap.insatstyp ?? INSATSTYPER[0]);
  const [datum, setDatum] = useState(DEMO_TODAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api.registerInsats(gap, {
          ansvarig_namn: ansvarig,
          insatstyp: typ,
          datum,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 p-3 rounded-md bg-gbg-blue-light/10 border border-gbg-blue/20">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Ansvarig">
          <input
            className={inputCls}
            value={ansvarig}
            onChange={(e) => setAnsvarig(e.target.value)}
            placeholder="Namn"
            required
          />
        </Field>
        <Field label="Insats">
          <select className={inputCls} value={typ} onChange={(e) => setTyp(e.target.value)}>
            {INSATSTYPER.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Påbörjad">
          <input
            type="date"
            className={inputCls}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            required
          />
        </Field>
      </div>
      <p className="text-2xs text-ink-soft mt-2">
        Ommätning planeras automatiskt tio veckor efter startdatum. Registreringen påverkar
        inte elevens risknivå – bara en ny mätning kan göra det.
      </p>
      {error && <p className="text-2xs text-gbg-red-dark mt-1.5 font-medium">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          disabled={busy || !ansvarig.trim()}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-gbg-blue text-white hover:bg-gbg-blue-dark disabled:opacity-50 transition-colors"
        >
          {busy ? "Sparar…" : "Registrera insats"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md text-ink-soft hover:bg-paper-line/40 transition-colors"
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}

function OmmatningForm({
  gap,
  onDone,
  onCancel,
}: {
  gap: GapCard;
  onDone: (g: GapCard) => void;
  onCancel: () => void;
}) {
  const [procent, setProcent] = useState(60);
  const [datum, setDatum] = useState(DEMO_TODAY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stangs = procent >= 50;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await api.registerOmmatning(gap, { mastery: procent / 100, datum }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 p-3 rounded-md bg-gbg-green/10 border border-gbg-green/25">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <Field label="Ommätt datum">
          <input
            type="date"
            className={inputCls}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            required
          />
        </Field>
        <Field label={`Resultat: ${procent}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={procent}
            onChange={(e) => setProcent(Number(e.target.value))}
            className="w-full accent-gbg-blue"
            aria-label="Uppmätt bemästring i procent"
          />
        </Field>
        <div className="text-sm">
          <span className="text-2xs uppercase tracking-wider text-ink-faint block mb-1">
            Utfall
          </span>
          <span
            className="inline-block px-2 py-1 rounded text-white text-2xs font-semibold"
            style={{ background: stangs ? "#6a9a1f" : "#f47815" }}
          >
            {stangs ? "Noden bemästrad – luckan stängs" : "Kvarstår – luckan förblir öppen"}
          </span>
        </div>
      </div>
      <p className="text-2xs text-ink-soft mt-2">
        Ommätningen sparas som en vanlig mätning och räknas om till risk på samma sätt som ett
        nationellt prov. Utfallet följer av mätningen – det väljs inte.
      </p>
      {error && <p className="text-2xs text-gbg-red-dark mt-1.5 font-medium">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-gbg-green text-white hover:bg-gbg-green-dark disabled:opacity-50 transition-colors"
        >
          {busy ? "Sparar…" : "Registrera ommätning"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md text-ink-soft hover:bg-paper-line/40 transition-colors"
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}

/** One gap with its lifecycle and the two registrations that close it. */
export default function GapItem({
  gap,
  onUpdated,
  showStudent = false,
}: {
  gap: GapCard;
  onUpdated?: (g: GapCard) => void;
  showStudent?: boolean;
}) {
  const [open, setOpen] = useState<"insats" | "ommatning" | null>(null);
  const done = (g: GapCard) => {
    setOpen(null);
    onUpdated?.(g);
  };

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
          <div className="flex gap-2">
            {!gap.insats_startad && (
              <button
                onClick={() => setOpen(open === "insats" ? null : "insats")}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-gbg-blue text-white hover:bg-gbg-blue-dark transition-colors"
              >
                Registrera insats
              </button>
            )}
            {gap.insats_startad && (
              <button
                onClick={() => setOpen(open === "ommatning" ? null : "ommatning")}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-gbg-green text-white hover:bg-gbg-green-dark transition-colors"
              >
                Registrera ommätning
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        <GapTimeline gap={gap} />
      </div>

      {open === "insats" && (
        <InsatsForm gap={gap} onDone={done} onCancel={() => setOpen(null)} />
      )}
      {open === "ommatning" && (
        <OmmatningForm gap={gap} onDone={done} onCancel={() => setOpen(null)} />
      )}
    </li>
  );
}
