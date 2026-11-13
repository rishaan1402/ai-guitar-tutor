# Launch Roadmap — App Store / Play Store (Nov 2026)

The plan from today to a store release, built from an audit of the current code and infrastructure on 2026-11-11. Each task says **what**, **how**, and **done when**. Owner is **You** where it needs your accounts, money, or people; otherwise **Claude** (code, infra, tooling).

---

## Where things stand (audit, 2026-11-11)

### Broken right now

| Finding | Evidence |
|---|---|
| **Production backend is down.** Every API call fails; the Vercel frontend loads but nothing behind it works. | `GET /` → 500, `/chords` → 503. Cloud Run log: *"The request failed because billing is disabled for this project."* |
| **Both GCP billing accounts are closed** and the project has none linked. Account 1 was created 26 Jul, so this matches a ~90-day free trial ending in late Oct. | `gcloud billing projects describe` → `billingEnabled: false`; both accounts `OPEN: False`. |
| **The Cloud SQL database has been deleted.** All user accounts and practice history are gone. The GCS lesson bucket survived. Artifact Registry and Secret Manager can't be inspected until billing is back (their APIs refuse without it). | `gcloud sql instances list` → 0 items; `gcloud storage ls gs://ai-guitar-tutor-lessons/` → chord folders still present. |
| Nothing alerted anyone. | No uptime check, no budget alert, no error tracking. |

### Works

- Backend tests: 59 passed / 4 skipped. Frontend: 48/48 vitest, `tsc --noEmit` clean.
- Mic capture already disables echo cancellation, noise suppression and AGC, and encodes WAV in the browser (`MicrophoneRecorder.tsx`). This avoids the iOS `MediaRecorder` mp4 problem.
- Uploaded audio is deleted after scoring (`main.py`, `unlink` after evaluation).
- The frontend has no route handlers, middleware, or request-time server code, so a **static export for a native shell is feasible**.
- Lesson media is also committed to git, so the GCS bucket can be rebuilt even if it was purged.

### Gaps that would hurt real users or block store review

| Gap | Where |
|---|---|
| Practice/lesson state lives in process memory; with Cloud Run `maxScale=3`, requests landing on different instances fail ("Not ready for audio", lesson 404). | `main.py:74 _sessions`, `council/session_store.py:83 _store` |
| No self-service account deletion (both stores require it). No password reset. | `auth/router.py` has signup/login/refresh/me/logout only |
| Hardcoded fallback JWT secret if the env var is missing. | `auth/security.py:10` |
| Any teacher can see **every** student in the system (no roster). | `teacher/router.py:59` `where(User.role == "student")` |
| Teacher assignments are write-only: teachers create them, nothing shows them to students. | Only `teacher/router.py:228` touches `TeacherAssignment` |
| Weekly plan just repeats the daily plan and isn't used by the UI. | `personalization/planner.py build_weekly_plan` |
| Alembic migrations run on every instance boot, which can race when several instances start together. | `backend/start.sh` |
| Groq free tier is shared by all users; one lesson costs about 6 calls. | `council/agents.py` (2 pairs + ingestion + chairman) |
| No rate limiting, no error tracking, no CI, no ESLint config. Backend deploys are manual. | — |
| Audio accuracy is **unmeasured on real guitars.** The earlier "100%" figures used synthetic sine tones and the reference clip itself. | `test_audio_engine.py` |
| Council chord accuracy has no ground truth at all. | `council/ingestion.py` |
| `ScriptProcessorNode` is deprecated and needs to move to `AudioWorklet` for webview reliability. | `MicrophoneRecorder.tsx:66` |

---

## Decisions needed before Phase 1 (with my recommendation)

