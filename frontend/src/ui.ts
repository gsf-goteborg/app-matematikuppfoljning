// Shared presentation helpers (colours, labels). Swedish UI text throughout.
// All colours come from Göteborgs Stad's official palette (grafisk profil).

// Risk 0–3 mapped onto the official green → red scale.
export const RISK_COLORS = ["#6a9a1f", "#f9b000", "#f47815", "#e8364a"];
export const RISK_LABELS = ["Ingen risk", "Bevaka", "Förhöjd risk", "Kritisk risk"];

export function riskColor(level: number): string {
  return RISK_COLORS[Math.max(0, Math.min(3, level))];
}

// Mastery 0..1 -> heatmap colour (red -> yellow -> green). null = not measured.
export function masteryColor(m: number | null): string {
  if (m === null || m === undefined) return "#e4e0d4"; // paper-line (omätt)
  if (m < 0.35) return "#e8364a"; // gbg-red
  if (m < 0.5) return "#f47815"; // gbg-orange
  if (m < 0.65) return "#f9b000"; // gbg-orange-light
  if (m < 0.8) return "#9ec038"; // gbg-green-light
  return "#6a9a1f"; // gbg-green
}

export const STATUS_COLORS: Record<string, string> = {
  bemastrad: "#6a9a1f", // gbg-green
  lucka: "#e8364a", // gbg-red
  blockerad: "#f47815", // gbg-orange
  omatt: "#c9cfd6",
};

export const STATUS_LABELS: Record<string, string> = {
  bemastrad: "Bemästrad",
  lucka: "Lucka",
  blockerad: "Blockerad (saknad förkunskap)",
  omatt: "Ej mätt ännu",
};

export const CONTENT_AREA_LABELS: Record<string, string> = {
  taluppfattning: "Taluppfattning",
  algebra: "Algebra",
  geometri: "Geometri",
  sannolikhet_statistik: "Sannolikhet & statistik",
  samband_forandring: "Samband & förändring",
  problemlosning: "Problemlösning",
};

export function gradeLabel(arskurs: number): string {
  return arskurs === 0 ? "FK" : `Åk ${arskurs}`;
}

// Betyg F→A across the official palette: red (fail) → blue (top).
export const BETYG_COLORS: Record<string, string> = {
  F: "#e8364a", // gbg-red
  E: "#f47815", // gbg-orange
  D: "#9ec038", // gbg-green-light
  C: "#6a9a1f", // gbg-green
  B: "#005293", // gbg-blue
  A: "#00395f", // gbg-blue-dark
};
