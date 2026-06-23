"""Synthetic data generator -- the app's "secret sauce".

Generates a whole municipality flowing FK -> year 9. The pedagogical
simulation models the cumulative nature of mathematics: missing a prerequisite
(especially a *gate* node) sharply lowers the probability of mastering
downstream nodes. This is what makes the F-cascade -- and the demo's punchline
-- credible.

GUARD (SPEC section 3): ``intag_index`` may influence ``aptitude`` here, in the
data generation, to create realistic spread. It must NEVER become a predictor
in ``risk.py``. Risk is computed purely from skill signal.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import numpy as np

from . import progression as prog
from .models import (
    Ak9Outcome,
    Assessment,
    Huvudman,
    Klass,
    School,
    Student,
    Teacher,
    TeacherKlass,
)

# ---------------------------------------------------------------------------
# Tuning constants
# ---------------------------------------------------------------------------

GRADES = list(range(0, 10))  # FK = 0 ... year 9
CLASSES_PER_GRADE = 2

SES_CATEGORIES = ["A", "B", "C", "D"]  # opaque categories, equity analysis only

# Approximate introduction grade per grade_band (for node difficulty).
_GRADE_BAND_TO_GRADE = {
    "FK": 0, "1–3": 2, "4–6": 5, "5–6": 5, "7": 7,
    "7–8": 7, "8": 8, "7–9": 8, "8–9": 8, "9": 9,
}

# Which ability dimension each node is tagged with on the year-9 national test.
_NODE_ABILITY = {
    "N17": "begrepp", "N18": "metod", "N19": "metod", "N20": "resonemang",
    "N21": "begrepp", "N22": "metod", "N23": "problemlosning",
    "N24": "metod", "N25": "resonemang", "N26": "kommunikation",
    "N27": "problemlosning",
}

SCHOOL_NAMES = [
    "Centrumskolan", "Bergsskolan", "Älvstrandsskolan", "Lindängsskolan",
    "Hagaskolan", "Norra skolan", "Sjöstadsskolan", "Backaskolan",
]


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def _node_difficulty(nid: str) -> float:
    node = prog.NODE_BY_ID[nid]
    g = _GRADE_BAND_TO_GRADE.get(node.grade_band, 5)
    # Calibrated so a median pupil (aptitude 0) clears most nodes; difficulty
    # rises gently with grade and gates are a touch harder.
    diff = -1.68 + 0.055 * g
    if node.is_gate:
        diff += 0.10
    return diff


def _grade_from_fraction(frac: float) -> str:
    if frac < 0.30:
        return "F"
    if frac < 0.45:
        return "E"
    if frac < 0.60:
        return "D"
    if frac < 0.72:
        return "C"
    if frac < 0.85:
        return "B"
    return "A"


@dataclass
class StudentPlan:
    """Per-student configuration that drives the simulation."""
    aptitude: float
    forced_gaps: set[str] = field(default_factory=set)  # nodes settled artificially low
    # node_id -> {grade: measured_mastery} overrides (e.g. the recoverer)
    measured_overrides: dict[str, dict[int, float]] = field(default_factory=dict)


@dataclass
class SimResult:
    huvudman: Huvudman
    schools: list[School]
    klasses: list[Klass]
    teachers: list[Teacher]
    teacher_klasses: list[TeacherKlass]
    students: list[Student]
    assessments: list[Assessment]
    outcomes: list[Ak9Outcome]
    scenarios: dict[str, str]  # scenario name -> student id


class Simulator:
    def __init__(self, target_students: int, seed: int):
        self.rng = np.random.default_rng(seed)
        self.target = target_students
        self.n_schools = 6 if target_students <= 2200 else (7 if target_students <= 2800 else 8)
        self.students_per_class = max(
            12, round(target_students / (self.n_schools * len(GRADES) * CLASSES_PER_GRADE))
        )
        self._student_counter = 0

    # -- settled mastery via topological cascade -------------------------------
    def _settled_mastery(self, plan: StudentPlan) -> dict[str, float]:
        """Bottleneck cascade: a node is gated by its *weakest* prerequisite.

        Mathematics is sequential -- you cannot do algebra (N17) without
        proportionality (N12). So a node's mastery is limited by its weakest
        prerequisite's "readiness" (a smoothstep around the 0.5 threshold). A
        failed node lands low enough that it, in turn, fails its own children,
        so a single missed gate propagates all the way down. Adequately-prepared
        pupils (all prereqs >= ~0.6) are unaffected and clear the node on aptitude.
        """
        mastery: dict[str, float] = {}
        for nid in prog.topological_order():
            node = prog.NODE_BY_ID[nid]
            if nid in plan.forced_gaps:
                mastery[nid] = float(np.clip(self.rng.normal(0.12, 0.05), 0.02, 0.30))
                continue
            base = _sigmoid(1.6 * (plan.aptitude - _node_difficulty(nid)))
            readiness = 1.0
            for pre in node.prerequisites:
                pm = mastery[pre]
                # readiness: 0 when prereq <= 0.20, 1 when prereq >= 0.60.
                r = float(np.clip((pm - 0.20) / 0.40, 0.0, 1.0))
                readiness = min(readiness, r)  # the weakest prerequisite gates
            m = base * (0.15 + 0.85 * readiness) + self.rng.normal(0.0, 0.05)
            mastery[nid] = float(np.clip(m, 0.02, 0.99))
        return mastery

    # -- assessments at realistic measurement occasions ------------------------
    def _emit_assessments(
        self, student_id: str, current_grade: int, settled: dict[str, float],
        plan: StudentPlan, base_year: int,
    ) -> list[Assessment]:
        rows: list[Assessment] = []
        for grade in range(0, current_grade + 1):
            nodes = prog.MEASUREMENT_PLAN.get(grade, [])
            source = prog.source_for_grade(grade)
            # Spread measurement dates across the relevant school year.
            datum = date(base_year + grade, 5, 15)
            for nid in nodes:
                override = plan.measured_overrides.get(nid, {}).get(grade)
                if override is not None:
                    value = override
                else:
                    value = float(np.clip(settled[nid] + self.rng.normal(0.0, 0.07), 0.0, 1.0))
                ability = _NODE_ABILITY.get(nid, "metod" if source == "np_ak9" else "begrepp")
                rows.append(Assessment(
                    student_id=student_id, node_id=nid, datum=datum,
                    arskurs=grade, source=source, mastery=round(value, 3), ability=ability,
                ))
        return rows

    def _ak9_outcome(self, student_id: str, settled: dict[str, float]) -> Ak9Outcome:
        crit = prog.CRITICAL_AK9_NODES
        frac = float(np.mean([1.0 if settled[n] >= 0.5 else 0.0 for n in crit]))
        prov = _grade_from_fraction(frac)
        # Final grade (slutbetyg) tends to be marginally higher than the test grade.
        bump = frac + self.rng.normal(0.04, 0.04)
        slut = _grade_from_fraction(float(np.clip(bump, 0.0, 1.0)))
        return Ak9Outcome(student_id=student_id, provbetyg=prov, slutbetyg=slut)

    def _next_student_id(self) -> str:
        self._student_counter += 1
        return f"elev-{self._student_counter:05d}"

    def run(self) -> SimResult:
        rng = self.rng
        huvudman = Huvudman(id=1, namn="Demokommunen")
        schools: list[School] = []
        klasses: list[Klass] = []
        teachers: list[Teacher] = []
        teacher_klasses: list[TeacherKlass] = []
        students: list[Student] = []
        assessments: list[Assessment] = []
        outcomes: list[Ak9Outcome] = []
        scenarios: dict[str, str] = {}

        # Spread intag_index across schools; school 0 is the "grindskola".
        intag_values = np.linspace(0.30, 0.85, self.n_schools)
        rng.shuffle(intag_values)

        lasar = "2025/26"
        current_year = 2025
        klass_id = 0
        teacher_id = 0

        for s_idx in range(self.n_schools):
            school_id = s_idx + 1
            intag = float(intag_values[s_idx])
            is_grindskola = (s_idx == 0)
            namn = SCHOOL_NAMES[s_idx % len(SCHOOL_NAMES)]
            if is_grindskola:
                # Force a low intag-independent gate failure school for the demo.
                namn = "Centrumskolan"
            schools.append(School(id=school_id, huvudman_id=1, namn=namn, intag_index=round(intag, 3)))

            school_effect = 0.5 * (intag - 0.55)  # small effect; spread only

            for grade in GRADES:
                for c in range(CLASSES_PER_GRADE):
                    klass_id += 1
                    beteckning = f"{grade if grade > 0 else 'FK'}{chr(65 + c)}"
                    klasses.append(Klass(
                        id=klass_id, school_id=school_id, beteckning=beteckning,
                        arskurs=grade, lasar=lasar,
                    ))
                    teacher_id += 1
                    teachers.append(Teacher(id=teacher_id, school_id=school_id,
                                            namn=f"Lärare {teacher_id}"))
                    teacher_klasses.append(TeacherKlass(teacher_id=teacher_id, klass_id=klass_id))

                    for _ in range(self.students_per_class):
                        sid = self._next_student_id()
                        ses = SES_CATEGORIES[rng.integers(0, len(SES_CATEGORIES))]
                        students.append(Student(id=sid, klass_id=klass_id, ses_kontext=ses))

                        aptitude = float(rng.normal(0.0, 1.0) + school_effect)
                        plan = StudentPlan(aptitude=aptitude)

                        # Grindskolan: proportionality (N12) is systematically missed
                        # in year 6 regardless of intake -- a teaching/system gap.
                        if is_grindskola and grade >= 5 and rng.random() < 0.45:
                            plan.forced_gaps.add("N12")

                        settled = self._settled_mastery(plan)
                        # base_year so that a year-9 pupil's FK measurement is ~9 years back
                        base_year = current_year - grade
                        assessments.extend(
                            self._emit_assessments(sid, grade, settled, plan, base_year)
                        )
                        if grade == 9:
                            outcomes.append(self._ak9_outcome(sid, settled))

        # Inject the three named demo scenarios (overwrite chosen year-9 students).
        self._inject_scenarios(students, assessments, outcomes, scenarios)

        return SimResult(
            huvudman=huvudman, schools=schools, klasses=klasses, teachers=teachers,
            teacher_klasses=teacher_klasses, students=students, assessments=assessments,
            outcomes=outcomes, scenarios=scenarios,
        )

    # -- named scenarios (SPEC section 12) ------------------------------------
    def _inject_scenarios(
        self, students: list[Student], assessments: list[Assessment],
        outcomes: list[Ak9Outcome], scenarios: dict[str, str],
    ) -> None:
        # Find year-9 students (klass arskurs 9) in a non-grindskola.
        klass_grade9 = {k.id for k in []}  # placeholder; recomputed below by helper
        # Build a map of klass_id -> arskurs and school via outcomes presence:
        year9_ids = [o.student_id for o in outcomes]
        if not year9_ids:
            return

        def reset_student(sid: str) -> None:
            assessments[:] = [a for a in assessments if a.student_id != sid]

        def settled_for(plan: StudentPlan) -> dict[str, float]:
            return self._settled_mastery(plan)

        base_year = 2025 - 9

        # 1) "Den tysta eleven": fine until year 5, drops N12 in year 6, F in year 9.
        #    N12 still looks OK in year 5 (measured 0.55) but the gap shows in year 6,
        #    so the pupil passes through year 5 and only turns red from year 6.
        silent_id = year9_ids[len(year9_ids) // 3]
        reset_student(silent_id)
        plan = StudentPlan(
            aptitude=0.45, forced_gaps={"N12"},
            measured_overrides={"N12": {5: 0.55}},
        )
        settled = settled_for(plan)
        assessments.extend(self._emit_assessments(silent_id, 9, settled, plan, base_year))
        self._replace_outcome(outcomes, self._ak9_outcome(silent_id, settled))
        scenarios["tysta_eleven"] = silent_id

        # 2) "Återhämtaren": early N12 gap that is remediated -> risk falls, passes.
        recover_id = year9_ids[len(year9_ids) // 2]
        if recover_id == silent_id and len(year9_ids) > 3:
            recover_id = year9_ids[len(year9_ids) // 2 + 1]
        reset_student(recover_id)
        # Settled mastery is genuinely fine (downstream nodes pass), but the
        # MEASURED N12 starts low in year 6 and visibly recovers afterwards.
        plan = StudentPlan(
            aptitude=1.15,  # genuinely capable -> passes once the N12 gap is closed
            measured_overrides={
                "N12": {5: 0.32, 6: 0.34, 7: 0.58, 8: 0.78},
            },
        )
        settled = settled_for(plan)
        rows = self._emit_assessments(recover_id, 9, settled, plan, base_year)
        # Add explicit recovery checkpoints for N12 in years 7 and 8.
        for g, val in ((7, 0.58), (8, 0.78)):
            rows.append(Assessment(
                student_id=recover_id, node_id="N12", datum=date(base_year + g, 5, 15),
                arskurs=g, source="checkpoint", mastery=val, ability="metod",
            ))
        assessments.extend(rows)
        self._replace_outcome(outcomes, self._ak9_outcome(recover_id, settled))
        scenarios["aterhamtaren"] = recover_id

        # 3) "Grindskolan" -> expose the school id with systematic N12 failure.
        scenarios["grindskolan_school_id"] = "1"

    @staticmethod
    def _replace_outcome(outcomes: list[Ak9Outcome], new: Ak9Outcome) -> None:
        for i, o in enumerate(outcomes):
            if o.student_id == new.student_id:
                outcomes[i] = new
                return
        outcomes.append(new)


def generate(students: int, seed: int) -> SimResult:
    return Simulator(students, seed).run()
