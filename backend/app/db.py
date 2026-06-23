"""Database engine and session management (portable across SQLite/Postgres)."""
from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import DATABASE_URL

# ``check_same_thread`` is only meaningful for SQLite; for any other backend we
# pass no special connect args, keeping the code engine-agnostic.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, echo=False, connect_args=_connect_args)


def init_db() -> None:
    """Create all tables. Import models lazily to register them on the metadata."""
    from . import models  # noqa: F401  (ensures tables are registered)

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a database session."""
    with Session(engine) as session:
        yield session
