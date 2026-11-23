#!/usr/bin/env bash
# Backend for the end-to-end tests: a throwaway SQLite database, migrated,
# seeded with one song lesson, served on port 8100. No AI key is needed.
set -euo pipefail
cd "$(dirname "$0")/../../backend"
DB_DIR="$(mktemp -d)"
export DATABASE_URL="sqlite+aiosqlite:///${DB_DIR}/e2e.db"
export ALLOWED_ORIGINS="http://localhost:3100"
export LLM_DAILY_BUDGET=0
unset GROQ_API_KEY K_SERVICE || true
python3 -m alembic upgrade head >/dev/null
python3 tests/e2e_seed.py
exec python3 -m uvicorn main:app --port 8100
