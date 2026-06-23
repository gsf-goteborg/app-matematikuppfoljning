// Always-visible banner reminding everyone the data is synthetic.
export default function DemoBanner() {
  return (
    <div className="w-full bg-amber-400 text-amber-950 text-center text-sm font-semibold py-1.5 px-4">
      DEMO – syntetisk data. Inga riktiga elever. Riskmodellen använder enbart
      färdighetssignal (aldrig socioekonomisk bakgrund).
    </div>
  );
}
