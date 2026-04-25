# AI Guitar Tutor — Artifacts

A complete inventory of every significant file, component, API endpoint, data schema, and external dependency in the project. Use this as a map when navigating or extending the codebase.

---

## Backend Artifacts

### `backend/main.py`
App entry point. Initialises FastAPI, loads fingering data, manages in-memory TutorAgent sessions (1-hour TTL), configures CORS, and mounts all routers. Contains the core chord-practice endpoints.

**Endpoints defined here:**
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/chords` | List all chord lesson keys |
| `GET` | `/lesson/{chord}` | Get metadata for a chord |
| `GET` | `/fingering/{chord}` | Get fingering positions for chord diagram |
| `GET` | `/video/{chord}` | Stream lesson video (mp4) |
| `GET` | `/audio/{chord}` | Stream reference audio (wav) |
| `POST` | `/learn_chord` | Start a TutorAgent session for a chord |
| `POST` | `/submit_audio` | Upload recorded audio → evaluate → return score + feedback + fingering tips |
| `GET` | `/session` | Get current session state |
| `POST` | `/reset` | Reset TutorAgent session |

---

### `backend/council/`

#### `schemas.py`
All Pydantic models for the council system.

| Model | Description |
|---|---|
| `GenerateRequest` | Input: `{ song_query, user_skill_level? }` |
| `TipRequest` | Input: `{ lesson_id, chord_key, evaluation, attempt_count }` |
| `ReviseRequest` | Input: `{ lesson_id, chord_scores }` |
| `QuizRequest` | Input: `{ lesson_id }` |
| `FingeringPosition` | `{ string, fret, note, finger?, action? }` |
| `PracticeChord` | `{ symbol, chord_key, difficulty, available_in_app, positions[], chord_function }` |
| `SongSection` | `{ name, chords[] }` |
| `LessonDocument` | Full lesson output (see Architecture doc for complete schema) |
| `QuizQuestion` | `{ question, options[], correct_index, explanation }` |
| `QuizResponse` | `{ lesson_id, questions[] }` |
| `SongObject` | Internal: raw extracted song data from ingestion |
| `AgentOutput` | Internal: 4 text fields from the 4 agents |

#### `router.py`
Mounts at `/api/council/`. Embeds fingerings + chord functions into each LessonDocument before returning.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/council/generate` | Full pipeline: ingest → 4 agents → chairman → LessonDocument |
| `POST` | `/api/council/practice/tip` | Personalised tip after a chord attempt |
| `POST` | `/api/council/practice/revise` | Revise lesson plan once all chords practiced |
| `POST` | `/api/council/quiz` | Generate 5 MCQs for a lesson |

#### `ingestion.py`
`ingest_song(query)` — calls Groq to extract structured song data: key, time signature, tempo, difficulty, chords with Roman numeral functions, song sections, techniques.

#### `agents.py`
`run_council(song_object)` — fires 4 parallel asyncio Groq calls:
- **Theory Agent**: music theory section (key, Roman numerals, harmonic moves)
- **Technique Agent**: physical technique guide (hand position, common mistakes)
- **Ear Agent**: ear training guide (what to listen for, exercises)
- **Planner Agent**: structured practice plan

#### `chairman.py`
`synthesise(song_object, agent_output)` — calls Groq one more time to write the `chairman_summary`, resolves chord symbols to `chord_key` values using `chord_definations.json`, assembles the final `LessonDocument`.

#### `advisor.py`
- `get_tip(request, user_context)` — generates a personalised post-attempt tip using the chord evaluation result + user skill level
- `revise_lesson(request)` — rewrites the practice plan section after all chords have been attempted

#### `quiz.py`
`generate_quiz(lesson_id)` — generates 5 multiple-choice questions tied to the lesson's theory content.

#### `session_store.py`
In-memory store for active lesson sessions (maps `lesson_id` → `LessonDocument`). Used so `advisor.py` and `quiz.py` can access the lesson without re-fetching.

---

### `backend/audio_engine/`

#### `evaluator.py`
`ChordEvaluator` class.
- `evaluate(audio_path, expected_notes)` → `{ score, detected_notes, missing_notes, extra_notes, issue }`
- Pipeline: load → noise reduction → FFT → pitch detection → note matching

