#!/bin/bash
# Startup script — runs Alembic migrations then starts the server.
# Works in Docker (fixed port 8000) and on Render ($PORT is set dynamically).
set -e

echo "Running database migrations..."
alembic upgrade head
echo "Migrations complete."

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
