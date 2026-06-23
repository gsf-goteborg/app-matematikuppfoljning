"""Seed the database: progression graph + synthetic cohort + risk scores.

Usage:
    python seed.py --students 2000 --seed 42
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict

from sqlmodel import Session, SQLModel, delete

from app import progression as prog
from app import risk as risk_engine
from app import simulate
from app.config import DEFAULT_SEED, DEFAULT_STUDENTS
from app.db import engine, init_db
from app.models import (
    Ak9Outcome,
    Assessment,
    Huvudman,
    Klass,
    RiskScore,
    School,
    SkillEdge,
    SkillNode,
    Student,
    Teacher,
    TeacherKlass,
)


def _seed_progression(session: Session) -> None:
    for n in prog.NODES:
        session.add(SkillNode(
            id=n.id, label_sv=n.label_sv, content_area=n.content_area,
            grade_band=n.grade_band, is_gate=n.is_gate,
        ))
    for prereq, node_id in prog.edges():
        session.add(SkillEdge(prereq_id=prereq, node_id=node_id))


def _clear(session: Session) -> None:
    for model in (RiskScore, Ak9Outcome, Assessment, Student, TeacherKlass,
                  Teacher, Klass, School, Huvudman, SkillEdge, SkillNode):
        session.exec(delete(model))


def run_seed(students: int, seed: int) -> dict[str, str]:
    init_db()
    with Session(engine) as session:
        _clear(session)
        session.commit()

        _seed_progression(session)

        result = simulate.generate(students, seed)
        session.add(result.huvudman)
        for obj in (result.schools + result.klasses + result.teachers
                    + result.teacher_klasses):
            session.add(obj)
        session.commit()

        for st in result.students:
            session.add(st)
        session.commit()

        for a in result.assessments:
            session.add(a)
        for o in result.outcomes:
            session.add(o)
        session.commit()

        # Compute risk trajectories from the assessments we just wrote.
        by_student: dict[str, list[Assessment]] = defaultdict(list)
        for a in result.assessments:
            by_student[a.student_id].append(a)
        n_scores = 0
        for sid, rows in by_student.items():
            for rs in risk_engine.compute_trajectory(sid, rows):
                session.add(rs)
                n_scores += 1
        session.commit()

        print(f"Seeded: {len(result.schools)} skolor, {len(result.students)} elever, "
              f"{len(result.assessments)} mätningar, {len(result.outcomes)} åk9-utfall, "
              f"{n_scores} riskpunkter.")
        print("Demo-scenarier:")
        for k, v in result.scenarios.items():
            print(f"  {k}: {v}")
        return result.scenarios


def main() -> None:
    p = argparse.ArgumentParser(description="Seed synthetic mathematics-monitoring data.")
    p.add_argument("--students", type=int, default=DEFAULT_STUDENTS)
    p.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = p.parse_args()
    scenarios = run_seed(args.students, args.seed)
    # Write scenario ids to a file so the README/frontend can reference them.
    with open("seed_scenarios.json", "w", encoding="utf-8") as f:
        json.dump(scenarios, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
