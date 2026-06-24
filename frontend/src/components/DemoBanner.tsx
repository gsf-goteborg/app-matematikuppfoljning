// Always-visible banner reminding everyone the data is synthetic.
export default function DemoBanner() {
  return (
    <div className="w-full bg-gbg-yellow text-black">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-1.5 flex items-center justify-center gap-2 text-center text-xs sm:text-sm font-medium">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-black/70 animate-pulse" />
        <span>
          <b className="font-semibold">DEMO – syntetisk data.</b> Inga riktiga elever. Riskmodellen
          använder enbart färdighetssignal – aldrig socioekonomisk bakgrund.
        </span>
      </div>
    </div>
  );
}
