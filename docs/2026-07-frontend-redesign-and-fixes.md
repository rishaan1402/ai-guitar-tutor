# Frontend Redesign & Bug Fixes — July 2026

A log of the work done in this session, in order, with enough context to pick back up later.

## 1. Frontend redesign (full rebuild, dark theme)

**Ask:** build a full new frontend with a landing page, "like a darker theme."

**Findings before starting:** the app already had a dark glassmorphism theme, but:
- `/` dropped straight into the chord-practice tool — there was no marketing landing page for logged-out visitors.
- Several pages (login, signup, profile, admin, teacher, and their sub-components) were styled with a completely different palette (`indigo-*`, `bg-gray-950/900/800`) left over from an earlier iteration, clashing with the rest of the app's purple/cyan glass look.

**What changed:**

- **Design tokens** ([frontend/src/app/globals.css](../frontend/src/app/globals.css), [tailwind.config.ts](../frontend/tailwind.config.ts)) — reworked into an "obsidian" palette: near-black base (`#060609`), violet/cyan accents, refined `--glass-*` tokens, and new utility classes (`.panel`, `.panel-header`, `.panel-footer`, `.panel-row-hover`, `.field-input`, `.field-label`, `.btn-outline`) for surfaces that shouldn't use the blurred glass treatment (tables, settings forms).
- **New landing page** at [`/`](../frontend/src/app/page.tsx) — hero with a mock app preview, quick-facts strip, feature grid, "how it works" (Watch/Listen/Play/Review), a teacher-focused section, and a closing CTA. Backed by new [`MarketingNav`](../frontend/src/components/layout/MarketingNav.tsx) and [`Footer`](../frontend/src/components/layout/Footer.tsx) components.
- **Practice app moved** from `/` to [`/practice`](../frontend/src/app/practice/page.tsx) — the existing chord/song/transitions experience, unchanged in logic.
- **`NavBar`** ([frontend/src/components/NavBar.tsx](../frontend/src/components/NavBar.tsx)) — links repointed at `/practice`, logo goes to `/dashboard` when logged in else `/`.
- **Restyled to match the rest of the app:** [login](../frontend/src/app/login/page.tsx), [signup](../frontend/src/app/signup/page.tsx), [profile](../frontend/src/app/profile/page.tsx), [admin](../frontend/src/app/admin/page.tsx), [teacher](../frontend/src/app/teacher/page.tsx), and their components (`AdminPanel/*`, `TeacherDashboard/*`). Redirects after login/signup changed from `/` to `/dashboard`.
- Verified live in the browser (landing, `/practice`, `/login`, `/signup`) with no console errors; `tsc --noEmit` clean.

**Commits:** `3227882` (redesign), pushed to `origin/main`; Vercel auto-deployed successfully.

## 2. Removed dead "Songs" / "Transitions" nav links

**Report:** "practice, songs and transitions is showing the same page with the same functionality."

**Root cause:** `NavBar` linked to `/practice?mode=song` and `/practice?mode=transitions`, but the practice page's `mode` state was local React state that always initialized to `"chords"` — it never read the `?mode=` query param. So those nav links were pure duplicates of "Practice" with no effect. The actual mode switch is the in-page pill toggle (Practice / Learn Song / Transitions), which was always working correctly.

**Fix:** removed the two dead nav items, simplified `NavBar`'s active-link check (no longer needs `useSearchParams`/Suspense since no nav item carries a query string). Also fixed `TodaysPlan.tsx` on the dashboard, which still linked back to the old `/` practice route.

**Commit:** `23e9b7f`, pushed and deployed.

## 3. Sharp-chord (`#`) video/audio 404 bug

**Report:** "the Watch segment of the practice tab is just skipping it" — later also "reference audio tab is also not playing."

**Investigation:** tested the live site directly (chord list, starting a lesson, login) — all worked. Reproduced the actual bug by selecting `A# dominant7`: the Watch step auto-skipped straight to Listen with no user interaction. Attached a `video` `error` listener in-page and caught it:

