"""API response models (Pydantic v2). All UI-facing text stays in Swedish."""
from __future__ import annotations

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Progression graph
# ---------------------------------------------------------------------------


class GraphNode(BaseModel):
    id: str
    label_sv: str
    content_area: str
    grade_band: str
    is_gate: bool


class GraphEdge(BaseModel):
    prereq_id: str
    node_id: str


class ProgressionGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ---------------------------------------------------------------------------
# Student
# ---------------------------------------------------------------------------


class NodeMastery(BaseModel):
    node_id: str
    label_sv: str
    content_area: str
    is_gate: bool
    mastery: float | None  # None = not yet measured
    status: str  # bemastrad | lucka | blockerad | omatt


class RiskPoint(BaseModel):
    arskurs: int
    risk_level: int
    p_fail_ak9: float
    top_missing_nodes: list[str]
    suggested_focus: list[str]


class StudentCard(BaseModel):
    id: str
    klass_id: int
    klass_beteckning: str
    arskurs: int
    school_id: int
    school_namn: str
    node_mastery: list[NodeMastery]
    trajectory: list[RiskPoint]
    current_risk_level: int
    top_missing_nodes: list[str]
    suggested_focus: list[str]
    provbetyg: str | None
    slutbetyg: str | None


class StudentListItem(BaseModel):
    id: str
    klass_id: int
    klass_beteckning: str
    arskurs: int
    school_id: int
    school_namn: str
    risk_level: int
    p_fail_ak9: float
    top_missing_nodes: list[str]


# ---------------------------------------------------------------------------
# Comparison ("Dagens vs Modern")
# ---------------------------------------------------------------------------


class ComparisonView(BaseModel):
    student_id: str
    arskurs: int
    # "Today": nothing but the final grade.
    todays_view: dict
    # "Modern": risk over time + the missing node + the action that could have helped.
    modern_view: dict


# ---------------------------------------------------------------------------
# Class
# ---------------------------------------------------------------------------


class HeatmapCell(BaseModel):
    node_id: str
    mastery: float | None


class HeatmapRow(BaseModel):
    student_id: str
    risk_level: int
    cells: list[HeatmapCell]


class ClassHeatmap(BaseModel):
    klass_id: int
    beteckning: str
    arskurs: int
    school_namn: str
    node_ids: list[str]
    node_labels: dict[str, str]
    gate_node_ids: list[str]
    rows: list[HeatmapRow]


class FocusGroup(BaseModel):
    node_id: str
    label_sv: str
    is_gate: bool
    student_ids: list[str]
    rationale: str


class GateStatus(BaseModel):
    node_id: str
    label_sv: str
    share_mastered: float
    n_total: int
    n_at_risk: int


class ClassFocus(BaseModel):
    klass_id: int
    beteckning: str
    arskurs: int
    gates: list[GateStatus]
    focus_groups: list[FocusGroup]


# ---------------------------------------------------------------------------
# School & Huvudman
# ---------------------------------------------------------------------------


class GateThroughput(BaseModel):
    node_id: str
    label_sv: str
    arskurs: int
    share_mastered: float
    n_total: int


class SchoolGateSummary(BaseModel):
    school_id: int
    namn: str
    intag_index: float
    gate_shares: dict[str, float]  # node_id -> share mastered (latest relevant grade)
    f_rate_ak9: float
    n_students: int


class Alert(BaseModel):
    severity: str  # info | warning | critical
    school_id: int | None
    text: str


class EquityPoint(BaseModel):
    bucket: str  # intag bucket or ses category
    f_rate: float
    n: int


class HuvudmanOverview(BaseModel):
    huvudman_namn: str
    schools: list[SchoolGateSummary]
    gate_throughput: list[GateThroughput]
    alerts: list[Alert]
    equity_by_intag: list[EquityPoint]
    equity_by_ses: list[EquityPoint]


class CohortTrendPoint(BaseModel):
    arskurs: int
    share_high_risk: float
    n: int


class SchoolDetail(BaseModel):
    school_id: int
    namn: str
    intag_index: float
    n_students: int
    cohort_trend: list[CohortTrendPoint]
    gate_status_by_grade: list[GateThroughput]
    f_rate_ak9: float
    classes_driving_risk: list[dict]
