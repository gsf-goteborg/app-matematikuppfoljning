"""API response models (Pydantic v2). All UI-facing text stays in Swedish."""
from __future__ import annotations

from datetime import date

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
# The closed loop: gaps, interventions, re-measurements
# ---------------------------------------------------------------------------


class GapCard(BaseModel):
    """One gap episode with its whole lifecycle -- what the loop is measured on."""
    id: int
    student_id: str
    node_id: str
    label_sv: str
    is_gate: bool
    school_id: int
    school_namn: str
    klass_id: int
    klass_beteckning: str

    upptackt_datum: date
    upptackt_termin: str
    upptackt_arskurs: int
    upptackt_mastery: float

    insats_startad: date | None
    insats_ansvarig_namn: str | None
    insatstyp: str | None
    planerad_ommatning: date | None
    insats_frist: date

    ommatt_datum: date | None
    ommatt_mastery: float | None

    utfall: str
    stangd_datum: date | None
    status: str
    status_label: str
    dagar_oppen: int | None
    stangd_inom_en_termin: bool


class LoopSummary(BaseModel):
    """Flow metrics. ``andel_stangda_inom_en_termin`` is never reported without
    ``upptackta_per_100_elever`` -- alone it rewards a school for looking away."""
    n_elever: int
    n_luckor: int
    n_bedomningsbara: int
    n_stangda_inom_en_termin: int
    andel_stangda_inom_en_termin: float
    n_med_insats: int
    andel_med_insats: float
    andel_insats_i_tid: float
    n_ommatta: int
    n_stangda: int
    n_stangda_med_insats: int
    n_stangda_utan_insats: int
    n_kvarstar: int
    n_oppna: int
    n_insats_saknas: int
    n_ommatning_forsenad: int
    median_dagar_till_stangning: int | None
    upptackta_per_100_elever: float


class LoopTerminPoint(BaseModel):
    termin: str
    andel_stangda_inom_en_termin: float
    n_luckor: int


class InsatsIn(BaseModel):
    """The first of the three fields a teacher fills in."""
    ansvarig_namn: str
    insatstyp: str
    datum: date | None = None


class OmmatningIn(BaseModel):
    """The other two: when it was re-measured, and what it showed.

    ``mastery`` decides the outcome -- the teacher records a measurement, not a
    verdict. A re-measurement below the threshold leaves the gap open.
    """
    mastery: float
    datum: date | None = None


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
    # The loop, per pupil: every gap ever detected and what happened to it.
    gaps: list[GapCard]


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
    n_med_insats: int = 0
    n_utan_insats: int = 0


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
    loop: LoopSummary
    att_folja_upp: list[GapCard]


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
    # Loop: closure rate is meaningless without the detection rate next to it.
    andel_stangda_inom_en_termin: float = 0.0
    upptackta_per_100_elever: float = 0.0
    andel_med_insats: float = 0.0
    n_insats_saknas: int = 0
    n_luckor: int = 0


class Alert(BaseModel):
    severity: str  # info | warning | critical
    school_id: int | None
    text: str


class EquityPoint(BaseModel):
    bucket: str  # intag bucket or ses category
    f_rate: float
    n: int


class KommunKpi(BaseModel):
    n_students: int
    n_schools: int
    n_critical: int  # elever med aktuell risknivå 3
    n_elevated: int  # elever med aktuell risknivå >= 2
    share_elevated: float
    f_rate_ak9: float  # viktad F-andel åk 9 över kommunen
    schools_with_gate_gap: int  # skolor där en tröskel systematiskt missas
    # Loop: den enda KPI:n som mäter om något faktiskt görs åt luckorna.
    andel_stangda_inom_en_termin: float = 0.0
    n_insats_saknas: int = 0
    n_ommatning_forsenad: int = 0


class HuvudmanOverview(BaseModel):
    huvudman_namn: str
    kpi: KommunKpi
    schools: list[SchoolGateSummary]
    gate_throughput: list[GateThroughput]
    alerts: list[Alert]
    equity_by_intag: list[EquityPoint]
    equity_by_ses: list[EquityPoint]
    loop: LoopSummary
    loop_by_termin: list[LoopTerminPoint]


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
    loop: LoopSummary
    loop_by_termin: list[LoopTerminPoint]
    att_folja_upp: list[GapCard]
