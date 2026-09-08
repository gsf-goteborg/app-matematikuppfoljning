"""Huvudman-level overview: school comparison, gate throughput, equity, alerts."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from .. import progression as prog
from ..db import get_session
from ..models import Ak9Outcome, Huvudman, Klass, Kunskapslucka, RiskScore, School, Student
from ..schemas import (
    Alert,
    EquityPoint,
    GateThroughput,
    HuvudmanOverview,
    KommunKpi,
    LoopTerminPoint,
    SchoolGateSummary,
)
from . import _helpers as H
from . import gaps as G

router = APIRouter(prefix="/api/huvudman", tags=["huvudman"])

GATE_GRADES = {"N6": 3, "N12": 6, "N17": 9}  # key measurement grade per gate


@router.get("/overview", response_model=HuvudmanOverview)
def overview(session: Session = Depends(get_session)) -> HuvudmanOverview:
    huvudman = session.exec(select(Huvudman)).first()
    schools = session.exec(select(School)).all()
    klasses = {k.id: k for k in session.exec(select(Klass)).all()}
    students = session.exec(select(Student)).all()
    outcomes = {o.student_id: o for o in session.exec(select(Ak9Outcome)).all()}
    nodes = H.node_label_map(session)

    all_gaps = list(session.exec(select(Kunskapslucka)).all())
    gaps_by_school: dict[int, list[Kunskapslucka]] = {}
    for g in all_gaps:
        gaps_by_school.setdefault(g.school_id, []).append(g)

    student_school = {s.id: klasses[s.klass_id].school_id for s in students if s.klass_id in klasses}
    student_ses = {s.id: s.ses_kontext for s in students}
    latest = H.all_latest_mastery(session)

    # ---- per-school gate shares + F-rate ----
    school_summaries: list[SchoolGateSummary] = []
    f_by_school: dict[int, tuple[int, int]] = {}  # school -> (n_F, n_total)
    for school in schools:
        sids = [s.id for s in students if student_school.get(s.id) == school.id]
        gate_shares: dict[str, float] = {}
        for gid in prog.GATE_IDS:
            vals = [latest[sid][gid] for sid in sids if sid in latest and gid in latest[sid]]
            if vals:
                gate_shares[gid] = round(sum(1 for v in vals if v >= 0.5) / len(vals), 3)
        f_count = sum(1 for sid in sids if sid in outcomes and outcomes[sid].provbetyg == "F")
        n_out = sum(1 for sid in sids if sid in outcomes)
        f_by_school[school.id] = (f_count, n_out)
        sl = G.summary_for(gaps_by_school.get(school.id, []), len(sids))
        school_summaries.append(SchoolGateSummary(
            school_id=school.id, namn=school.namn, intag_index=school.intag_index,
            gate_shares=gate_shares,
            f_rate_ak9=round(f_count / n_out, 3) if n_out else 0.0,
            n_students=len(sids),
            andel_stangda_inom_en_termin=sl.andel_stangda_inom_en_termin,
            upptackta_per_100_elever=sl.upptackta_per_100_elever,
            andel_med_insats=sl.andel_med_insats,
            n_insats_saknas=sl.n_insats_saknas,
            n_luckor=sl.n_luckor,
        ))

    # ---- municipality-wide gate throughput at key grades ----
    gate_throughput: list[GateThroughput] = []
    for gid, grade in GATE_GRADES.items():
        rows = H.mastery_at_grade_for_node(session, gid)
        at_grade = [m for (_sid, ar, m) in rows if ar == grade]
        if at_grade:
            gate_throughput.append(GateThroughput(
                node_id=gid, label_sv=nodes[gid].label_sv, arskurs=grade,
                share_mastered=round(sum(1 for v in at_grade if v >= 0.5) / len(at_grade), 3),
                n_total=len(at_grade),
            ))

    # ---- alerts ----
    alerts: list[Alert] = []
    for summ in school_summaries:
        n12 = summ.gate_shares.get("N12")
        if n12 is not None and n12 < 0.65:
            miss = round((1 - n12) * 100)
            alerts.append(Alert(
                severity="critical", school_id=summ.school_id,
                text=(f"{summ.namn}: {miss}% missar proportionalitet (N12) i åk 6 "
                      f"– kraftig nedströmsrisk mot algebra och åk 9."),
            ))
        # The loop signal: seeing gaps and not acting on them is its own finding.
        if summ.n_luckor >= 30 and summ.andel_stangda_inom_en_termin < 0.20:
            alerts.append(Alert(
                severity="critical", school_id=summ.school_id,
                text=(f"{summ.namn}: bara "
                      f"{round(summ.andel_stangda_inom_en_termin * 100)}% av upptäckta luckor "
                      f"stängs inom en termin – {summ.n_insats_saknas} luckor saknar påbörjad insats. "
                      f"Skolan ser luckorna men loopen sluts inte."),
            ))
        elif summ.n_luckor >= 30 and summ.andel_med_insats < 0.35:
            alerts.append(Alert(
                severity="warning", school_id=summ.school_id,
                text=(f"{summ.namn}: insats har påbörjats för bara "
                      f"{round(summ.andel_med_insats * 100)}% av luckorna."),
            ))
        if summ.f_rate_ak9 >= 0.18:
            alerts.append(Alert(
                severity="warning", school_id=summ.school_id,
                text=f"{summ.namn}: F-andel i åk 9 är {round(summ.f_rate_ak9 * 100)}%.",
            ))
    if not alerts:
        alerts.append(Alert(severity="info", school_id=None,
                            text="Inga systemvarningar – trösklarna håller över skolorna."))

    # ---- equity (analysis only -- never a risk predictor) ----
    def f_rate_for(filter_fn) -> dict[str, tuple[int, int]]:
        buckets: dict[str, tuple[int, int]] = {}
        for sid, o in outcomes.items():
            b = filter_fn(sid)
            if b is None:
                continue
            f, n = buckets.get(b, (0, 0))
            buckets[b] = (f + (1 if o.provbetyg == "F" else 0), n + 1)
        return buckets

    def intag_bucket(sid: str) -> str | None:
        school_id = student_school.get(sid)
        sc = next((s for s in schools if s.id == school_id), None)
        if sc is None:
            return None
        if sc.intag_index < 0.45:
            return "Lågt intag"
        if sc.intag_index < 0.65:
            return "Medel"
        return "Högt intag"

    intag_buckets = f_rate_for(intag_bucket)
    ses_buckets = f_rate_for(lambda sid: student_ses.get(sid))

    equity_by_intag = [
        EquityPoint(bucket=b, f_rate=round(f / n, 3) if n else 0.0, n=n)
        for b, (f, n) in sorted(intag_buckets.items())
    ]
    equity_by_ses = [
        EquityPoint(bucket=b, f_rate=round(f / n, 3) if n else 0.0, n=n)
        for b, (f, n) in sorted(ses_buckets.items())
    ]

    school_summaries.sort(key=lambda s: s.gate_shares.get("N12", 1.0))

    # ---- kommun-wide KPI summary (latest risk per student) ----
    risk_rows = session.exec(select(RiskScore)).all()
    latest_risk: dict[str, RiskScore] = {}
    for rs in risk_rows:
        cur = latest_risk.get(rs.student_id)
        if cur is None or rs.arskurs > cur.arskurs:
            latest_risk[rs.student_id] = rs
    n_students = len(students)
    kommun_loop = G.summary_for(all_gaps, n_students)
    n_critical = sum(1 for rs in latest_risk.values() if rs.risk_level >= 3)
    n_elevated = sum(1 for rs in latest_risk.values() if rs.risk_level >= 2)
    total_f = sum(f for f, _ in f_by_school.values())
    total_out = sum(n for _, n in f_by_school.values())
    kpi = KommunKpi(
        n_students=n_students,
        n_schools=len(schools),
        n_critical=n_critical,
        n_elevated=n_elevated,
        share_elevated=round(n_elevated / n_students, 3) if n_students else 0.0,
        f_rate_ak9=round(total_f / total_out, 3) if total_out else 0.0,
        schools_with_gate_gap=sum(
            1 for s in school_summaries if s.gate_shares.get("N12", 1.0) < 0.65
        ),
        andel_stangda_inom_en_termin=kommun_loop.andel_stangda_inom_en_termin,
        n_insats_saknas=kommun_loop.n_insats_saknas,
        n_ommatning_forsenad=kommun_loop.n_ommatning_forsenad,
    )

    return HuvudmanOverview(
        huvudman_namn=huvudman.namn if huvudman else "Demokommunen",
        kpi=kpi,
        schools=school_summaries,
        gate_throughput=gate_throughput,
        alerts=alerts,
        equity_by_intag=equity_by_intag,
        equity_by_ses=equity_by_ses,
        loop=kommun_loop,
        loop_by_termin=[LoopTerminPoint(**p) for p in G.by_termin(all_gaps)],
    )
