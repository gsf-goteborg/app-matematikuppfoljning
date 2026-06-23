"""Progression graph endpoint (nodes + edges for the DAG view)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import SkillEdge, SkillNode
from ..schemas import GraphEdge, GraphNode, ProgressionGraph

router = APIRouter(prefix="/api/progression", tags=["progression"])


@router.get("/graph", response_model=ProgressionGraph)
def get_graph(session: Session = Depends(get_session)) -> ProgressionGraph:
    nodes = session.exec(select(SkillNode)).all()
    edges = session.exec(select(SkillEdge)).all()
    return ProgressionGraph(
        nodes=[GraphNode(**n.model_dump()) for n in nodes],
        edges=[GraphEdge(**e.model_dump()) for e in edges],
    )
