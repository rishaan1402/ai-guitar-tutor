#!/bin/bash
# Startup script — runs Alembic migrations then starts the server.
# Used by the Docker container so the DB is always up-to-date on boot.
set -e

echo "Running database migrations..."
alembic upgrade head
echo "Migrations complete."

exec uvicorn main:app --host 0.0.0.0 --port 8000
