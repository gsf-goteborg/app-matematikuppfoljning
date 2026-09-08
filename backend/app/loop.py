"""The closed loop: from a detected gap to a re-measured outcome.

Detection stays machine-derived from measurements. What a human adds is the
smallest possible report -- three fields per gap:

    1. insats påbörjad  (datum + ansvarig)
    2. ommätt           (datum)
    3. utfall           (noden bemästrad eller ej)

GUARD: registering an intervention must NEVER change a pupil's risk. Only the
re-measurement does -- it enters the system as an ordinary ``Assessment`` and
flows through risk.py like any other measurement. Without this guard "andel
stängda luckor" would be closable by paperwork, which is exactly the failure
mode this module exists to prevent.
"""
from __future__ import annotations

from datetime import date, timedelta

from .models import Assessment, Kunskapslucka

MASTERY_THRESHOLD = 0.5

# The demo cohort's "now": mid-autumn term of the 2025/26 school year, i.e.
# one term after the latest ordinary measurement (15 May 2025).
DEMO_TODAY = date(2025, 12, 15)

# An intervention is expected to start within four weeks of detection ...
INSATS_FRIST_DAGAR = 28
# ... and to be followed by a re-measurement about ten weeks after it started.
OMMATNING_VECKOR = 10
OMMATNING_FRIST_DAGAR = OMMATNING_VECKOR * 7

INSATSTYPER: list[str] = [
    "Intensivperiod",
    "Liten grupp",
    "Anpassad undervisning",
    "Specialpedagog",
]

# Gap lifecycle states as stored in ``Kunskapslucka.utfall``.
UTFALL_OPPEN = "oppen"
UTFALL_PAGAENDE = "pagaende"
UTFALL_STANGD = "stangd"
UTFALL_KVARSTAR = "kvarstar"

STATUS_LABELS: dict[str, str] = {
    "stangd": "Stängd",
    "kvarstar": "Kvarstår efter ommätning",
    "pagaende": "Insats pågår",
    "ommatning_forsenad": "Ommätning försenad",
    "insats_saknas": "Ingen insats påbörjad",
    "upptackt": "Nyupptäckt",
}


# ---------------------------------------------------------------------------
# Terms
# ---------------------------------------------------------------------------


def termin(d: date) -> str:
    """Swedish school term label for a date: ``HT 2025`` / ``VT 2026``."""
    return f"{'HT' if d.month >= 8 else 'VT'} {d.year}"


def _termin_slut(d: date) -> date:
    """Calendar boundary of the term ``d`` falls in: HT runs Aug-Dec, VT Jan-Jul.

    The summer is counted into the spring term on purpose -- otherwise the day
    after a term end would fall back into the same term.
    """
    return date(d.year, 12, 31) if d.month >= 8 else date(d.year, 7, 31)


def slut_pa_nasta_termin(d: date) -> date:
    """End of the term *following* the one ``d`` falls in.

    This is the deadline "inom en termin" is measured against: a gap found in
    week 18 of the spring term is not held to a spring-term closure it never
    had time for.
    """
    slut = _termin_slut(d)
    nasta = slut + timedelta(days=1)
    return _termin_slut(nasta)


def planerad_ommatning_fran(insats_startad: date) -> date:
    return insats_startad + timedelta(days=OMMATNING_FRIST_DAGAR)


# Roughly when Swedish terms end and the next one starts.
_TERMINSSLUT = ((6, 10), (12, 20))   # VT, HT
_TERMINSSTART = ((1, 10), (8, 20))   # VT, HT


def insats_frist(upptackt: date) -> date:
    """Deadline for starting an intervention.

    Four weeks after detection -- but measured in *school* time. A gap found in
    the last weeks of a term cannot be acted on over the summer, so the clock
    restarts four weeks into the following term. Without this the metric would
    just be measuring the school calendar.
    """
    if upptackt.month >= 8:
        slut = date(upptackt.year, *_TERMINSSLUT[1])
        nasta_start = date(upptackt.year + 1, *_TERMINSSTART[0])
    else:
        slut = date(upptackt.year, *_TERMINSSLUT[0])
        nasta_start = date(upptackt.year, *_TERMINSSTART[1])
    frist = upptackt + timedelta(days=INSATS_FRIST_DAGAR)
    if frist <= slut:
        return frist
    return nasta_start + timedelta(days=INSATS_FRIST_DAGAR)


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


def status(gap: Kunskapslucka, today: date = DEMO_TODAY) -> str:
    """Operational status -- what somebody needs to do about this gap now."""
    if gap.utfall == UTFALL_STANGD:
        return "stangd"
    if gap.utfall == UTFALL_KVARSTAR:
        return "kvarstar"
    if gap.insats_startad is not None:
        planerad = gap.planerad_ommatning or planerad_ommatning_fran(gap.insats_startad)
        if planerad < today:
            return "ommatning_forsenad"
        return "pagaende"
    if insats_frist(gap.upptackt_datum) < today:
        return "insats_saknas"
    return "upptackt"


def ar_oppen(gap: Kunskapslucka) -> bool:
    return gap.utfall in (UTFALL_OPPEN, UTFALL_PAGAENDE)


def stangd_inom_en_termin(gap: Kunskapslucka) -> bool:
    if gap.stangd_datum is None:
        return False
    return gap.stangd_datum <= slut_pa_nasta_termin(gap.upptackt_datum)


