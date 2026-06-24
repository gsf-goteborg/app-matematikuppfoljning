// Thin fetch wrapper around the FastAPI backend. Base URL via VITE_API_URL.
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// ---- Types (mirror backend/app/schemas.py) ----

export interface GraphNode {
  id: string;
  label_sv: string;
  content_area: string;
  grade_band: string;
  is_gate: boolean;
}
export interface GraphEdge {
  prereq_id: string;
  node_id: string;
}
export interface ProgressionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type NodeStatus = "bemastrad" | "lucka" | "blockerad" | "omatt";
export interface NodeMastery {
  node_id: string;
  label_sv: string;
  content_area: string;
  is_gate: boolean;
  mastery: number | null;
  status: NodeStatus;
}
export interface RiskPoint {
  arskurs: number;
  risk_level: number;
  p_fail_ak9: number;
  top_missing_nodes: string[];
  suggested_focus: string[];
}
export interface StudentCard {
  id: string;
  klass_id: number;
  klass_beteckning: string;
  arskurs: number;
  school_id: number;
  school_namn: string;
  node_mastery: NodeMastery[];
  trajectory: RiskPoint[];
  current_risk_level: number;
  top_missing_nodes: string[];
  suggested_focus: string[];
  provbetyg: string | null;
  slutbetyg: string | null;
}
export interface StudentListItem {
  id: string;
  klass_id: number;
  klass_beteckning: string;
  arskurs: number;
  school_id: number;
  school_namn: string;
  risk_level: number;
  p_fail_ak9: number;
  top_missing_nodes: string[];
}
export interface ComparisonView {
  student_id: string;
  arskurs: number;
  todays_view: {
    beskrivning: string;
    provbetyg: string | null;
    slutbetyg: string | null;
    timeline: { arskurs: number; signal: number | null }[];
  };
  modern_view: {
    beskrivning: string;
    trajectory: RiskPoint[];
    first_red_grade: number | null;
    missing_node: string | null;
    missing_node_label: string | null;
    suggested_action: string | null;
  };
}

export interface HeatmapCell {
  node_id: string;
  mastery: number | null;
}
export interface HeatmapRow {
  student_id: string;
  risk_level: number;
  cells: HeatmapCell[];
}
export interface ClassHeatmap {
  klass_id: number;
  beteckning: string;
  arskurs: number;
  school_namn: string;
  node_ids: string[];
  node_labels: Record<string, string>;
  gate_node_ids: string[];
  rows: HeatmapRow[];
}
export interface GateStatus {
  node_id: string;
  label_sv: string;
  share_mastered: number;
  n_total: number;
  n_at_risk: number;
}
export interface FocusGroup {
  node_id: string;
  label_sv: string;
  is_gate: boolean;
  student_ids: string[];
  rationale: string;
}
export interface ClassFocus {
  klass_id: number;
  beteckning: string;
  arskurs: number;
  gates: GateStatus[];
  focus_groups: FocusGroup[];
}

export interface SchoolGateSummary {
  school_id: number;
  namn: string;
  intag_index: number;
  gate_shares: Record<string, number>;
  f_rate_ak9: number;
  n_students: number;
}
export interface GateThroughput {
  node_id: string;
  label_sv: string;
  arskurs: number;
  share_mastered: number;
  n_total: number;
}
export interface Alert {
  severity: "info" | "warning" | "critical";
  school_id: number | null;
  text: string;
}
export interface EquityPoint {
  bucket: string;
  f_rate: number;
  n: number;
}
export interface KommunKpi {
  n_students: number;
  n_schools: number;
  n_critical: number;
  n_elevated: number;
  share_elevated: number;
  f_rate_ak9: number;
  schools_with_gate_gap: number;
}
export interface HuvudmanOverview {
  huvudman_namn: string;
  kpi: KommunKpi;
  schools: SchoolGateSummary[];
  gate_throughput: GateThroughput[];
  alerts: Alert[];
  equity_by_intag: EquityPoint[];
  equity_by_ses: EquityPoint[];
}
export interface CohortTrendPoint {
  arskurs: number;
  share_high_risk: number;
  n: number;
}
export interface SchoolDetail {
  school_id: number;
  namn: string;
  intag_index: number;
  n_students: number;
  cohort_trend: CohortTrendPoint[];
  gate_status_by_grade: GateThroughput[];
  f_rate_ak9: number;
  classes_driving_risk: {
    klass_id: number;
    beteckning: string;
    arskurs: number;
    n: number;
    share_high_risk: number;
  }[];
}

export const api = {
  demoScenarios: () => get<Record<string, string>>("/demo/scenarios"),
  progressionGraph: () => get<ProgressionGraph>("/progression/graph"),
  huvudmanOverview: () => get<HuvudmanOverview>("/huvudman/overview"),
  school: (id: number | string) => get<SchoolDetail>(`/schools/${id}`),
  classHeatmap: (id: number | string) => get<ClassHeatmap>(`/classes/${id}/heatmap`),
  classFocus: (id: number | string) => get<ClassFocus>(`/classes/${id}/focus`),
  student: (id: string) => get<StudentCard>(`/students/${id}`),
  comparison: (id: string) => get<ComparisonView>(`/students/${id}/comparison`),
  students: (params: { risk_level?: number; school_id?: number; arskurs?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.risk_level !== undefined) q.set("risk_level", String(params.risk_level));
    if (params.school_id !== undefined) q.set("school_id", String(params.school_id));
    if (params.arskurs !== undefined) q.set("arskurs", String(params.arskurs));
    const qs = q.toString();
    return get<StudentListItem[]>(`/students${qs ? `?${qs}` : ""}`);
  },
  reseed: (students = 2000, seed = 42) =>
    post<{ status: string; scenarios: Record<string, string> }>(
      `/seed?students=${students}&seed=${seed}`
    ),
};

export { BASE_URL };
