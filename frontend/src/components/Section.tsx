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
    <section className="bg-white rounded-xl border shadow-sm p-4 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Loading() {
  return <div className="p-8 text-center text-slate-400">Laddar…</div>;
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
      Kunde inte hämta data: {error}
      <div className="text-slate-500 mt-1">
        Är backend igång? Kör <code>make demo</code> (eller <code>make seed</code> först).
      </div>
    </div>
  );
}