| # | Decision | Recommendation | Why it matters |
|---|---|---|---|
| D1 | **Hosting after the trial**: restore GCP with a paid account, or move to cheaper hosts | Restore GCP (paid). The setup already works; expect roughly $25–45/mo (see Costs) | Everything else is blocked until the API is up |
| D2 | **Who publishes**: you personally, or Muziclub | Settle IP ownership with Muziclub first; publish under whoever owns it | Built during the Muziclub internship. Developer accounts, legal entity and privacy policy all depend on this |
| D3 | **Mobile approach** | Capacitor wrapper around a static export of the current Next.js app | Reuses 100% of the UI. Rewrite (React Native/Flutter) only if real-time on-device detection becomes the core product |
| D4 | **Business model** | Free at launch; decide on paid after usage data | Paid features on iOS mean in-app purchase (15–30% cut) and extra review scope |
| D5 | **Age** | 13+ at launch | Muziclub students may include children. Kids/Families policies restrict third-party AI and analytics |
| D6 | **Platform order** | Android first (cheaper, faster review), iOS right after | Lets you iterate on a live build while iOS review runs |
| D7 | **Teacher/admin in v1 mobile?** | Leave them web-only for v1 | Removes the teacher privacy problem from the launch path |

---

## Phase 0 — Restore and stabilise (this week)

| Task | How | Owner | Done when |
|---|---|---|---|
| 0.1 Restore billing | Upgrade to a paid billing account in the Cloud Console (needs a payment method), then link it to `ai-guitar-tutor-prod` | **You** | `gcloud billing projects describe` shows `billingEnabled: true` |
| 0.2 Rebuild what was lost | Recreate Cloud SQL (`db-f1-micro`, `--edition=ENTERPRISE`) with a new DB password in the `DATABASE_URL` secret; migrations create an empty schema. Check whether the image and secrets survived and recreate any that didn't (`GROQ_API_KEY` needs you). GCS bucket is intact. Redeploy | Claude (+ **You** for the Groq key if lost) | `/chords`, `/audio/A%23_major`, signup → practice → score all work end to end |
| 0.3 Never go dark silently again | Billing budget with alerts at 50/90/100%; Cloud Monitoring uptime check on `/chords` emailing you; automated daily Cloud SQL backups (on by default, verify) | Claude (alerts go to you) | A test alert arrives in your inbox |
| 0.4 Housekeeping | Commit `.gcloudignore`, `infra/`, the docs; ignore `backend/.coverage`; remove the stale `.claude/worktrees/` entry; finish making your account admin | Claude | Clean `git status` |
| 0.5 Decisions D1–D7 | — | **You** | Recorded at the top of this file |

## Phase 1 — Reliability and security (≈1.5 weeks)

| Task | How | Done when |
|---|---|---|
| 1.1 Stateless chord scoring | `/submit_audio` takes `chord_name` in the form data and scores directly; keep `X-Session-Id` only for history. Retire `TutorAgent` from the request path | Two Cloud Run instances behind the service, 100 alternating requests, zero "Not ready" errors |
| 1.2 Persist Council lessons in Postgres | New `lessons` table (normalized query, song JSON, lesson JSON) and `lesson_progress` (per-chord scores), replacing `_store`. A normalized `(title, artist)` hit returns the cached lesson with no LLM calls | Lessons survive restarts; a repeat song returns in <300 ms |
| 1.3 LLM capacity and limits | Measure tokens per lesson, move Groq to a paid tier (or add a fallback provider), per-user quotas on `/generate` (e.g. 10/day signed-in, 2/day anonymous), timeouts plus a clear "busy, try again" state | Load test of 20 concurrent lessons completes or degrades gracefully, never a raw 500 |
| 1.4 Auth completeness | `DELETE /api/auth/me` (cascade attempts, drills, quiz results, tokens; reuse admin delete logic); password reset by email (needs an email provider, e.g. Resend/SendGrid); login/signup rate limiting; refuse to start without `JWT_SECRET_KEY` | Delete and reset work from the UI; brute-force attempts are throttled |
| 1.5 Teacher privacy | Teachers only see students linked to them (class invite code). Until then, hide teacher views from mobile | A teacher account cannot read an unlinked student's data (test) |
| 1.6 Finish or remove dead ends | Show teacher assignments on the student dashboard ("Assigned to you"), or drop the feature. Implement or remove the weekly plan | No backend feature without a UI, or the reverse |
| 1.7 CI/CD | GitHub Actions: pytest, vitest, `tsc`, ESLint on every PR. Cloud Build trigger on `main` builds, migrates (as one step), then deploys. Remove `alembic upgrade` from `start.sh` | Merge to `main` → backend live with no manual commands |
| 1.8 Observability | Sentry (backend and frontend, free tier), structured request logs, `min-instances=1` to kill cold starts | A forced error appears in Sentry with a stack trace; first request <1.5 s |