#### `audio_io.py`
Audio loading utilities. Wraps `librosa.load()` with format handling.

---

### `backend/feedback_engine/`

#### `generator.py`
`FeedbackGenerator` class.
- `generate_feedback(evaluation, user_context)` — main feedback string
- `generate_analysis_summary(evaluation)` — structured text summary
- `generate_fingering_tips(missing_notes, positions)` → `[{ note, string, fret, finger, tip }]`
- `_get_groq_client()` — returns the shared Groq client (cached)
- `GROQ_MODEL` — model name constant (`llama-3.3-70b-versatile`)

---

### `backend/lesson_service/`

#### `service.py`
`LessonService` class.
- `list_available_chords()` → `list[str]` — scans `data/lessons/` for valid lesson dirs
- `get_lesson(chord_name)` → `Lesson | None` — loads metadata.json + resolves audio/video paths

---

### `backend/tutor_agent/`

#### `agent.py`
`TutorAgent` class — state machine per browser session.
States: `IDLE` → `TEACHING` → `WAITING_FOR_PLAY` → `ANALYZING` → `FEEDBACK` → back to `WAITING_FOR_PLAY` or `COMPLETED`.
- `start_lesson(chord_name)` — transitions to TEACHING
- `submit_audio(path, user_context)` — evaluates + generates feedback
- `set_fingering_positions(positions)` — stores fingering data for tip generation
- `get_session_info()` — returns current state + chord
- `reset()` — returns to IDLE

---

### `backend/auth/`

#### `router.py`
Mounts at `/api/auth/`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/signup` | Create account, return access + refresh tokens |
| `POST` | `/login` | Authenticate, return tokens |
| `POST` | `/refresh` | Exchange refresh token for new access token |
| `GET` | `/me` | Current user profile |
| `PATCH` | `/me` | Update display_name or skill_level |
| `POST` | `/logout` | Revoke refresh token |

#### `security.py`
- `create_access_token(user_id, role)` — 15-minute JWT
- `create_refresh_token(user_id)` — 30-day opaque token (hashed before storing)
- `verify_access_token(token)` → payload dict
- `hash_password(pw)` / `verify_password(plain, hashed)`

#### `dependencies.py`
FastAPI dependencies:
- `get_current_user` — requires valid Bearer token, returns `User`
- `get_current_user_optional` — same but returns `None` for unauthenticated
- `require_role(role)` — factory that returns a dependency enforcing a minimum role

#### `schemas.py`
`TokenResponse`, `UserResponse`, `SignupRequest`, `LoginRequest`, `UpdateMeRequest`

#### `profile_context.py`
`build_user_context(db, user_id)` → `UserContext` dict with `skill_level` — passed to LLM calls for personalised tone.

---

### `backend/db/`

#### `models.py`
All SQLAlchemy ORM models:

| Model | Table | Key Fields |
|---|---|---|
| `User` | `users` | id (UUID), email, password_hash, display_name, role, skill_level |
| `RefreshToken` | `refresh_tokens` | id, user_id, token_hash, expires_at |
| `ChordAttempt` | `chord_attempts` | id, user_id, chord_name, score, detected_notes (JSON), missing_notes (JSON), extra_notes (JSON), issue, feedback_text |
| `TransitionDrill` | `transition_drills` | id, user_id, chord_a, chord_b, chord_a_symbol, chord_b_symbol, tpm, got_count, miss_count, date |
| `QuizResult` | `quiz_results` | id, user_id, lesson_id, passed, score, attempted_at |
| `TeacherAssignment` | `teacher_assignments` | id, teacher_id, student_id, chord_name, assigned_at |

#### `engine.py`
- `engine` — async SQLAlchemy engine (Postgres or SQLite based on `DATABASE_URL`)
- `Base` — declarative base for all models
- `get_db()` — FastAPI dependency that yields `AsyncSession`

---

### `backend/progress/`

#### `router.py`
Mounts at `/api/progress/`. All endpoints require auth.

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Chord summary: best scores, streak, mastered count |
| `GET` | `/calendar` | 365 days of `{ date, attempts, avg_score }` for heatmap |
| `GET` | `/chord/{name}/history` | All attempts for one chord (score, notes, timestamp) |
| `GET` | `/transitions` | All transition drill results for current user |
| `POST` | `/transitions` | Save a transition drill result |
| `POST` | `/quiz/{lesson_id}/submit` | Save quiz result |
| `POST` | `/migrate` | Migrate chord data from localStorage |
| `POST` | `/migrate-transitions` | Migrate transition data from localStorage |

---

### `backend/personalization/`

#### `planner.py`
`build_daily_plan(db, user)` → `DailyPlan`
Logic: query recent chord scores + transition miss rates → select warmup / focus / new-challenge / transition items → cap by skill level.

`build_weekly_plan(db, user)` → `WeeklyPlan` (7 × DailyPlan)

#### `router.py`
Mounts at `/api/plan/`. All endpoints require auth.

| Method | Path | Description |
|---|---|---|
| `GET` | `/next` | Today's plan (5–7 items) |
| `GET` | `/weekly` | 7-day plan |

---

### `backend/teacher/`

#### `router.py`
Mounts at `/api/teacher/`. Requires `teacher` or `admin` role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/students` | All students with summary stats |
| `GET` | `/students/{id}/progress` | One student's chord progress |
| `GET` | `/students/{id}/report` | Full report: strengths, weaknesses, recommendations |
| `GET` | `/analytics` | Class-wide: avg scores, most struggled chords, active users |
| `POST` | `/assign` | Assign a chord to a student |

