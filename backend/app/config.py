"""Application configuration.

All settings come from environment variables so the demo stays portable.
Swapping ``DATABASE_URL`` (e.g. to a Postgres/Supabase connection string) is
the only change required to move off SQLite -- no SQLite-specific SQL lives in
the codebase.
"""
from __future__ import annotations

import os

# Default to a local SQLite file for a zero-setup demo. Override with e.g.
#   DATABASE_URL=postgresql+psycopg://user:pass@host/db
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./demo.db")

# Comma-separated list of allowed CORS origins (the Vite dev server by default).
CORS_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

# Default cohort size used by the seed routine / POST /api/seed.
DEFAULT_STUDENTS: int = int(os.getenv("DEFAULT_STUDENTS", "2000"))
DEFAULT_SEED: int = int(os.getenv("DEFAULT_SEED", "42"))