### Phase 1 progress (built locally while GCP billing is down, 2026-11-12)

| Item | Status | Notes |
|---|---|---|
| 1.1 Stateless scoring | **Done** | `grade_attempt()` in `tutor_agent/agent.py`; `/submit_audio` accepts `chord_name` + `previous_scores`; frontend sends them. Legacy session path kept for old clients. Remaining: the 2-instance load test once Cloud Run is back |
| 1.2 Lessons in Postgres | Not started | |
| 1.3 LLM limits | Not started | |
| 1.4 Auth | **Done (code)** | `DELETE /api/auth/me`, password reset (`/forgot-password`, `/reset-password`), login/signup/reset rate limits (in-memory, per instance), fail-closed `JWT_SECRET_KEY`, unique `jti` on tokens (fixed revoked tokens coming back), logout now actually revokes, 8-char password minimum everywhere. Remaining: **pick an email provider** and set `RESEND_API_KEY`, `MAIL_FROM` and `FRONTEND_URL` on Cloud Run |
| 1.5 Teacher privacy | **Done** | Invite codes + `teacher_students` link table; every teacher endpoint scoped; unlinked students return 404; students can leave and teachers can remove |
| 1.6 Dead ends | **Half done** | "Assigned to you" on the student dashboard with `/practice?chord=` deep link. Weekly plan still repeats the daily plan |
| 1.7 CI/CD | **Half done** | `.github/workflows/ci.yml`: pytest, migrations up/down/up, vitest, `tsc`, `next build`. ESLint isn't configured in the repo yet. Cloud Build deploy trigger waits for GCP |
| 1.8 Observability | Not started | Sentry can be added before GCP returns |

Bugs found and fixed along the way: teacher Analytics tab crashed (frontend/backend field names differed); 422 errors showed as `[object Object]`; logout sent no body, so refresh tokens were never revoked; tokens issued in the same second were identical.

New migrations: `2b7c1e4d9a10` (password reset tokens), `3c9d2f5e8b21` (teacher classes). They run automatically via `start.sh` on deploy.

### Song sheets (chords and tabs), added 2026-11-12

Inspired by Ultimate Guitar's chord pages, adapted to this app. `/songs` (browse/search/difficulty), `/songs/view?id=` (viewer), `/songs/edit` (ChordPro editor with live preview). Viewer: transpose ± with flats, capo that keeps the pitch, simplify (Cadd9→C, Am7→Am, D/F#→D), autoscroll (Space toggles), text size, chord-diagram panel where each chord links to `/practice?chord=`. Sources: a built-in library in `data/songs/*.cho` (16 traditional public-domain tunes, practice progressions and tab exercises, all chord charts with no lyrics), private user sheets, teacher sheets shared with their class (`song_sheets` table, migration `4e1a7b3c6d52`), and "Open as chord sheet" on any Council song lesson (AI-generated, labelled as such).

**Content rule:** we don't scrape other sites, and the AI doesn't generate lyrics. Adding lyrics to the library later needs a licensing deal (e.g. LyricFind or Musixmatch); the viewer already supports chords over lyric lines. Users can type their own text into private sheets.

**Chord fingerings fixed (2026-11-12).** `scripts/generate_fingerings.py` claimed open shapes but transposed the E-shape barre for every chord (C at fret 8, D at fret 10), and all 12 m7♭5 diagrams played a wrong note. It now picks the classic open shape where one exists, otherwise the lowest movable shape (6th-, 5th- or 4th-string root), and keeps a barre alternative in `alt_positions`. Every voicing must sound exactly the chord's notes, because the scorer penalises missing tones; that's why C7 uses x35353, not the open x32310, which has no G. `backend/tests/test_fingerings.py` enforces this (correct notes, finger on every fretted string, stretch ≤ 4 frets, ≤ fret 8). The 84 lesson videos (`data/lessons/*/lesson.mp4`) were regenerated from the new data. **When GCP is back, re-upload them to `gs://ai-guitar-tutor-lessons`,** because production serves the videos from the bucket.

