"""Gap endpoints -- the closed loop.

Reading is free. Writing is deliberately limited to the two fields that turn a
suggestion into a follow-up -- the outcome is derived, never typed:

    POST /api/gaps/{id}/insats      -- påbörjad (datum + ansvarig)
    POST /api/gaps/{id}/ommatning   -- ommätt (datum + vad den visade)

The second one writes an ordinary ``Assessment`` and recomputes the pupil's
risk from it. The first one writes no measurement and therefore cannot move
risk at all -- that asymmetry is the guard that keeps "andel stängda luckor"
from being closable by paperwork.
"""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, delete, select

from .. import loop
from .. import risk as risk_engine
from ..db import get_session
from ..models import Assessment, Klass, Kunskapslucka, RiskScore, School, SkillNode
from ..schemas import GapCard, InsatsIn, LoopSummary, OmmatningIn

router = APIRouter(prefix="/api/gaps", tags=["gaps"])


# ---------------------------------------------------------------------------
# Presentation
# ---------------------------------------------------------------------------


def to_card(
    gap: Kunskapslucka,
    nodes: dict[str, SkillNode],
    schools: dict[int, School],
    klasses: dict[int, Klass],
) -> GapCard:
    st = loop.status(gap)
    node = nodes[gap.node_id]
    slut = gap.stangd_datum or loop.DEMO_TODAY
    return GapCard(
        id=gap.id,
        student_id=gap.student_id,
        node_id=gap.node_id,
        label_sv=node.label_sv,
        is_gate=node.is_gate,
        school_id=gap.school_id,
        school_namn=schools[gap.school_id].namn if gap.school_id in schools else "",
        klass_id=gap.klass_id,
        klass_beteckning=klasses[gap.klass_id].beteckning if gap.klass_id in klasses else "",
        upptackt_datum=gap.upptackt_datum,
        upptackt_termin=loop.termin(gap.upptackt_datum),
        upptackt_arskurs=gap.upptackt_arskurs,
        upptackt_mastery=gap.upptackt_mastery,
        insats_startad=gap.insats_startad,
        insats_ansvarig_namn=gap.insats_ansvarig_namn,
        planerad_ommatning=gap.planerad_ommatning,
        ommatt_datum=gap.ommatt_datum,
        ommatt_mastery=gap.ommatt_mastery,
        utfall=gap.utfall,
        stangd_datum=gap.stangd_datum,
        status=st,
        status_label=loop.STATUS_LABELS[st],
        ommatning_forsenad=loop.ar_forsenad(gap),
        dagar_oppen=(slut - gap.upptackt_datum).days,
        stangd_inom_en_termin=loop.stangd_inom_en_termin(gap),
    )


def cards(session: Session, gaps: list[Kunskapslucka]) -> list[GapCard]:
    nodes = {n.id: n for n in session.exec(select(SkillNode)).all()}
    schools = {s.id: s for s in session.exec(select(School)).all()}
    klasses = {k.id: k for k in session.exec(select(Klass)).all()}
    return [to_card(g, nodes, schools, klasses) for g in gaps]


def sort_key(card: GapCard) -> tuple:
    """Most actionable first: overdue follow-ups, then gaps nobody has started on."""
    order = {"vantar": 1, "kvarstar": 2, "pagaende": 3, "stangd": 4}
    return (
        0 if card.ommatning_forsenad else order.get(card.status, 9),
        not card.is_gate,
        card.upptackt_datum,
    )


# ---------------------------------------------------------------------------
# Aggregation helpers reused by the school and huvudman views
# ---------------------------------------------------------------------------


def summary_for(gaps: list[Kunskapslucka], n_students: int) -> LoopSummary:
    return LoopSummary(**loop.summarise(gaps, n_students))


def by_termin(gaps: list[Kunskapslucka], n_terms: int = 6) -> list[dict]:
    """Closure rate per detection term -- does the loop tighten over time?"""
    buckets: dict[str, list[Kunskapslucka]] = defaultdict(list)
    for g in gaps:
        if loop.har_fatt_sin_chans(g):
            buckets[loop.termin(g.upptackt_datum)].append(g)

    def sort_termin(label: str) -> tuple:
        typ, year = label.split(" ")
        return (int(year), 0 if typ == "VT" else 1)

    out = []
    for label in sorted(buckets, key=sort_termin)[-n_terms:]:
        rows = buckets[label]
        stangda = sum(1 for g in rows if loop.stangd_inom_en_termin(g))
        out.append({
            "termin": label,
            "andel_stangda_inom_en_termin": round(stangda / len(rows), 3) if rows else 0.0,
            "n_luckor": len(rows),
        })
    return out


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


