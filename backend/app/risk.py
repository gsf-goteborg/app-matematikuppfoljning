"""Risk-scoring engine -- transparent and pedagogically honest.

NO black box, NO SES input. Risk is computed purely from skill signal: which
knowledge nodes the pupil has (and has not) mastered, weighted so that *gate*
nodes count heaviest, and scaled by proximity to year 9 (the same gap is more
serious in year 8 than year 4 because the time left to fix it shrinks).
"""
from __future__ import annotations

import json
from datetime import datetime

import numpy as np

from . import progression as prog
from .models import Assessment, RiskScore

MASTERY_THRESHOLD = 0.5

# Precompute, for every node, how many critical year-9 nodes it blocks
# (appears in the prerequisite closure of, or is itself).
_BLOCKED_COUNT: dict[str, int] = {}
for _crit in prog.CRITICAL_AK9_NODES:
    _closure = prog.all_prerequisites(_crit) | {_crit}
    for _n in _closure:
        _BLOCKED_COUNT[_n] = _BLOCKED_COUNT.get(_n, 0) + 1


def _node_weight(node_id: str) -> float:
    base = 3.0 if prog.NODE_BY_ID[node_id].is_gate else 1.0
    blocked = _BLOCKED_COUNT.get(node_id, 0)
    return base * (1.0 + 0.25 * blocked)


def _proximity(grade: int) -> float:
    # Increases with grade: a gap is more urgent the closer to year 9 we are.
    return 0.4 + 0.6 * (grade / 9.0)


def _sigmoid(x: float) -> float:
    return float(1.0 / (1.0 + np.exp(-x)))


def _focus_text(node_id: str) -> str:
    node = prog.NODE_BY_ID[node_id]
    label = node.label_sv
    hints = {
        "N6": "Automatisera talfakta innan multiplikation och division byggs på.",
        "N12": "Repetera proportionalitet (N12) innan linjära funktioner och algebra introduceras.",
        "N17": "Säkra algebraiska uttryck (N17) innan ekvationer och funktioner byggs vidare.",
        "N9": "Befäst tal i bråkform (N9) som grund för procent och proportionalitet.",
        "N11": "Säkra procent (N11) inför proportionalitet.",
    }
    if node_id in hints:
        return hints[node_id]
    return f"Repetera {label} ({node_id}) – förkunskap för flera kommande moment."


def latest_mastery_up_to(
    assessments: list[Assessment], grade: int
) -> dict[str, float]:
    """Latest measured mastery per node, using only assessments at or before ``grade``.

    A node with no measurement is treated as *unknown* (absent from the dict),
    never as 0 -- we do not penalise pupils for moments not yet measured.
    """
    best: dict[str, tuple] = {}
    for a in assessments:
        if a.arskurs > grade:
            continue
        key = (a.arskurs, a.datum)
        if a.node_id not in best or key > best[a.node_id][0]:
            best[a.node_id] = (key, a.mastery)
    return {nid: v[1] for nid, v in best.items()}


def compute_at_grade(
    student_id: str, assessments: list[Assessment], grade: int
) -> RiskScore:
    mastery = latest_mastery_up_to(assessments, grade)

    # Collect unmastered, *measured* prerequisites of the critical year-9 nodes.
    missing_weight: dict[str, float] = {}
    for crit in prog.CRITICAL_AK9_NODES:
        candidates = prog.all_prerequisites(crit) | {crit}
        for nid in candidates:
            m = mastery.get(nid)
            if m is not None and m < MASTERY_THRESHOLD:
                missing_weight[nid] = _node_weight(nid)

    raw = sum(missing_weight.values()) * _proximity(grade)

    if raw < 1.0:
        level = 0
    elif raw < 3.5:
        level = 1
    elif raw < 6.5:
        level = 2
    else:
        level = 3

    p_fail = _sigmoid(0.45 * (raw - 6.0))

    top = sorted(missing_weight.items(), key=lambda kv: kv[1], reverse=True)[:3]
    top_nodes = [nid for nid, _ in top]
    focus = [_focus_text(nid) for nid in top_nodes]

    # Use the latest assessment date in this grade as the computation timestamp.
    dates = [a.datum for a in assessments if a.arskurs == grade]
    computed_at = datetime.combine(max(dates), datetime.min.time()) if dates else datetime.utcnow()

    return RiskScore(
        student_id=student_id,
        computed_at=computed_at,
        arskurs=grade,
        risk_level=level,
        p_fail_ak9=round(p_fail, 4),
        top_missing_nodes=json.dumps(top_nodes),
        suggested_focus=json.dumps(focus, ensure_ascii=False),
    )


def compute_trajectory(student_id: str, assessments: list[Assessment]) -> list[RiskScore]:
    """One RiskScore per grade where the pupil has at least one measurement."""
    grades = sorted({a.arskurs for a in assessments})
    return [compute_at_grade(student_id, assessments, g) for g in grades]