## Phase 2 — AI accuracy (≈3–4 weeks, runs in parallel with 1 and 3; data is the critical path)

### 2A. Chord evaluator (DSP)

| Task | How | Done when |
|---|---|---|
| 2A.1 Labeled recording set | Hidden `/lab` page records takes with labels (chord; correct / muted string / extra string / wrong chord; device; guitar type) to a **private** GCS bucket. Recruit Muziclub students and teachers. Start with the 20 most common beginner chords × 5 players × 3 devices × 4 labels ≈ 1,200 clips | Dataset with a 80/20 train/holdout split |
| 2A.2 Eval harness | `scripts/eval_audio.py`: per-chord precision/recall, **false-reject rate on correctly played chords** (the metric that matters most to a learner), confusion matrix, latency. Runs in CI against a small fixture subset | One command prints the report; CI fails on regression |
| 2A.3 Data-driven thresholds | Grid-search the hand-set constants (flatness 0.20, onset 2.0, merge 0.35/0.28, extra penalty 0.08, chroma clamp 0.20–0.50) on train, confirm on holdout | Holdout false-reject rate below a target we set from the baseline |
| 2A.4 Tuning tolerance | `librosa.estimate_tuning` to correct for a guitar a few cents off; tell the user ("about 20 cents flat"). Pair with an in-app tuner (Phase 3) | Detuned takes score the same as tuned ones within tolerance |
| 2A.5 Known failure modes | Metronome bleed (record between clicks, or headphone prompt), distorted tones, quiet phones. Separate "couldn't hear you clearly" from a low score | Gate rejections show a retry message, never a misleading 0% |
| 2A.6 (Later) on-device detection | Port the pipeline to WASM/JS (`noteDetection.ts` already does FFT) for instant and offline feedback | Decide once 2A.2 shows server accuracy is good enough |

### 2B. Council (LLM)

| Task | How | Done when |
|---|---|---|
| 2B.1 Golden set | 50 songs with verified chords, key and sections (Muziclub teachers can verify) | `data/eval/golden_songs.json` |
| 2B.2 Eval harness | `scripts/eval_council.py`: chord-set F1, key accuracy, section match, latency, cost per lesson | One command prints scores per model/prompt |
| 2B.3 Accuracy fixes | Strict JSON-schema outputs; 3× ingestion with majority-vote chords; check chords against the stated key; map extended chords to playable app chords (Cadd9→C) and say so; teacher-verified lessons pinned in the cache | F1 improves over the 2B.2 baseline |
| 2B.4 Model choice | Run the golden set across candidates (current Llama-3.3-70B and alternatives) and pick on accuracy, cost and latency together | A written comparison table and a decision |
| 2B.5 Safety and honesty | Input filter on song queries, "Report a problem" on lessons, "AI-generated, may contain mistakes" label | Report button stores reports for review |
| 2B.6 Real progress UI | Stream stage updates (SSE) instead of a timed spinner | Progress reflects real pipeline stages |

## Phase 3 — Frontend polish and mobile readiness (≈2 weeks)

| Task | How |
|---|---|
| 3.1 Mobile layout pass | 375 px audit: 44 px touch targets, safe-area insets, bottom tab bar in the app shell, record button within thumb reach |
| 3.2 Onboarding | Skill level, **built-in tuner** (feeds 2A.4), mic-permission priming screen, headphone tip |
| 3.3 Recording UX | Live input-level meter so users can see the mic hears them; countdown; clear retry states |
| 3.4 Audio engine | Replace `ScriptProcessorNode` with `AudioWorklet` |
| 3.5 Performance | Reduce `backdrop-filter` blur on low-end Android; lazy-load video; Lighthouse mobile target ≥ 85 |
| 3.6 Account screens | Forgot password, delete account, privacy and AI-consent settings |
| 3.7 Resilience | Offline banner, SWR retry/backoff, friendly error states everywhere |
| 3.8 Accessibility | Labels, focus order, contrast; check VoiceOver/TalkBack on the main flow |
| 3.9 Product analytics | Privacy-friendly events (e.g. PostHog) on the funnel: onboard → first chord → first lesson → day-7 return |

