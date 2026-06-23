"""Class-level endpoints: mastery heatmap and the low-friction weekly focus."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .. import progression as prog
from ..db import get_session
from ..models import Klass, RiskScore, School, Student
from ..schemas import (
    ClassFocus,
    ClassHeatmap,
    FocusGroup,
    GateStatus,
    HeatmapCell,
    HeatmapRow,
)
from . import _helpers as H

router = APIRouter(prefix="/api/classes", tags=["classes"])


def _class_students(session: Session, klass_id: int) -> list[Student]:
    return session.exec(select(Student).where(Student.klass_id == klass_id)).all()


def _latest_risk_levels(session: Session, student_ids: list[str]) -> dict[str, int]:
    rows = session.exec(select(RiskScore)).all()
    latest: dict[str, RiskScore] = {}
    ids = set(student_ids)
    for rs in rows:
        if rs.student_id not in ids:
            continue
        cur = latest.get(rs.student_id)
        if cur is None or rs.arskurs > cur.arskurs:
            latest[rs.student_id] = rs
    return {sid: rs.risk_level for sid, rs in latest.items()}


@router.get("/{klass_id}/heatmap", response_model=ClassHeatmap)
def heatmap(klass_id: int, session: Session = Depends(get_session)) -> ClassHeatmap:
    klass = session.get(Klass, klass_id)
    if klass is None:
        raise HTTPException(status_code=404, detail="Klassen hittades inte")
    school = session.get(School, klass.school_id)
    students = _class_students(session, klass_id)
    nodes = H.node_label_map(session)

    # Nodes relevant for this grade: everything measured up to and including it.
    relevant: set[str] = set()
    for g in range(0, klass.arskurs + 1):
        relevant.update(prog.MEASUREMENT_PLAN.get(g, []))
    node_ids = [nid for nid in prog.topological_order() if nid in relevant]
    if not node_ids:  # FK fallback
        node_ids = prog.MEASUREMENT_PLAN.get(0, [])

    risk_levels = _latest_risk_levels(session, [s.id for s in students])

    rows: list[HeatmapRow] = []
    for s in students:
        mastery = H.latest_mastery(session, s.id, max_grade=klass.arskurs)
        cells = [HeatmapCell(node_id=nid, mastery=mastery.get(nid)) for nid in node_ids]
        rows.append(HeatmapRow(
            student_id=s.id, risk_level=risk_levels.get(s.id, 0), cells=cells,
        ))
    rows.sort(key=lambda r: -r.risk_level)

    return ClassHeatmap(
        klass_id=klass.id, beteckning=klass.beteckning, arskurs=klass.arskurs,
        school_namn=school.namn if school else "",
        node_ids=node_ids,
        node_labels={nid: nodes[nid].label_sv for nid in node_ids},
        gate_node_ids=[nid for nid in node_ids if nodes[nid].is_gate],
        rows=rows,
    )


@router.get("/{klass_id}/focus", response_model=ClassFocus)
def focus(klass_id: int, session: Session = Depends(get_session)) -> ClassFocus:
    klass = session.get(Klass, klass_id)
    if klass is None:
        raise HTTPException(status_code=404, detail="Klassen hittades inte")
    students = _class_students(session, klass_id)
    nodes = H.node_label_map(session)
    n_total = len(students)

    # Latest mastery per student, capped at the class grade.
    masteries = {s.id: H.latest_mastery(session, s.id, max_grade=klass.arskurs) for s in students}

    # Gate status for gates already measurable at this grade.
    gates: list[GateStatus] = []
    for gid in prog.GATE_IDS:
        measured = [(sid, m[gid]) for sid, m in masteries.items() if gid in m]
        if not measured:
            continue
        mastered = sum(1 for _, v in measured if v >= H.MASTERY_THRESHOLD)
        at_risk = [sid for sid, v in measured if v < H.MASTERY_THRESHOLD]
        gates.append(GateStatus(
            node_id=gid, label_sv=nodes[gid].label_sv,
            share_mastered=round(mastered / len(measured), 3) if measured else 0.0,
            n_total=len(measured), n_at_risk=len(at_risk),
        ))

    # Focus groups: nodes (gates prioritised) where several pupils have a gap,
    # framed as "repeat N before the next node is introduced".
    gap_by_node: dict[str, list[str]] = {}
    for sid, m in masteries.items():
        for nid, val in m.items():
            if val < H.MASTERY_THRESHOLD:
                gap_by_node.setdefault(nid, []).append(sid)

    def node_priority(nid: str) -> tuple:
        is_gate = nodes[nid].is_gate
        return (0 if is_gate else 1, -len(gap_by_node[nid]))

    ranked = sorted(gap_by_node.keys(), key=node_priority)
    focus_groups: list[FocusGroup] = []
    for nid in ranked:
        sids = gap_by_node[nid]
        if len(sids) < 2:
            continue
        node = nodes[nid]
        successors = [s for s in prog.NODES if nid in s.prerequisites]
        succ_txt = successors[0].label_sv if successors else "kommande moment"
        rationale = (
            f"Repetera {node.label_sv} ({nid}) för dessa {len(sids)} elever "
            f"innan {succ_txt} byggs på."
        )
        focus_groups.append(FocusGroup(
            node_id=nid, label_sv=node.label_sv, is_gate=node.is_gate,
            student_ids=sids, rationale=rationale,
        ))
        if len(focus_groups) >= 6:
            break

    return ClassFocus(
        klass_id=klass.id, beteckning=klass.beteckning, arskurs=klass.arskurs,
        gates=gates, focus_groups=focus_groups,
    )
