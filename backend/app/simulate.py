"""Synthetic data generator -- the app's "secret sauce".

Generates a whole municipality flowing FK -> year 9. The pedagogical
simulation models the cumulative nature of mathematics: missing a prerequisite
(especially a *gate* node) sharply lowers the probability of mastering
downstream nodes. This is what makes the F-cascade -- and the demo's punchline
-- credible.

It also simulates the *closed loop*: gaps are detected from measurements, some
of them get an intervention, and the intervention is followed by an actual
re-measurement that flows back into mastery and risk. Schools differ in how
reliably they close the loop, independently of their intake -- that difference
is the whole point of the huvudman view.

GUARD (SPEC section 3): ``socioekonomiskt_index`` may influence ``aptitude`` here, in the
data generation, to create realistic spread. It must NEVER become a predictor
in ``risk.py``. Risk is computed purely from skill signal.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np

from . import loop
from . import progression as prog
from .models import (
    Ak9Outcome,
    Assessment,
    Huvudman,
    Klass,
    Kunskapslucka,
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

# How reliably each school closes the loop: (chance an intervention is started,
# chance it works). Deliberately UNCORRELATED with the socioeconomic index -- closing gaps
# is a system behaviour, not an intake question. School 0 (Centrumskolan) sees
# its gaps and rarely acts on them; that is the finding the demo is built on.
SCHOOL_LOOP_PROFILES: list[tuple[float, float]] = [
    (0.30, 0.40),
    (0.86, 0.80),
    (0.72, 0.70),
    (0.58, 0.62),
    (0.90, 0.75),
    (0.54, 0.56),
    (0.78, 0.68),
    (0.66, 0.60),
]

# Only gaps on nodes that actually gate a passing year-9 grade are tracked --
# the same set risk.py scores on.
RELEVANT_NODES: set[str] = set()
for _crit in prog.CRITICAL_AK9_NODES:
    RELEVANT_NODES |= prog.all_prerequisites(_crit) | {_crit}


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
    gaps: list[Kunskapslucka]
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
    def _noise(self) -> dict[str, float]:
        """One noise draw per node, shared between the pre- and post-intervention
        cascade so that remediating one node does not reshuffle everything else."""
        return {nid: float(self.rng.normal(0.0, 0.05)) for nid in prog.NODE_BY_ID}

    def _settled_mastery(
        self,
        plan: StudentPlan,
        noise: dict[str, float] | None = None,
        pinned: dict[str, float] | None = None,
    ) -> dict[str, float]:
        """Bottleneck cascade: a node is gated by its *weakest* prerequisite.

        Mathematics is sequential -- you cannot do algebra (N17) without
        proportionality (N12). So a node's mastery is limited by its weakest
        prerequisite's "readiness" (a smoothstep around the 0.5 threshold). A
        failed node lands low enough that it, in turn, fails its own children,
        so a single missed gate propagates all the way down. Adequately-prepared
        pupils (all prereqs >= ~0.6) are unaffected and clear the node on aptitude.

        ``pinned`` lifts a node to a fixed value -- how a *successful* intervention
        enters the model: the repaired prerequisite unblocks everything below it.
        """
        if noise is None:
            noise = self._noise()
        mastery: dict[str, float] = {}
        for nid in prog.topological_order():
            node = prog.NODE_BY_ID[nid]
            if pinned is not None and nid in pinned:
                mastery[nid] = pinned[nid]
                continue
            if nid in plan.forced_gaps:
                mastery[nid] = float(np.clip(0.12 + noise[nid], 0.02, 0.30))
                continue
            base = _sigmoid(1.6 * (plan.aptitude - _node_difficulty(nid)))
            readiness = 1.0
            for pre in node.prerequisites:
                pm = mastery[pre]
                # readiness: 0 when prereq <= 0.20, 1 when prereq >= 0.60.
                r = float(np.clip((pm - 0.20) / 0.40, 0.0, 1.0))
                readiness = min(readiness, r)  # the weakest prerequisite gates
            m = base * (0.15 + 0.85 * readiness) + noise[nid]
            mastery[nid] = float(np.clip(m, 0.02, 0.99))
        return mastery

    # -- assessments at realistic measurement occasions ------------------------
    def _measurement_noise(self, current_grade: int) -> dict[tuple[str, int], float]:
        """Measurement error per (node, occasion), drawn once so that re-emitting
        a pupil's measurements after an intervention changes only what the
        intervention actually changed."""
        return {
            (nid, g): float(self.rng.normal(0.0, 0.07))
            for g in range(0, current_grade + 1)
            for nid in prog.MEASUREMENT_PLAN.get(g, [])
        }

    def _emit_assessments(
        self, student_id: str, current_grade: int, settled: dict[str, float],
        plan: StudentPlan, base_year: int,
        settled_after: dict[str, float] | None = None, fix_grade: int | None = None,
        mnoise: dict[tuple[str, int], float] | None = None,
    ) -> list[Assessment]:
        """Ordinary measurement occasions FK -> current grade.

        From ``fix_grade`` onwards the pupil is measured against ``settled_after``
        -- the state after a successful intervention.
        """
        rows: list[Assessment] = []
        for grade in range(0, current_grade + 1):
            nodes = prog.MEASUREMENT_PLAN.get(grade, [])
            source = prog.source_for_grade(grade)
            # Spread measurement dates across the relevant school year.
            datum = date(base_year + grade, 5, 15)
            active = settled
            if settled_after is not None and fix_grade is not None and grade >= fix_grade:
                active = settled_after
            for nid in nodes:
                override = plan.measured_overrides.get(nid, {}).get(grade)
                if override is not None:
                    value = override
                else:
                    err = (mnoise or {}).get((nid, grade))
                    if err is None:
                        err = float(self.rng.normal(0.0, 0.07))
                    value = float(np.clip(active[nid] + err, 0.0, 1.0))
                ability = _NODE_ABILITY.get(nid, "metod" if source == "np_ak9" else "begrepp")
                rows.append(Assessment(
                    student_id=student_id, node_id=nid, datum=datum,
                    arskurs=grade, source=source, mastery=round(value, 3), ability=ability,
                ))
        return rows

    # -- the loop: intervention + re-measurement --------------------------------
    def _make_intervention(
        self, ep: dict, current_grade: int, p_success: float,
    ) -> dict | None:
        """Turn a detected gap episode into an intervention with a follow-up.

        Interventions start at the beginning of the term after detection -- a
        third of them drift past the four-week deadline.
        """
        rng = self.rng
        upptackt: date = ep["upptackt_datum"]
        terminsstart = (
            date(upptackt.year, 8, 25) if upptackt.month < 8
            else date(upptackt.year + 1, 1, 12)
        )
        offset = int(rng.integers(0, 18)) if rng.random() < 0.65 else int(rng.integers(35, 80))
        insats_startad = terminsstart + timedelta(days=offset)
        if insats_startad > loop.DEMO_TODAY:
            return None

        iv = {
            "node_id": ep["node_id"],
            "det_grade": ep["upptackt_arskurs"],
            "upptackt_datum": upptackt,
            "insats_startad": insats_startad,
            "planerad_ommatning": loop.planerad_ommatning_fran(insats_startad),
            "ommatt_datum": None,
            "ommatt_mastery": None,
            "success": False,
        }

        ommatt_datum = iv["planerad_ommatning"] + timedelta(days=int(rng.integers(-7, 31)))
        if ommatt_datum > loop.DEMO_TODAY:
            return iv  # started, re-measurement not due yet -- still "pågående"

        iv["ommatt_datum"] = ommatt_datum
        if rng.random() < p_success:
            iv["success"] = True
            iv["ommatt_mastery"] = round(float(rng.uniform(0.60, 0.88)), 3)
        else:
            iv["ommatt_mastery"] = round(float(rng.uniform(0.16, 0.46)), 3)
        return iv

    def _plan_interventions(
        self, student_id: str, current_grade: int, plan: StudentPlan,
        base_year: int, profile: tuple[float, float],
    ) -> tuple[list[Assessment], list[dict], dict[str, float]]:
        """Simulate one pupil end to end: measurements, gaps, what was done about
        them, and what the follow-up measurement showed.

        A *successful* intervention on the pupil's root gap is pinned back into
        the cascade, so the repaired prerequisite unblocks everything downstream
        -- which is why closing gaps shows up in year-9 results at all.
        """
        rng = self.rng
        p_insats, p_success = profile
        noise = self._noise()
        mnoise = self._measurement_noise(current_grade)
        settled = self._settled_mastery(plan, noise)
        rows = self._emit_assessments(
            student_id, current_grade, settled, plan, base_year, mnoise=mnoise
        )

        def relevant_episodes(assessments: list[Assessment]) -> list[dict]:
            return [e for e in loop.derive_episodes(assessments)
                    if e["node_id"] in RELEVANT_NODES]

        episodes = relevant_episodes(rows)
        settled_final = settled
        interventions: list[dict] = []

        # The root gap -- earliest detected -- is the one worth repairing first.
        if episodes and rng.random() < p_insats:
            root = episodes[0]
            iv = self._make_intervention(root, current_grade, p_success)
            if iv is not None:
                interventions.append(iv)
                if iv["success"] and root["upptackt_arskurs"] < current_grade:
                    settled_final = self._settled_mastery(
                        plan, noise, pinned={root["node_id"]: iv["ommatt_mastery"]}
                    )
                    rows = self._emit_assessments(
                        student_id, current_grade, settled, plan, base_year,
                        settled_after=settled_final,
                        fix_grade=root["upptackt_arskurs"] + 1, mnoise=mnoise,
                    )
                    episodes = relevant_episodes(rows)

        # Remaining gaps are acted on less consistently than the root one.
        handled = {(iv["node_id"], iv["upptackt_datum"]) for iv in interventions}
        for ep in episodes:
            if (ep["node_id"], ep["upptackt_datum"]) in handled:
                continue
            if rng.random() >= p_insats * 0.75:
                continue
            iv = self._make_intervention(ep, current_grade, p_success)
            if iv is not None:
                interventions.append(iv)

        for iv in interventions:
            ommatning = self._ommatning_row(student_id, iv, current_grade)
            if ommatning is not None:
                rows.append(ommatning)

        return rows, interventions, settled_final

    @staticmethod
    def _ommatning_row(student_id: str, iv: dict, current_grade: int) -> Assessment | None:
        """The re-measurement enters the system as an ordinary measurement.

        This is the guard made concrete: the intervention record itself changes
        nothing -- only this row moves mastery, and therefore risk.
        """
        if iv.get("ommatt_datum") is None:
            return None
        arskurs = min(iv["det_grade"] + 1, current_grade)
        return Assessment(
            student_id=student_id, node_id=iv["node_id"],
            datum=iv["ommatt_datum"], arskurs=arskurs, source="ommatning",
            mastery=iv["ommatt_mastery"], ability="metod",
        )

    def _build_gaps(
        self, student_id: str, school_id: int, klass_id: int,
        assessments: list[Assessment], interventions: list[dict],
        teacher: Teacher | None,
    ) -> list[Kunskapslucka]:
        """Persist one row per gap episode, with the loop fields filled in."""
        by_key = {(iv["node_id"], iv["upptackt_datum"]): iv for iv in interventions}
        rows: list[Kunskapslucka] = []
        for ep in loop.derive_episodes(assessments):
            if ep["node_id"] not in RELEVANT_NODES:
                continue
            gap = Kunskapslucka(
                student_id=student_id, node_id=ep["node_id"],
                school_id=school_id, klass_id=klass_id,
                upptackt_datum=ep["upptackt_datum"],
                upptackt_arskurs=ep["upptackt_arskurs"],
                upptackt_mastery=ep["upptackt_mastery"],
            )
            iv = by_key.get((ep["node_id"], ep["upptackt_datum"]))
            if iv is not None:
                gap.insats_startad = iv["insats_startad"]
                gap.insats_ansvarig_id = teacher.id if teacher else None
                gap.insats_ansvarig_namn = teacher.namn if teacher else None
                gap.planerad_ommatning = iv["planerad_ommatning"]
                gap.ommatt_datum = iv["ommatt_datum"]
                gap.ommatt_mastery = iv["ommatt_mastery"]

            if ep["stangd_datum"] is not None:
                # Re-measured at or above threshold -- by the intervention's
                # follow-up or, sometimes, by an ordinary later measurement.
                gap.ommatt_datum = ep["stangd_datum"]
                gap.ommatt_mastery = ep["stangd_mastery"]
                gap.utfall = loop.UTFALL_STANGD
                gap.stangd_datum = ep["stangd_datum"]
            elif gap.ommatt_datum is not None:
                gap.utfall = loop.UTFALL_KVARSTAR
            elif gap.insats_startad is not None:
                gap.utfall = loop.UTFALL_PAGAENDE
            else:
                gap.utfall = loop.UTFALL_OPPEN
            rows.append(gap)
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
        gaps: list[Kunskapslucka] = []
        scenarios: dict[str, str] = {}

        # Spread the socioeconomic index across schools (higher = greater need,
        # as in the city's resource allocation); school 0 is the "grindskola".
        sei_values = np.linspace(0.15, 0.70, self.n_schools)
        rng.shuffle(sei_values)

        lasar = "2025/26"
        current_year = 2025
        klass_id = 0
        teacher_id = 0

        for s_idx in range(self.n_schools):
            school_id = s_idx + 1
            sei = float(sei_values[s_idx])
            is_grindskola = (s_idx == 0)
            namn = SCHOOL_NAMES[s_idx % len(SCHOOL_NAMES)]
            if is_grindskola:
                # Force an index-independent gate failure school for the demo.
                namn = "Centrumskolan"
            schools.append(School(
                id=school_id, huvudman_id=1, namn=namn, socioekonomiskt_index=round(sei, 3),
            ))

            school_effect = 0.5 * (0.45 - sei)  # small effect; spread only
            profile = SCHOOL_LOOP_PROFILES[s_idx % len(SCHOOL_LOOP_PROFILES)]

            for grade in GRADES:
                for c in range(CLASSES_PER_GRADE):
                    klass_id += 1
                    beteckning = f"{grade if grade > 0 else 'FK'}{chr(65 + c)}"
                    klasses.append(Klass(
                        id=klass_id, school_id=school_id, beteckning=beteckning,
                        arskurs=grade, lasar=lasar,
                    ))
                    teacher_id += 1
                    teacher = Teacher(id=teacher_id, school_id=school_id,
                                      namn=f"Lärare {teacher_id}")
                    teachers.append(teacher)
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

                        # base_year so that a year-9 pupil's FK measurement is ~9 years back
                        base_year = current_year - grade
                        rows, interventions, settled_final = self._plan_interventions(
                            sid, grade, plan, base_year, profile,
                        )
                        assessments.extend(rows)
                        gaps.extend(self._build_gaps(
                            sid, school_id, klass_id, rows, interventions, teacher,
                        ))
                        if grade == 9:
                            outcomes.append(self._ak9_outcome(sid, settled_final))

        # Inject the three named demo scenarios (overwrite chosen year-9 students).
        self._inject_scenarios(students, assessments, outcomes, gaps, klasses, teachers, scenarios)

        return SimResult(
            huvudman=huvudman, schools=schools, klasses=klasses, teachers=teachers,
            teacher_klasses=teacher_klasses, students=students, assessments=assessments,
            outcomes=outcomes, gaps=gaps, scenarios=scenarios,
        )

    # -- named scenarios (SPEC section 12) ------------------------------------
    def _inject_scenarios(
        self, students: list[Student], assessments: list[Assessment],
        outcomes: list[Ak9Outcome], gaps: list[Kunskapslucka],
        klasses: list[Klass], teachers: list[Teacher], scenarios: dict[str, str],
    ) -> None:
        year9_ids = [o.student_id for o in outcomes]
        if not year9_ids:
            return

        student_by_id = {s.id: s for s in students}
        klass_by_id = {k.id: k for k in klasses}
        teacher_by_school: dict[int, Teacher] = {}
        for t in teachers:
            teacher_by_school.setdefault(t.school_id, t)

        def reset_student(sid: str) -> None:
            assessments[:] = [a for a in assessments if a.student_id != sid]
            gaps[:] = [g for g in gaps if g.student_id != sid]

        def place(sid: str) -> tuple[int, int, Teacher | None]:
            student = student_by_id[sid]
            klass = klass_by_id[student.klass_id]
            return klass.school_id, klass.id, teacher_by_school.get(klass.school_id)

        base_year = 2025 - 9

        # 1) "Den tysta eleven": fine until year 5, drops N12 in year 6, F in year 9.
        #    N12 still looks OK in year 5 (measured 0.55) but the gap shows in year 6,
        #    so the pupil passes through year 5 and only turns red from year 6.
        #    Nobody ever starts an intervention -- that is the point of her story.
        silent_id = year9_ids[len(year9_ids) // 3]
        reset_student(silent_id)
        plan = StudentPlan(
            aptitude=0.45, forced_gaps={"N12"},
            measured_overrides={"N12": {5: 0.55}},
        )
        settled = self._settled_mastery(plan)
        rows = self._emit_assessments(silent_id, 9, settled, plan, base_year)
        assessments.extend(rows)
        school_id, klass_id, _teacher = place(silent_id)
        gaps.extend(self._build_gaps(silent_id, school_id, klass_id, rows, [], None))
        self._replace_outcome(outcomes, self._ak9_outcome(silent_id, settled))
        scenarios["tysta_eleven"] = silent_id

        # 2) "Återhämtaren": the same N12 gap as the silent pupil, found in the same
        #    year 6 -- but here somebody acts. Insats at the start of year 7,
        #    re-measured ten weeks later, gap closed. The loop, end to end.
        recover_id = year9_ids[len(year9_ids) // 2]
        if recover_id == silent_id and len(year9_ids) > 3:
            recover_id = year9_ids[len(year9_ids) // 2 + 1]
        reset_student(recover_id)
        plan = StudentPlan(
            aptitude=1.15,  # genuinely capable -> passes once the N12 gap is closed
            measured_overrides={"N12": {5: 0.55, 6: 0.34}},
        )
        settled = self._settled_mastery(plan)
        rows = self._emit_assessments(recover_id, 9, settled, plan, base_year)
        school_id, klass_id, teacher = place(recover_id)
        insats_startad = date(base_year + 6, 9, 8)  # HT år 7, inom fristen
        episode = {
            "node_id": "N12",
            "det_grade": 6,
            "upptackt_datum": date(base_year + 6, 5, 15),
            "insats_startad": insats_startad,
            "planerad_ommatning": loop.planerad_ommatning_fran(insats_startad),
            "ommatt_datum": date(base_year + 6, 11, 24),
            "ommatt_mastery": 0.71,
            "success": True,
        }
        rows.append(Assessment(
            student_id=recover_id, node_id="N12", datum=episode["ommatt_datum"],
            arskurs=7, source="ommatning", mastery=0.71, ability="metod",
        ))
        # Later ordinary checkpoints confirm the gap stayed closed.
        for g, val in ((7, 0.74), (8, 0.81)):
            rows.append(Assessment(
                student_id=recover_id, node_id="N12", datum=date(base_year + g, 5, 15),
                arskurs=g, source="checkpoint", mastery=val, ability="metod",
            ))
        assessments.extend(rows)
        gaps.extend(self._build_gaps(recover_id, school_id, klass_id, rows, [episode], teacher))
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
