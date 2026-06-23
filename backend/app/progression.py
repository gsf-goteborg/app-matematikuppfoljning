"""The progression graph -- the semantic backbone that ties measurements together.

Knowledge nodes derived from Lgr22's central content, forming a DAG of
prerequisite dependencies. Three *gates* (``is_gate=True``) mark the places
where pupils fall off and where monitoring must be tightest.

This module is pure seed data + small graph helpers; no database access.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NodeSeed:
    id: str
    label_sv: str
    content_area: str
    grade_band: str  # approximate grade where the node is introduced/consolidated
    prerequisites: tuple[str, ...]
    is_gate: bool = False


# Content areas (Swedish domain terms kept intentionally):
#   taluppfattning, algebra, geometri, sannolikhet_statistik,
#   samband_forandring, problemlosning

NODES: list[NodeSeed] = [
    NodeSeed("N1", "Antalsuppfattning", "taluppfattning", "FK", ()),
    NodeSeed("N2", "Talraden / ramsräkning", "taluppfattning", "FK", ("N1",)),
    NodeSeed("N3", "Antal–mängd-koppling", "taluppfattning", "FK", ("N1",)),
    NodeSeed("N4", "Positionssystemet", "taluppfattning", "1–3", ("N3",)),
    NodeSeed("N5", "Addition/subtraktion heltal", "taluppfattning", "1–3", ("N4",)),
    NodeSeed("N6", "Automatiserad talfakta", "taluppfattning", "1–3", ("N5",), is_gate=True),
    NodeSeed("N7", "Multiplikation / tabeller", "taluppfattning", "1–3", ("N6",)),
    NodeSeed("N8", "Division", "taluppfattning", "1–3", ("N7",)),
    NodeSeed("N9", "Tal i bråkform", "taluppfattning", "4–6", ("N8",)),
    NodeSeed("N10", "Decimaltal", "taluppfattning", "4–6", ("N4", "N8")),
    NodeSeed("N11", "Procent", "samband_forandring", "4–6", ("N9", "N10")),
    NodeSeed("N12", "Proportionalitet", "samband_forandring", "5–6", ("N9", "N11"), is_gate=True),
    NodeSeed("N13", "Negativa tal", "taluppfattning", "4–6", ("N5",)),
    NodeSeed("N14", "Omkrets & area", "geometri", "4–6", ("N5",)),
    NodeSeed("N15", "Enheter & skala", "geometri", "4–6", ("N12",)),
    NodeSeed("N16", "Koordinatsystem", "samband_forandring", "4–6", ("N4",)),
    NodeSeed("N17", "Algebraiska uttryck", "algebra", "7", ("N12", "N13"), is_gate=True),
    NodeSeed("N18", "Ekvationer", "algebra", "7–8", ("N17",)),
    NodeSeed("N19", "Metoder för ekvationslösning", "algebra", "8", ("N18",)),
    NodeSeed("N20", "Mönster & talföljder", "algebra", "7–9", ("N17",)),
    NodeSeed("N21", "Funktioner", "samband_forandring", "8–9", ("N16", "N18")),
    NodeSeed("N22", "Räta linjens ekvation", "samband_forandring", "9", ("N21", "N12")),
    NodeSeed("N23", "Pythagoras sats", "geometri", "8–9", ("N14", "N13")),
    NodeSeed("N24", "Volym", "geometri", "7–9", ("N14", "N15")),
    NodeSeed("N25", "Sannolikhet", "sannolikhet_statistik", "7–9", ("N11",)),
    NodeSeed("N26", "Statistik: lägesmått & spridning", "sannolikhet_statistik", "7–9", ("N10",)),
    NodeSeed("N27", "Problemlösning & modellering", "problemlosning", "7–9", ("N12", "N18", "N21")),
]

NODE_BY_ID: dict[str, NodeSeed] = {n.id: n for n in NODES}

# Gate nodes weigh heaviest in risk scoring and have stronger downstream effects.
GATE_IDS: tuple[str, ...] = tuple(n.id for n in NODES if n.is_gate)

# Critical Ak9 nodes: the ones that gate a passing grade in year 9.
CRITICAL_AK9_NODES: tuple[str, ...] = (
    "N17", "N18", "N19", "N20", "N21", "N22", "N23", "N24", "N27",
)


def edges() -> list[tuple[str, str]]:
    """Return DAG edges as (prereq_id, node_id) pairs."""
    out: list[tuple[str, str]] = []
    for node in NODES:
        for prereq in node.prerequisites:
            out.append((prereq, node.id))
    return out


def topological_order() -> list[str]:
    """Return node ids in topological (prerequisite-first) order."""
    visited: set[str] = set()
    order: list[str] = []

    def visit(node_id: str) -> None:
        if node_id in visited:
            return
        visited.add(node_id)
        for prereq in NODE_BY_ID[node_id].prerequisites:
            visit(prereq)
        order.append(node_id)

    for node in NODES:
        visit(node.id)
    return order


def all_prerequisites(node_id: str) -> set[str]:
    """Return the transitive closure of prerequisites for a node."""
    acc: set[str] = set()

    def visit(nid: str) -> None:
        for prereq in NODE_BY_ID[nid].prerequisites:
            if prereq not in acc:
                acc.add(prereq)
                visit(prereq)

    visit(node_id)
    return acc


# Which nodes are typically measured at each assessment occasion / grade.
# Used by the simulator to emit Assessment rows only at realistic moments.
MEASUREMENT_PLAN: dict[int, list[str]] = {
    0: ["N1", "N2", "N3"],                       # FK: fk_bedstod
    1: ["N4", "N5"],                              # checkpoint-ish via bedstod_1_3
    2: ["N5", "N6", "N7"],                        # bedstod_1_3
    3: ["N4", "N5", "N6", "N7", "N8"],            # np_ak3
    4: ["N9", "N10", "N13", "N14"],               # checkpoint
    5: ["N9", "N11", "N12", "N16"],               # checkpoint
    6: ["N9", "N10", "N11", "N12", "N13", "N14", "N15", "N16"],  # np_ak6
    7: ["N17", "N18", "N20"],                     # checkpoint
    8: ["N18", "N19", "N21", "N23"],              # checkpoint
    9: ["N17", "N18", "N19", "N20", "N21", "N22", "N23", "N24", "N25", "N26", "N27"],  # np_ak9
}


def source_for_grade(grade: int) -> str:
    """Map a grade to the assessment source label used in that year."""
    if grade == 0:
        return "fk_bedstod"
    if grade in (1, 2):
        return "bedstod_1_3"
    if grade == 3:
        return "np_ak3"
    if grade == 6:
        return "np_ak6"
    if grade == 9:
        return "np_ak9"
    return "checkpoint"
