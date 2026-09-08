"""School-level detail: cohort trends, gate status per grade, classes driving risk."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .. import progression as prog
from ..db import get_session
from ..models import Ak9Outcome, Klass, Kunskapslucka, RiskScore, School, Student
from ..schemas import CohortTrendPoint, GateThroughput, LoopTerminPoint, SchoolDetail
from . import _helpers as H
from . import gaps as G

router = APIRouter(prefix="/api/schools", tags=["schools"])


@router.get("/{school_id}", response_model=SchoolDetail)
def school_detail(school_id: int, session: Session = Depends(get_session)) -> SchoolDetail:
    school = session.get(School, school_id)
    if school is None:
        raise HTTPException(status_code=404, detail="Skolan hittades inte")

    klasses = session.exec(select(Klass).where(Klass.school_id == school_id)).all()
    klass_by_id = {k.id: k for k in klasses}
    students = session.exec(select(Student).where(Student.klass_id.in_([k.id for k in klasses]))).all() \
        if klasses else []
    student_ids = {s.id for s in students}
    nodes = H.node_label_map(session)

    # Latest risk per student.
    risk_rows = session.exec(select(RiskScore)).all()
    latest_risk: dict[str, RiskScore] = {}
    for rs in risk_rows:
        if rs.student_id not in student_ids:
            continue
        cur = latest_risk.get(rs.student_id)
        if cur is None or rs.arskurs > cur.arskurs:
            latest_risk[rs.student_id] = rs

    # Cohort trend: share high-risk (level >= 2) per grade.
    by_grade: dict[int, list[str]] = defaultdict(list)
    for s in students:
        k = klass_by_id.get(s.klass_id)
        if k:
            by_grade[k.arskurs].append(s.id)
    cohort_trend = []
    for grade in sorted(by_grade):
        sids = by_grade[grade]
        high = sum(1 for sid in sids if latest_risk.get(sid) and latest_risk[sid].risk_level >= 2)
        cohort_trend.append(CohortTrendPoint(
            arskurs=grade, share_high_risk=round(high / len(sids), 3) if sids else 0.0, n=len(sids),
        ))

    # Gate status per grade (share mastered) using all assessments in this school.
    latest_mastery = H.all_latest_mastery(session, student_ids)
    gate_status_by_grade: list[GateThroughput] = []
    grade_for_gate = {"N6": [2, 3], "N12": [5, 6], "N17": [7, 9]}
    for gid, grades in grade_for_gate.items():
        for grade in grades:
            sids = by_grade.get(grade, [])
            vals = [latest_mastery[sid][gid] for sid in sids
                    if sid in latest_mastery and gid in latest_mastery[sid]]
            if vals:
                gate_status_by_grade.append(GateThroughput(
                    node_id=gid, label_sv=nodes[gid].label_sv, arskurs=grade,
                    share_mastered=round(sum(1 for v in vals if v >= 0.5) / len(vals), 3),
                    n_total=len(vals),
                ))

    # F-rate (year 9).
    outcomes = session.exec(select(Ak9Outcome)).all()
    school_outcomes = [o for o in outcomes if o.student_id in student_ids]
    f_rate = round(sum(1 for o in school_outcomes if o.provbetyg == "F") / len(school_outcomes), 3) \
        if school_outcomes else 0.0

    # Classes driving risk.
    class_risk: list[dict] = []
    for k in klasses:
        sids = [s.id for s in students if s.klass_id == k.id]
        if not sids:
            continue
        high = sum(1 for sid in sids if latest_risk.get(sid) and latest_risk[sid].risk_level >= 2)
        class_risk.append({
            "klass_id": k.id, "beteckning": k.beteckning, "arskurs": k.arskurs,
            "n": len(sids), "share_high_risk": round(high / len(sids), 3),
        })
    class_risk.sort(key=lambda c: -c["share_high_risk"])

    # The loop for this school: how many gaps close, and what is stuck.
    gap_rows = list(session.exec(
        select(Kunskapslucka).where(Kunskapslucka.school_id == school_id)
    ).all())
    att_folja_upp = [c for c in sorted(G.cards(session, gap_rows), key=G.sort_key)
                     if c.status in ("ommatning_forsenad", "insats_saknas")]

    return SchoolDetail(
        school_id=school.id, namn=school.namn, intag_index=school.intag_index,
        n_students=len(students), cohort_trend=cohort_trend,
        gate_status_by_grade=gate_status_by_grade, f_rate_ak9=f_rate,
        classes_driving_risk=class_risk[:8],
        loop=G.summary_for(gap_rows, len(students)),
        loop_by_termin=[LoopTerminPoint(**p) for p in G.by_termin(gap_rows)],
        att_folja_upp=att_folja_upp[:15],
    )
