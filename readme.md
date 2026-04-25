# AI Guitar Tutor 🎸

An AI-powered web application that helps guitarists learn songs through structured lessons, real-time chord evaluation, and a personalised daily practice plan.

**Live app:** Vercel (frontend) + Render (backend)
**Stack:** Next.js 14 · FastAPI · PostgreSQL · Groq LLM · librosa

---

## What It Does

| Feature | Description |
|---|---|
| **Song Lesson Generator** | Enter any song — a 4-agent AI council analyses it and produces a full lesson: music theory, technique guide, ear training, practice plan, chord fingerings, and a quiz |
| **Chord Practice** | Record a chord attempt via microphone; the audio engine detects which notes are present, scores accuracy, and generates personalised fingering tips |
| **SVG Fretboard Feedback** | Visual fretboard shows green (detected), red (missing), and yellow (extra) notes after every attempt |
| **Transition Trainer** | Timed chord-to-chord switch drill with TPM (transitions per minute) tracking |
| **Personalised Daily Plan** | Learns from your history and builds a 5–7 item daily plan: warmup, focus chord, new challenge, and a transition drill |
| **Progress Dashboard** | 52-week activity heatmap, skill meter, chord mastery matrix, per-chord attempt history |
| **Quiz with Remediation** | Multiple-choice quiz at the end of each lesson; wrong answers link back to the relevant chord card |
| **Teacher Dashboard** | Teachers see all students, class analytics, and can assign specific chords |
| **Admin Panel** | Admins manage users and roles via a UI at `/admin` |

---

## Project Structure

```
ai-guitar-tutor/
├── frontend/                   Next.js 14 app (deployed to Vercel)
│   └── src/
│       ├── app/                App Router pages
│       │   ├── page.tsx        Landing / chord practice (home)
│       │   ├── dashboard/      Authenticated dashboard
│       │   ├── progress/       Progress analytics + chord drill-down
│       │   ├── profile/        User settings & skill level
│       │   ├── admin/          Admin user management panel
│       │   └── teacher/        Teacher student view
│       ├── components/
│       │   ├── SongCouncil/    Song lesson UI (timeline, mastery board, quiz, play-along)
│       │   ├── feedback/       FretboardVisualizer, NoteDiffStrip, FingeringTipCard
│       │   ├── AdminPanel/     UserManagement, SystemStats
│       │   ├── TeacherDashboard/ StudentList, ClassAnalytics, AssignmentForm
│       │   ├── layout/         AppShell (nav + layout wrapper)
│       │   └── ui/             shadcn/ui primitives + custom StatCard, EmptyState etc.
│       └── lib/
│           ├── api.ts          All API calls + TypeScript interfaces
│           ├── auth.ts         JWT token helpers
│           ├── motion.ts       Framer Motion variants
│           ├── progress.ts     Progress data helpers
│           └── noteDetection.ts  Client-side note frequency detection
│
├── backend/                    FastAPI app (deployed to Render)
│   ├── main.py                 App entry, session management, core endpoints
│   ├── council/                4-agent lesson generation system
│   │   ├── agents.py           Theory / Technique / Ear / Planner AI agents (Groq)
│   │   ├── chairman.py         Synthesiser: assembles LessonDocument from agent outputs
│   │   ├── ingestion.py        Song ingestor: extracts key, chords, feel, structure
│   │   ├── advisor.py          Per-attempt tip generator + lesson revision
│   │   ├── quiz.py             Quiz question generator
│   │   ├── session_store.py    In-memory lesson session cache
│   │   ├── router.py           /api/council/* endpoints
│   │   └── schemas.py          LessonDocument + all council Pydantic models
│   ├── audio_engine/           Chord evaluation (librosa + scipy)
│   ├── feedback_engine/        Tip generator + fingering guidance
│   ├── lesson_service/         File-based chord lesson loader
│   ├── tutor_agent/            Session state machine (IDLE→TEACHING→ANALYZING→FEEDBACK)
│   ├── auth/                   JWT auth (signup, login, refresh, roles)
│   ├── db/                     SQLAlchemy 2.0 models + async engine
│   ├── progress/               Progress tracking API
│   ├── personalization/        Daily plan builder
│   ├── teacher/                Teacher reports + student assignment
│   └── admin/                  Admin user management API
│
└── data/
    ├── lessons/                84 chord lesson folders (metadata.json + reference audio)
    └── chords/
        ├── fingerings.json     Finger positions for all chords (string, fret, finger, note)
        └── chord_definations.json  Chord definitions (notes, quality, root)
```

---

## Tech Stack

### Frontend
| Package | Purpose |
|---|---|
| Next.js 14 (App Router) | Framework, SSR, routing |
| React 18 | UI |
| TypeScript | Type safety |
| Tailwind CSS | Styling (glassmorphism design system) |
| shadcn/ui + Radix UI | Component primitives |
| Framer Motion | Page transitions + card animations |
| SWR | Data fetching with caching |
| Lucide React | Icons |
| Sonner | Toast notifications |
| cmdk | Command palette (⌘K) |

