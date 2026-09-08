"""FastAPI application: CORS, routers, health, and the demo seed control."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .db import init_db
from .routers import classes, gaps, huvudman, progression, schools, students

app = FastAPI(title="Matematikuppföljning FK→Åk9 (demo)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/demo/scenarios")
def demo_scenarios() -> dict:
    """Scenario student ids (e.g. the silent pupil) for quick links in the demo."""
    from sqlmodel import Session, select

    from .db import engine
    from .models import DemoMeta

    with Session(engine) as session:
        rows = session.exec(select(DemoMeta)).all()
    return {r.key: r.value for r in rows}


@app.post("/api/seed")
def seed(students: int = 2000, seed: int = 42) -> dict:
    """Regenerate synthetic data (demo control)."""
    # Imported lazily so the heavy simulation deps load only when invoked.
    from seed import run_seed

    scenarios = run_seed(students, seed)
    return {"status": "ok", "students": students, "seed": seed, "scenarios": scenarios}


app.include_router(progression.router)
app.include_router(students.router)
app.include_router(gaps.router)
app.include_router(classes.router)
app.include_router(schools.router)
app.include_router(huvudman.router)
