"""SQLModel tables (see SPEC section 7).

Note the guard baked into the schema: ``School.intag_index`` and
``Student.ses_kontext`` exist ONLY for equity analysis at aggregate level and
must never be used as input to a pupil's risk score (see risk.py).
"""
from __future__ import annotations

from datetime import date, datetime

from sqlmodel import Field, SQLModel

# ---------------------------------------------------------------------------
# Organisation
# ---------------------------------------------------------------------------


class Huvudman(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    namn: str


class School(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    huvudman_id: int = Field(foreign_key="huvudman.id", index=True)
    namn: str
    # 0..1 -- ENDAST for equity analysis. NEVER a risk predictor.
    intag_index: float


class Klass(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    school_id: int = Field(foreign_key="school.id", index=True)
    beteckning: str
    arskurs: int  # FK = 0 ... 9
    lasar: str


class Teacher(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    school_id: int = Field(foreign_key="school.id", index=True)
    namn: str


class TeacherKlass(SQLModel, table=True):
    teacher_id: int = Field(foreign_key="teacher.id", primary_key=True)
    klass_id: int = Field(foreign_key="klass.id", primary_key=True)


class Student(SQLModel, table=True):
    # Pseudonymous id, e.g. "elev-04217"
    id: str = Field(primary_key=True)
    klass_id: int = Field(foreign_key="klass.id", index=True)
    # ENDAST aggregate analysis, ALDRIG risk input.
    ses_kontext: str


# ---------------------------------------------------------------------------
# Progression graph (seeded from progression.py)
# ---------------------------------------------------------------------------


class SkillNode(SQLModel, table=True):
    id: str = Field(primary_key=True)
    label_sv: str
    content_area: str
    grade_band: str
    is_gate: bool = False


class SkillEdge(SQLModel, table=True):
    prereq_id: str = Field(foreign_key="skillnode.id", primary_key=True)
    node_id: str = Field(foreign_key="skillnode.id", primary_key=True)


# ---------------------------------------------------------------------------
# Measurements & derived scores
# ---------------------------------------------------------------------------


class Assessment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    student_id: str = Field(foreign_key="student.id", index=True)
    node_id: str = Field(foreign_key="skillnode.id", index=True)
    datum: date
    arskurs: int
    source: str  # fk_bedstod | bedstod_1_3 | np_ak3 | np_ak6 | checkpoint | np_ak9
    mastery: float  # 0.0 - 1.0
    ability: str  # begrepp | metod | problemlosning | resonemang | kommunikation


class RiskScore(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    student_id: str = Field(foreign_key="student.id", index=True)
    computed_at: datetime
    arskurs: int
    risk_level: int  # 0 - 3
    p_fail_ak9: float  # 0 - 1
    top_missing_nodes: str = Field(default="[]")  # JSON list of node_id
    suggested_focus: str = Field(default="[]")  # JSON list of readable strings


class Ak9Outcome(SQLModel, table=True):
    student_id: str = Field(foreign_key="student.id", primary_key=True)
    provbetyg: str  # F..A
    slutbetyg: str  # F..A


class DemoMeta(SQLModel, table=True):
    """Small key/value store for demo plumbing (e.g. scenario student ids)."""
    key: str = Field(primary_key=True)
    value: str
