"""Student-level endpoints: card, risk trajectory, and the Today-vs-Modern comparison."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from .. import progression as prog
from ..db import get_session
from ..models import Ak9Outcome, Klass, RiskScore, School, Student
from ..schemas import (
    ComparisonView,
    NodeMastery,
    RiskPoint,
    StudentCard,
    StudentListItem,
)
from . import _helpers as H

router = APIRouter(prefix="/api/students", tags=["students"])


def _trajectory(session: Session, student_id: str) -> list[RiskPoint]:
    rows = session.exec(
        select(RiskScore).where(RiskScore.student_id == student_id)
    ).all()
    rows.sort(key=lambda r: r.arskurs)
    return [RiskPoint(**H.parse_risk(r)) for r in rows]


@router.get("", response_model=list[StudentListItem])
def list_students(
    risk_level: int | None = Query(default=None, ge=0, le=3),
    school_id: int | None = None,
    arskurs: int | None = None,
    limit: int = Query(default=200, le=2000),
    session: Session = Depends(get_session),
) -> list[StudentListItem]:
    # Latest risk score per student.
    scores = session.exec(select(RiskScore)).all()
    latest: dict[str, RiskScore] = {}
    for rs in scores:
        cur = latest.get(rs.student_id)
        if cur is None or rs.arskurs > cur.arskurs:
            latest[rs.student_id] = rs

    students = {s.id: s for s in session.exec(select(Student)).all()}
    klasses = {k.id: k for k in session.exec(select(Klass)).all()}
    schools = {s.id: s for s in session.exec(select(School)).all()}

    out: list[StudentListItem] = []
    for sid, rs in latest.items():
        if risk_level is not None and rs.risk_level != risk_level:
            continue
        student = students.get(sid)
        if student is None:
            continue
        klass = klasses.get(student.klass_id)
        if klass is None:
            continue
        if school_id is not None and klass.school_id != school_id:
            continue
        if arskurs is not None and klass.arskurs != arskurs:
            continue
        school = schools.get(klass.school_id)
        out.append(StudentListItem(
            id=sid, klass_id=klass.id, klass_beteckning=klass.beteckning,
            arskurs=klass.arskurs, school_id=klass.school_id,
            school_namn=school.namn if school else "",
            risk_level=rs.risk_level, p_fail_ak9=rs.p_fail_ak9,
            top_missing_nodes=H.parse_risk(rs)["top_missing_nodes"],
        ))
    out.sort(key=lambda x: (-x.risk_level, -x.p_fail_ak9))
    return out[:limit]


@router.get("/{student_id}", response_model=StudentCard)
def get_student(student_id: str, session: Session = Depends(get_session)) -> StudentCard:
    ctx = H.student_context(session, student_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Eleven hittades inte")
    student, klass, school = ctx

    mastery = H.latest_mastery(session, student_id)
    statuses = H.node_statuses(mastery)
    nodes = H.node_label_map(session)

    node_mastery = [
        NodeMastery(
            node_id=nid, label_sv=nodes[nid].label_sv,
            content_area=nodes[nid].content_area, is_gate=nodes[nid].is_gate,
            mastery=mastery.get(nid), status=statuses[nid],
        )
        for nid in prog.topological_order()
    ]

    traj = _trajectory(session, student_id)
    current = traj[-1] if traj else None
    outcome = session.get(Ak9Outcome, student_id)

    return StudentCard(
        id=student.id, klass_id=klass.id, klass_beteckning=klass.beteckning,
        arskurs=klass.arskurs, school_id=klass.school_id,
        school_namn=school.namn if school else "",
        node_mastery=node_mastery, trajectory=traj,
        current_risk_level=current.risk_level if current else 0,
        top_missing_nodes=current.top_missing_nodes if current else [],
        suggested_focus=current.suggested_focus if current else [],
        provbetyg=outcome.provbetyg if outcome else None,
        slutbetyg=outcome.slutbetyg if outcome else None,
    )


@router.get("/{student_id}/comparison", response_model=ComparisonView)
def get_comparison(student_id: str, session: Session = Depends(get_session)) -> ComparisonView:
    ctx = H.student_context(session, student_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Eleven hittades inte")
    student, klass, _school = ctx

    traj = _trajectory(session, student_id)
    outcome = session.get(Ak9Outcome, student_id)
    nodes = H.node_label_map(session)

    # First grade where risk turned red (level >= 2).
    first_red = next((p for p in traj if p.risk_level >= 2), None)
    missing_node = first_red.top_missing_nodes[0] if (first_red and first_red.top_missing_nodes) else None
    missing_label = nodes[missing_node].label_sv if missing_node else None
    action = first_red.suggested_focus[0] if (first_red and first_red.suggested_focus) else None

    todays_view = {
        "beskrivning": "Detta är allt nuvarande system visar.",
        "provbetyg": outcome.provbetyg if outcome else None,
        "slutbetyg": outcome.slutbetyg if outcome else None,
        # Today's view has no leading signal -- only the final result in year 9.
        "timeline": [{"arskurs": g, "signal": None} for g in range(0, 10)],
    }
    modern_view = {
        "beskrivning": (
            f"Risken syntes redan i åk {first_red.arskurs}."
            if first_red else "Risktrajektorian följdes kontinuerligt."
        ),
        "trajectory": [p.model_dump() for p in traj],
        "first_red_grade": first_red.arskurs if first_red else None,
        "missing_node": missing_node,
        "missing_node_label": missing_label,
        "suggested_action": action,
    }
    return ComparisonView(
        student_id=student.id, arskurs=klass.arskurs,
        todays_view=todays_view, modern_view=modern_view,
    )
