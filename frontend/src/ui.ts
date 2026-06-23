// Shared presentation helpers (colours, labels). Swedish UI text throughout.

export const RISK_COLORS = ["#16a34a", "#eab308", "#f97316", "#dc2626"];
export const RISK_LABELS = ["Ingen risk", "Bevaka", "Förhöjd risk", "Kritisk risk"];

export function riskColor(level: number): string {
  return RISK_COLORS[Math.max(0, Math.min(3, level))];
}

// Mastery 0..1 -> heatmap colour (red -> yellow -> green). null = not measured.
export function masteryColor(m: number | null): string {
  if (m === null || m === undefined) return "#e2e8f0"; // slate-200 (omätt)
  if (m < 0.35) return "#dc2626";
  if (m < 0.5) return "#f97316";
  if (m < 0.65) return "#eab308";
  if (m < 0.8) return "#84cc16";
  return "#16a34a";
}

export const STATUS_COLORS: Record<string, string> = {
  bemastrad: "#16a34a",
  lucka: "#dc2626",
  blockerad: "#f97316",
  omatt: "#cbd5e1",
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

export const BETYG_COLORS: Record<string, string> = {
  F: "#dc2626",
  E: "#84cc16",
  D: "#65a30d",
  C: "#16a34a",
  B: "#0d9488",
  A: "#0891b2",
};
