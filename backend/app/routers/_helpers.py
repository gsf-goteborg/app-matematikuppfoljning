"""Shared query/derivation helpers for the routers."""
from __future__ import annotations

import json

from sqlmodel import Session, select

from .. import progression as prog
from ..models import Assessment, Klass, RiskScore, School, SkillNode, Student

MASTERY_THRESHOLD = 0.5


def latest_mastery(session: Session, student_id: str, max_grade: int | None = None) -> dict[str, float]:
    """Latest measured mastery per node for a student (optionally capped at a grade)."""
    rows = session.exec(
        select(Assessment).where(Assessment.student_id == student_id)
    ).all()
    best: dict[str, tuple] = {}
    for a in rows:
        if max_grade is not None and a.arskurs > max_grade:
            continue
        key = (a.arskurs, a.datum)
        if a.node_id not in best or key > best[a.node_id][0]:
            best[a.node_id] = (key, a.mastery)
    return {nid: v[1] for nid, v in best.items()}


def all_latest_mastery(
    session: Session, student_ids: set[str] | None = None
) -> dict[str, dict[str, float]]:
    """Latest measured mastery per (student, node), optionally for a subset.

    Selects columns rather than whole rows: hydrating tens of thousands of ORM
    objects here dominated the school and huvudman views.
    """
    stmt = select(
        Assessment.student_id, Assessment.node_id,
        Assessment.arskurs, Assessment.datum, Assessment.mastery,
    )
    if student_ids is not None:
        stmt = stmt.where(Assessment.student_id.in_(student_ids))
    best: dict[str, dict[str, tuple]] = {}
    for student_id, node_id, arskurs, datum, mastery in session.exec(stmt):
        key = (arskurs, datum)
        sd = best.setdefault(student_id, {})
        if node_id not in sd or key > sd[node_id][0]:
            sd[node_id] = (key, mastery)
    return {sid: {nid: v[1] for nid, v in nodes.items()} for sid, nodes in best.items()}


def mastery_at_grade_for_node(session: Session, node_id: str) -> list[tuple[str, int, float]]:
    """All assessments of a node as (student_id, arskurs, mastery)."""
    stmt = select(Assessment.student_id, Assessment.arskurs, Assessment.mastery).where(
        Assessment.node_id == node_id
    )
    return list(session.exec(stmt))


def node_statuses(mastery: dict[str, float]) -> dict[str, str]:
    """Classify each node: bemastrad | lucka | blockerad | omatt."""
    status: dict[str, str] = {}
    for nid in prog.topological_order():
        m = mastery.get(nid)
        if m is not None:
            status[nid] = "bemastrad" if m >= MASTERY_THRESHOLD else "lucka"
        else:
            blocked = any(
                status.get(pre) in ("lucka", "blockerad")
                for pre in prog.NODE_BY_ID[nid].prerequisites
            )
            status[nid] = "blockerad" if blocked else "omatt"
    return status


def student_context(session: Session, student_id: str) -> tuple[Student, Klass, School] | None:
    student = session.get(Student, student_id)
    if student is None:
        return None
    klass = session.get(Klass, student.klass_id)
    school = session.get(School, klass.school_id) if klass else None
    return student, klass, school


def parse_risk(rs: RiskScore) -> dict:
    return {
        "arskurs": rs.arskurs,
        "risk_level": rs.risk_level,
        "p_fail_ak9": rs.p_fail_ak9,
        "top_missing_nodes": json.loads(rs.top_missing_nodes),
        "suggested_focus": json.loads(rs.suggested_focus),
    }


def node_label_map(session: Session) -> dict[str, SkillNode]:
    return {n.id: n for n in session.exec(select(SkillNode)).all()}