#### `reports.py`
`generate_student_report(student, attempts)` — builds a structured report dict.

---

### `backend/admin/`

#### `router.py`
Mounts at `/api/admin/`. Requires `admin` role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | Paginated user list (filter by role) |
| `PATCH` | `/users/{id}` | Update role (`student` / `teacher` / `admin`) |
| `DELETE` | `/users/{id}` | Delete user |
| `GET` | `/stats` | Total users, users by role, total attempts, total drills |

---

## Frontend Artifacts

### Pages (`frontend/src/app/`)

| File | Route | Description |
|---|---|---|
| `page.tsx` | `/` | Home: chord selector + practice + song council |
| `layout.tsx` | all | Root layout: AuthProvider + AppShell |
| `login/page.tsx` | `/login` | Login form |
| `signup/page.tsx` | `/signup` | Signup form |
| `dashboard/page.tsx` | `/dashboard` | Authenticated dashboard (plan + stats + heatmap) |
| `dashboard/_components/TodaysPlan.tsx` | — | Fetches /api/plan/next, renders plan cards |
| `dashboard/_components/QuickStats.tsx` | — | 4 stat cards from /api/progress |
| `dashboard/_components/StreakHeatmap.tsx` | — | 52-week activity grid |
| `progress/page.tsx` | `/progress` | Full analytics: heatmap, skill meter, chord matrix |
| `progress/chord/[name]/page.tsx` | `/progress/chord/:name` | Per-chord drill-down: timeline, issues, trends |
| `profile/page.tsx` | `/profile` | Update display name + skill level |
| `admin/page.tsx` | `/admin` | User management table + system stats (admin only) |
| `teacher/page.tsx` | `/teacher` | Student list + class analytics + assignments |

---

### Components (`frontend/src/components/`)

#### Core Practice
| Component | Description |
|---|---|
| `ChordSelector` | Dropdown to pick a chord from the available list |
| `MicrophoneRecorder` | Web Audio API recording with countdown + waveform |
| `FeedbackDisplay` | Composes score ring + fretboard + note diff + tips + next-action bar |
| `ScoreRing` | Circular SVG progress ring showing 0–1 score |
| `NoteComparisonBar` | Side-by-side expected vs detected notes |
| `ChordDiagram` | SVG fretboard diagram from fingering positions |
| `TransitionTrainer` | Timed chord-switch drill with TPM counter |
| `MetronomeWidget` | Visual + audio metronome |
| `ModeToggle` | Switches between practice modes |
| `LessonVideoPlayer` | HTML5 video player for lesson videos |
| `CountdownOverlay` | 3-2-1 countdown before recording |
| `Confetti` | Celebration animation on milestone |
| `StepIndicator` | Multi-step progress indicator |
| `ProgressDashboard` | Legacy localStorage-based progress (kept for non-auth users) |