def har_fatt_sin_chans(gap: Kunskapslucka, today: date = DEMO_TODAY) -> bool:
    """True once the gap's one-term window has closed -- i.e. it belongs in the
    denominator of "andel stängda inom en termin". Gaps found last week do not.
    """
    return slut_pa_nasta_termin(gap.upptackt_datum) <= today


def dagar_till_stangning(gap: Kunskapslucka) -> int | None:
    if gap.stangd_datum is None:
        return None
    return (gap.stangd_datum - gap.upptackt_datum).days


# ---------------------------------------------------------------------------
# Detection: gaps are derived from measurements, never typed in
# ---------------------------------------------------------------------------


def derive_episodes(assessments: list[Assessment]) -> list[dict]:
    """Split one pupil's measurements into gap *episodes* per node.

    An episode opens at the first measurement below the threshold and closes at
    the first later measurement at or above it. A node that dips again after
    recovering opens a new episode (a relapse is a new gap, not the old one).
    """
    by_node: dict[str, list[Assessment]] = {}
    for a in assessments:
        by_node.setdefault(a.node_id, []).append(a)

    episodes: list[dict] = []
    for node_id, rows in by_node.items():
        ordered = sorted(rows, key=lambda a: (a.datum, a.arskurs))
        open_ep: dict | None = None
        for a in ordered:
            if a.mastery < MASTERY_THRESHOLD:
                if open_ep is None:
                    open_ep = {
                        "node_id": node_id,
                        "upptackt_datum": a.datum,
                        "upptackt_arskurs": a.arskurs,
                        "upptackt_mastery": a.mastery,
                        "stangd_datum": None,
                        "stangd_mastery": None,
                    }
            elif open_ep is not None:
                open_ep["stangd_datum"] = a.datum
                open_ep["stangd_mastery"] = a.mastery
                episodes.append(open_ep)
                open_ep = None
        if open_ep is not None:
            episodes.append(open_ep)
    episodes.sort(key=lambda e: (e["upptackt_datum"], e["node_id"]))
    return episodes


# ---------------------------------------------------------------------------
# Aggregation -- the numbers the huvudman actually needs
# ---------------------------------------------------------------------------


def summarise(
    gaps: list[Kunskapslucka], n_students: int, today: date = DEMO_TODAY
) -> dict:
    """Loop KPIs for a set of gaps (a school, a class or the whole municipality).

    ``andel_stangda_inom_en_termin`` is ALWAYS returned together with
    ``upptackta_per_100_elever``. Reported alone the first number rewards a
    school for detecting fewer gaps; the pair cannot be gamed that way.
    """
    n = len(gaps)
    med_insats = [g for g in gaps if g.insats_startad is not None]
    ommatta = [g for g in gaps if g.ommatt_datum is not None]
    stangda = [g for g in gaps if g.utfall == UTFALL_STANGD]
    kvarstar = [g for g in gaps if g.utfall == UTFALL_KVARSTAR]

    statuses = [status(g, today) for g in gaps]
    n_forsenade = sum(1 for s in statuses if s == "ommatning_forsenad")
    n_insats_saknas = sum(1 for s in statuses if s == "insats_saknas")

    # Cohort denominator: only gaps whose one-term window has actually closed.
    bedomningsbara = [g for g in gaps if har_fatt_sin_chans(g, today)]
    stangda_i_tid = [g for g in bedomningsbara if stangd_inom_en_termin(g)]

    # Did somebody act, or did it resolve on its own? Both are closures, but
    # only one of them is the system working.
    stangda_med_insats = sum(1 for g in stangda if g.insats_startad is not None)

    # Was an intervention started within the four-week deadline?
    hunnit_starta = [g for g in gaps if insats_frist(g.upptackt_datum) <= today]
    startade_i_tid = sum(
        1 for g in hunnit_starta
        if g.insats_startad is not None
        and g.insats_startad <= insats_frist(g.upptackt_datum)
    )

    dagar = sorted(d for d in (dagar_till_stangning(g) for g in stangda) if d is not None)
    median = dagar[len(dagar) // 2] if dagar else None

    def andel(taljare: int, namnare: int) -> float:
        return round(taljare / namnare, 3) if namnare else 0.0

    return {
        "n_elever": n_students,
        "n_luckor": n,
        "n_bedomningsbara": len(bedomningsbara),
        "n_stangda_inom_en_termin": len(stangda_i_tid),
        "andel_stangda_inom_en_termin": andel(len(stangda_i_tid), len(bedomningsbara)),
        "n_med_insats": len(med_insats),
        "andel_med_insats": andel(len(med_insats), n),
        "andel_insats_i_tid": andel(startade_i_tid, len(hunnit_starta)),
        "n_ommatta": len(ommatta),
        "n_stangda": len(stangda),
        "n_stangda_med_insats": stangda_med_insats,
        "n_stangda_utan_insats": len(stangda) - stangda_med_insats,
        "n_kvarstar": len(kvarstar),
        "n_oppna": sum(1 for g in gaps if ar_oppen(g)),
        "n_insats_saknas": n_insats_saknas,
        "n_ommatning_forsenad": n_forsenade,
        "median_dagar_till_stangning": median,
        "upptackta_per_100_elever": round(100 * n / n_students, 1) if n_students else 0.0,
    }