```
MEDIA_ELEMENT_ERROR: Format error
src: https://guitar-tutor-backend-.../video/A%23_dominant7
```

Curling the backend endpoint showed the real cause — the Cloud Run `/video/{chord}` and `/audio/{chord}` endpoints redirect to a GCS asset URL built from the **raw, unescaped** chord name:

```
location: https://storage.googleapis.com/ai-guitar-tutor-lessons/A#_dominant7/lesson.mp4
```

Since `#` starts a URL fragment, the browser/GCS only ever requested `.../A` — a 404 (`NoSuchKey`). The frontend's `<video onError={onVideoEnd}>` handler silently treated that 404 as "watched," auto-advancing the step. `<audio>` has no such fallback, so it just never played. This affected every chord with a `#` in its name — the 5 sharp roots × 7 qualities = **35 of 84 chords**.

**Fix:** [backend/main.py](../backend/main.py) — URL-encode the chord name with `urllib.parse.quote()` before building the GCS redirect URL, in both `/video/{chord}` and `/audio/{chord}`.

**Deploy:** this required an actual Cloud Run redeploy (Vercel auto-deploys the frontend on push; Cloud Run does not).
```bash
gcloud builds submit --config infra/cloudbuild.yaml .
gcloud run deploy guitar-tutor-backend \
  --image us-central1-docker.pkg.dev/ai-guitar-tutor-prod/guitar-tutor/backend:latest \
  --region us-central1 --project ai-guitar-tutor-prod
```
Deployed as revision `guitar-tutor-backend-00004-mv9`. Verified with `curl` and a live browser test that `A# dominant7`'s video/audio both return 200 and the Watch step no longer skips.

**Commit:** `5a660b6` — this also committed the GCS-redirect logic itself (`LESSON_ASSETS_BASE_URL`), which had been deployed to Cloud Run in an earlier session but never committed to git.

## 4. Admin/teacher role bootstrapping (in progress)

Explained how roles work: every account is `student` by default; only an existing `admin` can promote someone via the Admin Panel (`/admin` → User Management → role dropdown). Since there was no admin account yet, the first one has to be set directly in the Cloud SQL database.

Set up tooling to do this (`psql` via `brew install libpq`, `gcloud components install cloud-sql-proxy`, pulled the DB password from Secret Manager) — **this was interrupted before the actual `UPDATE` ran**, so `rathorerishaan@gmail.com` is not yet an admin. Next step: re-run the `gcloud sql connect` command and execute:
```sql
UPDATE users SET role = 'admin' WHERE email = 'rathorerishaan@gmail.com';
```

## Reference: how to use Teacher / Admin panels

- **Admin Panel** (`/admin`): system-wide stats (users, chord attempts, transition drills, breakdown by role) + a paginated user table where you can change anyone's role.
- **Teacher Panel** (`/teacher`): "Students" tab lists *every* student account (no per-teacher roster/enrollment concept — any teacher sees the whole student list); click a student to see their chord progress, assign a chord with an optional note, or generate an AI-written progress report. "Analytics" tab shows class-wide most-practiced chords and lowest-scoring chords.

## Key infra facts (see also the `gcp-migration-state` memory)

- GCP project: `ai-guitar-tutor-prod`; Cloud Run service `guitar-tutor-backend` (us-central1); Cloud SQL `guitar-tutor-db` (Postgres 16); Artifact Registry image `us-central1-docker.pkg.dev/ai-guitar-tutor-prod/guitar-tutor/backend:latest`.
- Backend deploys require `gcloud builds submit --config infra/cloudbuild.yaml .` + `gcloud run deploy` — pushing to git does **not** redeploy the backend.
- Frontend is on Vercel (`ai-guitar-tutor.vercel.app`) and redeploys automatically on push to `origin/main`.
- Lesson video/audio assets live in the public GCS bucket `gs://ai-guitar-tutor-lessons`, one `<chord_name>/lesson.mp4` + `<chord_name>/reference.wav` per chord.