#### Feedback (`components/feedback/`)
| Component | Description |
|---|---|
| `FretboardVisualizer` | SVG fretboard: green = detected, red = missing (pulsing), yellow = extra, ✕ = muted |
| `NoteDiffStrip` | Three columns (Expected / Detected / Missing) with coloured note pills; hover highlights fretboard |
| `FingeringTipCard` | Single fingering tip with colour-coded finger indicator + Helped/Unclear buttons |

#### Song Council (`components/SongCouncil/`)
| Component | Description |
|---|---|
| `index.tsx` | Entry point: search bar + lesson state machine |
| `SongSearchBar` | Search input that triggers lesson generation |
| `IntegratedLessonView` | Single scrollable lesson surface; owns activeSection + highlightedChords state |
| `SongTimeline` | Horizontal scrollable section buttons; coloured by chord mastery; active section gets purple ring |
| `ChordMasteryBoard` | Grid of EnhancedPracticeChordCards; dims non-section chords when a section is active |
| `EnhancedPracticeChordCard` | Chord card with mini diagram toggle, score sparkline, chord function badge, practice button |
| `LessonSection` | Collapsible prose section (theory / technique / ear / plan) with chevron animation |
| `ChordPracticeDrawer` | shadcn Sheet that slides in for per-chord practice within song lesson context |
| `LessonQuiz` | Renders MCQ quiz; wrong answers show explanation + "Review chord" link |
| `PlayAlongMode` | Chord progression player with timing guide |
| `PracticeChordCard` | Simpler chord card (used in legacy contexts) |
| `LessonDisplay` | Prose lesson content display |
| `LessonSuite` | Legacy tab-based lesson layout (kept but superseded by IntegratedLessonView) |
| `LessonSuiteNav` | Navigation for legacy LessonSuite |
| `CouncilProgress` | Progress indicator for lesson generation pipeline |

#### Admin Panel (`components/AdminPanel/`)
| Component | Description |
|---|---|
| `UserManagement` | Table with role dropdown per user; calls `PATCH /api/admin/users/{id}` on change |
| `SystemStats` | Displays stats cards (total users, by role, attempts, drills) |

#### Teacher Dashboard (`components/TeacherDashboard/`)
| Component | Description |
|---|---|
| `StudentList` | Table of all students with score averages |
| `StudentDetail` | Expanded view of one student's progress |
| `ClassAnalytics` | Bar charts for class-wide chord performance |
| `AssignmentForm` | Form to assign a chord drill to a student |

#### Layout (`components/layout/`)
| Component | Description |
|---|---|
| `AppShell` | Outer layout wrapper: NavBar + main content area + toast provider |

#### NavBar (`components/NavBar.tsx`)
Responsive nav. Desktop: horizontal links. Mobile: hamburger → shadcn Sheet drawer. Shows user menu (profile, logout) when authenticated. Shows teacher/admin links based on role.

#### UI Primitives (`components/ui/`)
| Component | Source |
|---|---|
| `button.tsx` | shadcn/ui |
| `card.tsx` | shadcn/ui |
| `badge.tsx` | shadcn/ui |
| `tabs.tsx` | shadcn/ui |
| `dialog.tsx` | shadcn/ui |
| `tooltip.tsx` | shadcn/ui |
| `progress.tsx` | shadcn/ui |
| `skeleton.tsx` | shadcn/ui |
| `sheet.tsx` | shadcn/ui |
| `sonner.tsx` | Sonner toast wrapper |
| `StatCard` | Custom: title + value + optional trend |
| `SectionHeader` | Custom: section title with optional subtitle |
| `EmptyState` | Custom: icon + message + optional action |
| `LoadingSkeleton` | Custom: shimmer placeholder |
| `ErrorState` | Custom: error message + optional retry |

---

### Library (`frontend/src/lib/`)