## Phase 4 — Native apps with Capacitor (≈1.5 weeks)

| Task | How |
|---|---|
| 4.1 Static export | `output: 'export'` in `next.config.js`; convert `/progress/chord/[name]` to `generateStaticParams` (the 84 chords are known) or a query param |
| 4.2 Capacitor shell | `@capacitor/ios` and `@capacitor/android`; plugins: secure token storage (Keychain/Keystore instead of `localStorage`), haptics, local notifications (practice reminders/streaks), splash, status bar, icons |
| 4.3 Native audio | iOS `NSMicrophoneUsageDescription` and a play-and-record audio session; Android `RECORD_AUDIO` and webview permission handling |
| 4.4 Backend for apps | Add `capacitor://localhost`, `https://localhost`, `http://localhost` to `ALLOWED_ORIGINS` |
| 4.5 Device matrix | 2 iPhones and 3 Androids (including a low-end one); full flow on each with a real guitar |

## Phase 5 — Store compliance and launch (≈1–2 weeks including review)

| Task | Owner |
|---|---|
| 5.1 Developer accounts: Apple ($99/yr; an organisation needs a D-U-N-S number), Google Play ($25 once; check the current closed-testing rule for new personal accounts) | **You** |
| 5.2 Legal pages on the site: privacy policy, terms, a web account-deletion page (Play requires one) | **You** decide, Claude drafts |
| 5.3 Privacy labels / Data safety form: email and name; mic audio processed then deleted; song queries sent to a third-party AI (disclose it and ask consent in-app) | Claude drafts, **You** submit |
| 5.4 Store assets: icon, screenshots per device size, Android feature graphic, description, keywords | Claude produces drafts |
| 5.5 Beta: TestFlight and a Play closed track with Muziclub students; fix what they hit | **You** recruit, Claude fixes |
| 5.6 Submit, answer review questions, ship | **You** |

## Phase 6 — After launch

Crash-free and error-rate dashboards; eval suites gating every deploy; opt-in "donate this recording" to keep growing the dataset; more chord types (sus2/sus4/add9, which `planner.py` already has symbols for but `data/lessons` doesn't); a monetisation decision from real usage.

---

## Rough timeline (part-time, single developer plus Claude)

| Week | Work |
|---|---|
| 1 | Phase 0, start Phase 1, start recruiting recorders (2A.1) |
| 2–3 | Finish Phase 1; Phase 3 begins; recordings come in |
| 3–5 | Phase 2 tuning and evals; finish Phase 3 |
| 5–6 | Phase 4; Android internal testing |
| 6–8 | Phase 5; beta; submit Android, then iOS |

**Critical path:** real recordings (2A.1). Everything about accuracy waits on them, so recruiting starts in week 1.

## Rough running costs (verify against current pricing)

| Item | Approx. |
|---|---|
| Cloud SQL `db-f1-micro` + storage | ~$10/mo |
| Cloud Run, 1 min instance + traffic | ~$15–30/mo |
| GCS, Artifact Registry, logs | <$2/mo |
| LLM | Usage-based. Uncached lessons cost cents each; the cache makes repeat songs free |
| Sentry / PostHog / email | Free tiers to start |
| Apple / Google | $99/yr / $25 once |

## Biggest risks

1. **It already happened once.** The trial ended, the app went dark, and the database was deleted without anyone noticing. Impact was small (pre-launch accounts), but with real users this is the failure that loses trust. That's why 0.3 comes before anything else.
2. **Real-world accuracy turns out poor.** That's what 2A exists to find out early. Mitigation: tuner, headphone prompt, and honest "couldn't hear clearly" states.
3. **Apple 4.2 ("just a website") rejection.** Mitigation: native mic flow, haptics, reminders, offline handling.
4. **IP ownership with Muziclub unresolved.** Settle before publishing (D2).