@router.get("", response_model=list[GapCard])
def list_gaps(
    student_id: str | None = None,
    klass_id: int | None = None,
    school_id: int | None = None,
    status: str | None = Query(default=None, description="vantar|pagaende|kvarstar|stangd"),
    oppna: bool = Query(default=False, description="Bara luckor som ännu inte är stängda."),
    limit: int = Query(default=200, le=5000),
    session: Session = Depends(get_session),
) -> list[GapCard]:
    stmt = select(Kunskapslucka)
    if student_id is not None:
        stmt = stmt.where(Kunskapslucka.student_id == student_id)
    if klass_id is not None:
        stmt = stmt.where(Kunskapslucka.klass_id == klass_id)
    if school_id is not None:
        stmt = stmt.where(Kunskapslucka.school_id == school_id)
    rows = session.exec(stmt).all()
    if oppna:
        rows = [g for g in rows if loop.ar_oppen(g)]

    out = cards(session, rows)
    if status is not None:
        out = [c for c in out if c.status == status]
    out.sort(key=sort_key)
    return out[:limit]


# ---------------------------------------------------------------------------
# Write -- the only reporting the system asks for
# ---------------------------------------------------------------------------


def _get_gap(session: Session, gap_id: int) -> Kunskapslucka:
    gap = session.get(Kunskapslucka, gap_id)
    if gap is None:
        raise HTTPException(status_code=404, detail="Luckan hittades inte")
    return gap


@router.post("/{gap_id}/insats", response_model=GapCard)
def registrera_insats(
    gap_id: int, body: InsatsIn, session: Session = Depends(get_session),
) -> GapCard:
    """Field one: an intervention was started -- by whom, and when.

    Writes no measurement, so the pupil's risk is untouched. Only the follow-up
    measurement can move it.
    """
    gap = _get_gap(session, gap_id)
    if gap.utfall == loop.UTFALL_STANGD:
        raise HTTPException(status_code=409, detail="Luckan är redan stängd")

    startad = body.datum or loop.DEMO_TODAY
    if startad < gap.upptackt_datum:
        raise HTTPException(
            status_code=422, detail="Insatsen kan inte ha påbörjats innan luckan upptäcktes",
        )

    gap.insats_startad = startad
    gap.insats_ansvarig_namn = body.ansvarig_namn.strip()
    gap.planerad_ommatning = loop.planerad_ommatning_fran(startad)
    if gap.utfall == loop.UTFALL_OPPEN:
        gap.utfall = loop.UTFALL_PAGAENDE
    session.add(gap)
    session.commit()
    session.refresh(gap)
    return cards(session, [gap])[0]


@router.post("/{gap_id}/ommatning", response_model=GapCard)
def registrera_ommatning(
    gap_id: int, body: OmmatningIn, session: Session = Depends(get_session),
) -> GapCard:
    """Field two: re-measured on this date, showing this. The outcome follows.

    The re-measurement is stored as an ordinary ``Assessment`` and the pupil's
    risk trajectory is recomputed from it -- the same path any national test
    result takes. The outcome follows from the measurement, not from a choice.
    """
    gap = _get_gap(session, gap_id)
    if not 0.0 <= body.mastery <= 1.0:
        raise HTTPException(status_code=422, detail="Mastery måste ligga mellan 0 och 1")

    datum = body.datum or loop.DEMO_TODAY
    if datum < gap.upptackt_datum:
        raise HTTPException(
            status_code=422, detail="Ommätningen kan inte ligga före upptäckten",
        )

    klass = session.get(Klass, gap.klass_id)
    arskurs = klass.arskurs if klass else gap.upptackt_arskurs

    session.add(Assessment(
        student_id=gap.student_id, node_id=gap.node_id, datum=datum,
        arskurs=arskurs, source="ommatning", mastery=round(body.mastery, 3),
        ability="metod",
    ))

    gap.ommatt_datum = datum
    gap.ommatt_mastery = round(body.mastery, 3)
    if body.mastery >= loop.MASTERY_THRESHOLD:
        gap.utfall = loop.UTFALL_STANGD
        gap.stangd_datum = datum
    else:
        gap.utfall = loop.UTFALL_KVARSTAR
        gap.stangd_datum = None
    session.add(gap)
    session.commit()

    _recompute_risk(session, gap.student_id)
    session.refresh(gap)
    return cards(session, [gap])[0]


def _recompute_risk(session: Session, student_id: str) -> None:
    """Re-derive the pupil's risk trajectory after a new measurement landed."""
    rows = session.exec(
        select(Assessment).where(Assessment.student_id == student_id)
    ).all()
    session.exec(delete(RiskScore).where(RiskScore.student_id == student_id))
    for rs in risk_engine.compute_trajectory(student_id, list(rows)):
        session.add(rs)
    session.commit()