| File | Description |
|---|---|
| `api.ts` | All API functions + TypeScript interfaces for every backend response |
| `auth.ts` | `getAccessToken()`, `setTokens()`, `clearTokens()`, `refreshAccessToken()` — localStorage-based JWT helpers |
| `motion.ts` | Framer Motion variants: `fadeInUp`, `slideInRight`, `staggerContainer`, `cardEntrance` |
| `progress.ts` | `getLocalProgress()`, `mergeProgress()` — helpers for progress data |
| `noteDetection.ts` | Client-side note frequency helpers (for UI display, not evaluation) |
| `transitionHistory.ts` | LocalStorage transition drill helpers (for non-auth fallback) |
| `migrateProgress.ts` | Migration logic for moving localStorage data to DB |
| `useMetronome.ts` | Custom hook: metronome tick logic with Web Audio API |
| `utils.ts` | `cn()` — clsx + tailwind-merge utility |

---

### Context (`frontend/src/context/`)

| File | Description |
|---|---|
| `AuthContext.tsx` | Provides `{ user, loading, isAdmin, isTeacher, login(), logout(), updateUser() }` to the whole app |

---

## Data Artifacts

### `data/lessons/` — 84 chord folders
Naming convention: `{Note}_{quality}` (e.g. `A_minor`, `G_major`, `F#_minor7`)

Each folder contains:
- `metadata.json` — `{ "chord": "A_minor", "notes": ["A","C","E"], "difficulty": "beginner" }`
- `reference.wav` — clean reference recording of the chord
- `lesson.mp4` *(optional)* — instructional video

Available quality types: `major`, `minor`, `major7`, `minor7`, `dominant7`, `half_dim7`, `power`

### `data/chords/fingerings.json`
84 entries. Each:
```json
{
  "chord": "chord_key",
  "display_name": "symbol",
  "root": "note letter",
  "quality": "quality string",
  "notes": ["note1", "note2", "note3"],
  "positions": [
    { "string": 1-6, "fret": 0-12, "finger": 0-4, "note": "note name", "action": "mute|open|null" }
  ]
}
```
String numbering: 1 = high E, 6 = low E. Fret 0 = open string. Finger 0 = no finger (open).

### `data/chords/chord_definations.json`
Chord catalogue used by `chairman.py` to resolve chord symbols (like "Am7") to chord keys (like "A_minor7").

---

## External Services

| Service | Used For | Auth |
|---|---|---|
| **Groq** (`llama-3.3-70b-versatile`) | Lesson generation, tips, quiz, feedback | `GROQ_API_KEY` env var |
| **Vercel** | Frontend hosting + CDN | GitHub integration |
| **Render** | Backend hosting + PostgreSQL | GitHub integration |
| **GitHub** | Source control + CI/CD trigger | SSH / PAT |

---

## Environment Variables

### Backend (Render)
| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | Yes | — | Groq LLM API key |
| `DATABASE_URL` | Yes (prod) | `sqlite+aiosqlite:///./guitar_tutor.db` | DB connection string |
| `SECRET_KEY` | Yes | — | JWT signing secret (min 32 chars) |
| `ALLOWED_ORIGINS` | Yes (prod) | `*` | Comma-separated CORS origins |

### Frontend (Vercel)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL |

---

## Test Files

| File | What It Tests |
|---|---|
| `backend/tests/test_api.py` | FastAPI endpoint smoke tests |
| `backend/tests/test_evaluator.py` | ChordEvaluator unit tests |
| `backend/tests/test_schemas.py` | Pydantic model validation |
| `backend/tests/test_session.py` | TutorAgent state machine |
| `backend/tests/conftest.py` | Pytest fixtures (test DB, test client) |
| `backend/test_audio_engine.py` | Legacy audio engine tests |
| `backend/test_feedback_engine.py` | Legacy feedback engine tests |
| `backend/test_lesson_service.py` | Legacy lesson service tests |
| `backend/test_tutor_agent.py` | Legacy tutor agent tests |
| `frontend/src/lib/__tests__/noteDetection.test.ts` | Note frequency detection |
| `frontend/src/lib/__tests__/playAlongMath.test.ts` | Play-along timing math |
| `frontend/src/lib/__tests__/transitionHistory.test.ts` | Transition history helpers |
