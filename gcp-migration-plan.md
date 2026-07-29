# AI Guitar Tutor — GCP Migration Plan

## Repo health check (as of 2026-07-26)

| Area | Result |
|---|---|
| Backend tests (`pytest`, 63 tests) | 59 passed, 4 skipped, 0 failed |
| Frontend unit tests (`vitest`, 48 tests) | 48 passed |
| Frontend production build (`next build`) | Could not complete in this sandbox (killed silently, likely memory-constrained container — not a code issue). Worth a manual `npm run build` check before cutover. |
| Backend deps install | Clean install, no conflicts, Python 3.10–3.12 compatible |

Nothing in the codebase is currently broken. Two things worth knowing before migrating:

1. Chord-practice sessions (`_sessions` dict in `main.py`) live in backend process memory with a 1-hour TTL. Any platform that can run multiple instances or restart the container mid-session will drop that state — same risk exists today on Render, but Cloud Run's more aggressive autoscaling makes it more likely to surface.
2. Lesson audio/video (`data/lessons/`, ~11 MB) is baked into the Docker image and served via `FileResponse`. That works anywhere but doesn't get CDN caching for free.

---

## Current architecture

- **Frontend:** Next.js 14, deployed to Vercel, auto-deploy from `main`.
- **Backend:** FastAPI on Render (free tier — spins down after 15 min idle), Dockerized, Alembic migrations run on every boot via `start.sh`.
- **Database:** Render-managed Postgres (free tier — 1 GB, expires after 90 days).
- **Secrets:** `GROQ_API_KEY`, `JWT_SECRET_KEY`, `ALLOWED_ORIGINS` set via Render dashboard env vars.
- **Static lesson assets:** shipped inside the backend Docker image.

## Target GCP architecture

| Current piece | GCP equivalent | Why |
|---|---|---|
| Render web service (FastAPI Docker) | **Cloud Run** | Same container-based deploy model as Render; scales to zero, pay-per-request, no server management. Minimal code change. |
| Render Postgres | **Cloud SQL for PostgreSQL** | Managed Postgres, same engine — `asyncpg`/SQLAlchemy code needs no changes, just a new `DATABASE_URL`. |
| Render env var secrets | **Secret Manager** + Cloud Run secret mounts | Keeps `GROQ_API_KEY`/`JWT_SECRET_KEY` out of plain env vars and build logs. |
| `data/lessons/` baked into image | **Cloud Storage bucket**, served via signed URLs or a Cloud CDN-backed bucket | Shrinks the container image, lets audio/video be cached at the edge instead of round-tripping through the API on every request. |
| Docker build on Render | **Cloud Build** + **Artifact Registry** | Builds the image and pushes it; can be wired to trigger on push to `main`, matching current auto-deploy behavior. |
| In-memory session dict | Unchanged initially; optionally **Memorystore (Redis)** later | Only needed if you scale to >1 Cloud Run instance and want sessions to survive instance recycling. Not required for launch. |
| Vercel frontend | **Leave on Vercel**, or move to **Firebase Hosting** / Cloud Run (Next.js SSR container) | Vercel is free, works well for Next.js today, and isn't causing any issues — moving it is optional, not required for a "backend to GCP" migration. Only move it if the goal is 100% GCP. |

## Migration steps

1. **Provision Cloud SQL** — create a Postgres 16 instance, database `guitar_tutor`, a `guitar` user. Enable the Cloud SQL Auth Proxy or private IP + Serverless VPC Connector for Cloud Run to reach it.
2. **Move secrets to Secret Manager** — create secrets for `JWT_SECRET_KEY` and `GROQ_API_KEY`; grant the Cloud Run service account `secretmanager.secretAccessor`.
3. **Adjust `db/engine.py` if needed** — none required; it already normalizes `postgres://`/`postgresql://` to `postgresql+asyncpg://`, and Cloud SQL connection strings work the same way (via the proxy socket or private IP).
4. **Containerize for Cloud Run** — existing `backend/Dockerfile` and `start.sh` (runs `alembic upgrade head` then `uvicorn`) work as-is; Cloud Run just needs the container to listen on `$PORT`, which `start.sh` already does.
5. **Set up Cloud Build trigger** — connect the GitHub repo, trigger on push to `main`, build via `backend/Dockerfile` (context = repo root, same as `docker-compose.yml` already assumes), push to Artifact Registry, deploy new revision to Cloud Run.
6. **Move lesson assets to Cloud Storage** — upload `data/lessons/*` and `data/chords/*.json` to a bucket; update `lesson_service/service.py` (and the `/video/{chord}`, `/audio/{chord}` endpoints) to redirect or proxy to signed GCS URLs instead of `FileResponse` from local disk. This step is optional for a first pass — you can keep assets in the image initially and migrate storage later.
7. **Point `DATABASE_URL`, `ALLOWED_ORIGINS`, `GROQ_API_KEY`, `JWT_SECRET_KEY` at Cloud Run env vars/secrets.**
8. **Migrate data** — `pg_dump` the Render Postgres instance, `pg_restore` (or `psql`) into Cloud SQL. Do this close to cutover to minimize drift, since users may be actively using the current Render DB.
9. **Update `ALLOWED_ORIGINS`** on the new Cloud Run service to the frontend's origin, and update `NEXT_PUBLIC_API_URL` in Vercel to the new Cloud Run URL (or a custom domain mapped to it).
10. **Cut over DNS/traffic** — if using a custom domain, map it via Cloud Run domain mapping or a global external Application Load Balancer in front of Cloud Run (the latter also gets you Cloud CDN and Cloud Armor for free if you want them later).
11. **Decommission Render** once Cloud Run has been serving production traffic cleanly for a few days.

## Things to decide before starting

- Keep the frontend on Vercel, or bring it fully into GCP too?
- Move lesson audio/video to Cloud Storage now, or defer that and ship it in the image for the first migration?
- Do you want a load balancer + custom domain + CDN in front of Cloud Run, or is the default `*.run.app` URL fine to start?
- Any budget constraints — Cloud Run/Cloud SQL/Cloud Storage all have free tiers, but Cloud SQL's smallest always-on instance costs more than Render's free Postgres, so a cost estimate is worth doing before committing.