### Backend
| Package | Purpose |
|---|---|
| FastAPI | API framework |
| Groq (`llama-3.3-70b`) | LLM for lesson generation, tips, quiz |
| librosa + scipy + numpy | Audio signal processing, pitch detection |
| SQLAlchemy 2.0 async | ORM |
| asyncpg | PostgreSQL async driver |
| aiosqlite | SQLite driver (local dev fallback) |
| Alembic | DB migrations |
| python-jose + passlib | JWT auth + bcrypt hashing |

### Infrastructure
| Service | Role |
|---|---|
| Vercel | Frontend hosting (auto-deploy from `main`) |
| Render | Backend hosting (auto-deploy from `main`) |
| Render PostgreSQL | Production database |
| GitHub | Source of truth — push to `main` deploys everywhere |

---

## Running Locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Optional: set env vars (or let it fall back to SQLite)
export GROQ_API_KEY=your_key_here
# DATABASE_URL defaults to sqlite+aiosqlite:///./guitar_tutor.db if not set

uvicorn main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local (not committed)
echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > .env.local

npm run dev
# → http://localhost:3000
```

### Running Tests

```bash
# Backend
cd backend
pytest tests/ -v

# Frontend
cd frontend
npx vitest run
```

---

## Environment Variables

### Backend (set in Render dashboard)
| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Required for AI lesson generation |
| `DATABASE_URL` | PostgreSQL connection string (Render sets this automatically) |
| `SECRET_KEY` | JWT signing key (generate a random 64-char string) |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (e.g. `https://yourapp.vercel.app`) |

### Frontend (set in Vercel dashboard)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. `https://your-api.onrender.com`) |

---

## Roles & Permissions

| Role | Access |
|---|---|
| `student` | Chord practice, song lessons, progress, daily plan |
| `teacher` | Everything + student roster, class analytics, chord assignments |
| `admin` | Everything + `/admin` panel (change any user's role, view system stats) |

**Bootstrapping the first admin** — run in Render's PSQL shell:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```
After that, use the `/admin` UI to manage all other roles.

---

## Key API Endpoints

### Core (no auth required)
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/chords` | List all available chords |
| `GET` | `/lesson/{chord}` | Chord lesson metadata |
| `GET` | `/fingering/{chord}` | Fingering positions for chord diagram |
| `POST` | `/learn_chord` | Start tutoring session for a chord |
| `POST` | `/submit_audio` | Submit recorded audio → score + feedback |

### Auth (`/api/auth/`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/signup` | Register + receive JWT tokens |
| `POST` | `/login` | Login + receive JWT tokens |
| `POST` | `/refresh` | Refresh access token |
| `GET` | `/me` | Current user profile |
| `PATCH` | `/me` | Update display name / skill level |

### Song Council (`/api/council/`)
| Method | Path | Description |
|---|---|---|
| `POST` | `/generate` | Generate full song lesson (4-agent pipeline) |
| `POST` | `/practice/tip` | Get personalised tip after a chord attempt |
| `POST` | `/practice/revise` | Revise lesson plan after all chords attempted |
| `POST` | `/quiz` | Generate quiz for a lesson |

### Progress (`/api/progress/`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Summary (mastered count, streak, chord list) |
| `GET` | `/calendar` | 365-day activity data for heatmap |
| `GET` | `/chord/{name}/history` | Full attempt timeline for one chord |
| `GET` | `/transitions` | Transition drill history |
| `POST` | `/transitions` | Save a transition drill result |
| `POST` | `/quiz/{lesson_id}/submit` | Save quiz result |

### Personalisation (`/api/plan/`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/next` | Today's personalised practice plan |
| `GET` | `/weekly` | 7-day plan |

### Teacher (`/api/teacher/`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/students` | List all students |
| `GET` | `/students/{id}/progress` | Student progress detail |
| `GET` | `/analytics` | Class-wide analytics |
| `POST` | `/assign` | Assign a chord to a student |

### Admin (`/api/admin/`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | Paginated user list (filterable by role) |
| `PATCH` | `/users/{id}` | Update a user's role |
| `DELETE` | `/users/{id}` | Delete a user |
| `GET` | `/stats` | System stats (total users, attempts, drills) |

---

## Song Lesson Pipeline

```
User query  →  ingestion.py  →  4 parallel Groq agents  →  chairman.py  →  LessonDocument
               (key, chords,    Theory / Technique /        synthesise       + fingerings
                sections, feel)  Ear / Planner               all outputs       embedded
```

The `LessonDocument` includes: song metadata, chairman summary, four lesson sections, `practice_chords[]` (with fingering positions + chord function), `song_sections[]` (structure), `chord_functions{}`, and a `lesson_id` for subsequent API calls.

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Accounts (id, email, password_hash, display_name, role, skill_level) |
| `refresh_tokens` | JWT refresh token store |
| `chord_attempts` | Every audio submission (user, chord, score, detected/missing/extra notes, feedback) |
| `transition_drills` | Every chord-switch drill result (tpm, got/miss counts) |
| `quiz_results` | Quiz pass/fail per lesson |
| `teacher_assignments` | Teacher-to-student chord assignments |

---

## Deploying Changes

```bash
git add <files>
git commit -m "your message"
git push origin main
```

Vercel rebuilds the frontend automatically. Render rebuilds the backend automatically.
