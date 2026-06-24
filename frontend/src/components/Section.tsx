import type { ReactNode } from "react";

export function Section({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="bg-paper-card rounded-lg border border-paper-line shadow-card p-5 mb-5 animate-rise-in">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 w-1 h-6 rounded-full bg-gbg-blue shrink-0" aria-hidden />
          <div>
            <h2 className="font-display text-xl font-semibold text-ink leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-ink-soft mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="p-12 flex flex-col items-center justify-center gap-3 text-ink-faint"
    >
      <span
        className="w-8 h-8 rounded-full border-2 border-paper-line border-t-gbg-blue animate-spin"
        aria-hidden
      />
      <span className="text-sm tracking-wide">Laddar…</span>
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div
      role="alert"
      className="p-4 bg-gbg-red-light/30 border-l-4 border-gbg-red rounded-r text-ink text-sm"
    >
      <div className="font-semibold text-gbg-red-dark">Kunde inte hämta data</div>
      <div className="mt-0.5 text-ink-soft">{error}</div>
      <div className="text-ink-faint mt-2">
        Är backend igång? Kör <code className="px-1 py-0.5 bg-white/70 rounded">make demo</code>{" "}
        (eller <code className="px-1 py-0.5 bg-white/70 rounded">make seed</code> först).
      </div>
    </div>
  );
}
