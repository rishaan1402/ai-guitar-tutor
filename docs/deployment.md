# Deployment (current)

Production backend runs on Google Cloud project **`guitar-tutor-prod-2`**
(project number `616112607240`, region `us-central1`). The frontend is on
Vercel and talks to the backend through `NEXT_PUBLIC_API_URL`.

This replaced the earlier `ai-guitar-tutor-prod` project (November 2026).
Older documents in `docs/` that mention `ai-guitar-tutor-prod` or the
`ai-guitar-tutor-lessons` bucket describe that previous setup.

## Resources

| Resource | Name |
|---|---|
| Cloud Run service | `guitar-tutor-backend` — https://guitar-tutor-backend-616112607240.us-central1.run.app |
| Cloud SQL | `guitar-tutor-db` (Postgres 16, `db-f1-micro`), database `guitar_tutor`, user `guitar` |
| Artifact Registry | `us-central1-docker.pkg.dev/guitar-tutor-prod-2/guitar-tutor/backend` |
| Lesson assets | public bucket `gs://guitar-tutor-prod-2-lessons` (`<chord>/lesson.mp4`, `reference.wav`, `metadata.json`) |
| Secrets (Secret Manager) | `JWT_SECRET_KEY`, `DATABASE_URL` (Unix-socket DSN via `/cloudsql/...`), `GROQ_API_KEY` (optional) |

The Cloud Run service account (`<project-number>-compute@developer.gserviceaccount.com`)
has `roles/secretmanager.secretAccessor` and `roles/cloudsql.client`.

## Redeploy the backend

```bash
gcloud config set project guitar-tutor-prod-2
gcloud builds submit --config=infra/cloudbuild.yaml .     # builds backend/Dockerfile
gcloud run deploy guitar-tutor-backend \
  --image=us-central1-docker.pkg.dev/guitar-tutor-prod-2/guitar-tutor/backend:latest \
  --region=us-central1 --allow-unauthenticated --port=8000 \
  --add-cloudsql-instances=guitar-tutor-prod-2:us-central1:guitar-tutor-db \
  --set-secrets=JWT_SECRET_KEY=JWT_SECRET_KEY:latest,DATABASE_URL=DATABASE_URL:latest \
  --set-env-vars=LESSON_ASSETS_BASE_URL=https://storage.googleapis.com/guitar-tutor-prod-2-lessons \
  --memory=1Gi --cpu=1 --max-instances=3
```

`backend/start.sh` runs `alembic upgrade head` before starting uvicorn, so a
deploy applies pending migrations automatically.

To enable LLM features (Council song lessons, LLM feedback), create the
`GROQ_API_KEY` secret and add `GROQ_API_KEY=GROQ_API_KEY:latest` to
`--set-secrets`. Without it the app falls back to template feedback and the
Council endpoints return 503. The model defaults to `openai/gpt-oss-120b`
(Groq retired `llama-3.3-70b-versatile`); override it with the `GROQ_MODEL`
env var. Reasoning models get low reasoning effort and extra token headroom
(`feedback_engine/generator.py:llm_params`).

To lock CORS to the frontend, set `ALLOWED_ORIGINS=https://<your-vercel-domain>`
(comma-separated for several). Unset, any origin may call the API without
credentials (auth uses Bearer tokens, not cookies).

## Lesson assets

After regenerating lessons locally:

```bash
gcloud storage cp -r data/lessons/* gs://guitar-tutor-prod-2-lessons/
```
