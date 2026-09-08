"""Generate a static snapshot of the API for GitHub Pages (no running server).

Seeds the synthetic cohort, then writes every GET response the frontend needs
to ``<out>/<path>.json`` so the SPA can run fully static. Used by the Pages
workflow; configure via env:

    SNAPSHOT_OUT       output dir (default ../frontend/public/api)
    SNAPSHOT_STUDENTS  cohort size (default 2000)
    SNAPSHOT_SEED      RNG seed   (default 42)

    cd backend && python snapshot.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import engine
from app.main import app
from app.models import Klass, School, Student
from seed import run_seed

OUT = Path(os.environ.get("SNAPSHOT_OUT", "../frontend/public/api"))


def write(rel: str, data: object) -> None:
    target = OUT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    students = int(os.environ.get("SNAPSHOT_STUDENTS", "2000"))
    seed = int(os.environ.get("SNAPSHOT_SEED", "42"))
    run_seed(students, seed)

    client = TestClient(app)

    def grab(url: str, rel: str) -> None:
        res = client.get(url)
        res.raise_for_status()
        write(rel, res.json())

    # Singletons
    grab("/api/demo/scenarios", "demo/scenarios.json")
    grab("/api/progression/graph", "progression/graph.json")
    grab("/api/huvudman/overview", "huvudman/overview.json")
    # Full lists (the client filters these in static mode -- and recomputes the
    # loop KPIs locally when someone registers an insats in the published demo).
    grab("/api/students?limit=2000", "students.json")
    grab("/api/gaps?limit=5000", "gaps.json")

    with Session(engine) as session:
        schools = session.exec(select(School)).all()
        klasses = session.exec(select(Klass)).all()
        student_ids = [s.id for s in session.exec(select(Student)).all()]

    for sc in schools:
        grab(f"/api/schools/{sc.id}", f"schools/{sc.id}.json")

    for k in klasses:
        grab(f"/api/classes/{k.id}/heatmap", f"classes/{k.id}/heatmap.json")
        grab(f"/api/classes/{k.id}/focus", f"classes/{k.id}/focus.json")

    for sid in student_ids:
        grab(f"/api/students/{sid}", f"students/{sid}.json")
        grab(f"/api/students/{sid}/comparison", f"students/{sid}/comparison.json")

    print(
        f"Snapshot written to {OUT.resolve()}: "
        f"{len(schools)} skolor, {len(klasses)} klasser, {len(student_ids)} elever "
        f"({3 + len(schools) + 2 * len(klasses) + 2 * len(student_ids)} filer)."
    )


if __name__ == "__main__":
    main()
