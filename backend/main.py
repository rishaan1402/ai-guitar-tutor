from __future__ import annotations

import json
import logging
import math
import os
import sys

# Load .env file if present (local dev convenience — production uses real env vars)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audio_engine import ChordEvaluator
from feedback_engine import FeedbackGenerator
from lesson_service import LessonService
from tutor_agent import TutorAgent, grade_attempt
from tutor_agent.agent import HISTORY_LIMIT
from council.router import router as council_router
from auth.router import router as auth_router
from auth.dependencies import get_current_user_optional
from auth.profile_context import build_user_context
from progress.router import router as progress_router
from teacher.router import router as teacher_router
from teacher.classes import router as class_router
from songs.router import router as songs_router
from admin.router import router as admin_router
from personalization.router import router as plan_router
from db.engine import get_db
from middleware import BodySizeLimitMiddleware
from auth.rate_limit import RateLimiter, client_ip

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared services (stateless, safe to share across sessions)
# ---------------------------------------------------------------------------
lesson_service = LessonService()
evaluator = ChordEvaluator()
feedback_generator = FeedbackGenerator()

# When set, lesson audio/video is served by redirecting to this base URL
# (a public GCS bucket) instead of streaming the local copy in the image.
# Upload cap: ~2 MB is ~45 s of 16-bit mono audio at 22 kHz, far more than a strum.
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(2 * 1024 * 1024)))
UNGRADED_ISSUES = {"no_sound", "processing_error", "unsupported_format", "missing_audio", "unclear"}

LESSON_ASSETS_BASE_URL = os.environ.get("LESSON_ASSETS_BASE_URL", "").rstrip("/")

# Load fingering data for chord diagrams and feedback tips
_fingerings_path = Path(__file__).resolve().parents[1] / "data" / "chords" / "fingerings.json"
_fingerings_by_chord: Dict[str, Dict[str, Any]] = {}
if _fingerings_path.exists():
    with open(_fingerings_path) as _f:
        for entry in json.load(_f):
            _fingerings_by_chord[entry["chord"]] = entry
    logger.info("Loaded fingerings for %d chords", len(_fingerings_by_chord))

# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------
SESSION_TTL_SECONDS = 3600  # 1 hour

_sessions: Dict[str, Dict[str, Any]] = {}


def _get_or_create_session(session_id: str) -> TutorAgent:
    """Get an existing session or create a new one."""
    now = time.time()

    if session_id in _sessions:
        _sessions[session_id]["last_access"] = now
        return _sessions[session_id]["agent"]

    agent = TutorAgent(lesson_service, evaluator, feedback_generator)
    _sessions[session_id] = {"agent": agent, "last_access": now}
    logger.info("Created session: %s (total: %d)", session_id, len(_sessions))
    return agent


def _cleanup_stale_sessions() -> None:
    """Remove sessions older than TTL."""
    now = time.time()
    stale = [
        sid for sid, data in _sessions.items()
        if now - data["last_access"] > SESSION_TTL_SECONDS
    ]
    for sid in stale:
        del _sessions[sid]
    if stale:
        logger.info("Cleaned up %d stale sessions", len(stale))


def _resolve_session(session_id: Optional[str]) -> Tuple[str, TutorAgent]:
    """Resolve session ID from header, creating if needed."""
    _cleanup_stale_sessions()
    sid = session_id or str(uuid.uuid4())
    return sid, _get_or_create_session(sid)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
_ON_CLOUD_RUN = bool(os.environ.get("K_SERVICE"))
app = FastAPI(
    title="AI Guitar Tutor",
    version="1.0.0",
    # Interactive API docs only outside production.
    docs_url=None if _ON_CLOUD_RUN else "/docs",
    redoc_url=None if _ON_CLOUD_RUN else "/redoc",
    openapi_url=None if _ON_CLOUD_RUN else "/openapi.json",
)

# CORS — read allowed origins from env so production can lock to Vercel domain.
# Set ALLOWED_ORIGINS=https://your-app.vercel.app on Render after first deploy.
# Falls back to * for local dev (when env var is absent or empty).
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins.strip()
    else ["*"]
)
logger.info("CORS allowed origins: %s", _allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    # Auth uses Bearer tokens, not cookies; never combine credentials with "*".
    allow_credentials=_allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)

# Body caps enforced while streaming (before multipart spooling to /tmp).
app.add_middleware(
    BodySizeLimitMiddleware,
    default_limit=256 * 1024,
    path_limits=[("/submit_audio", MAX_UPLOAD_BYTES + 64 * 1024)],
)

app.include_router(council_router)
app.include_router(auth_router)
app.include_router(progress_router)
app.include_router(teacher_router)
app.include_router(class_router)
app.include_router(songs_router)
app.include_router(admin_router)
app.include_router(plan_router)


class LearnChordRequest(BaseModel):
    chord_name: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "AI Guitar Tutor"}


@app.get("/chords")
def list_chords() -> Dict[str, Any]:
    """List all available chords that have lessons."""
    return {"chords": lesson_service.list_available_chords()}


@app.get("/lesson/{chord}")
def get_lesson(chord: str) -> Dict[str, Any]:
    """Get lesson metadata for a specific chord."""
    lesson = lesson_service.get_lesson(chord)
    if lesson is None:
        raise HTTPException(status_code=404, detail=f"No lesson found for '{chord}'.")
    return {"lesson": lesson.to_dict()}


@app.get("/video/{chord}")
def get_video(chord: str):
    """Stream the lesson video for a chord (or redirect to its CDN-cacheable copy)."""
    lesson = lesson_service.get_lesson(chord)
    if lesson is None:
        raise HTTPException(status_code=404, detail=f"No lesson found for '{chord}'.")
    video_path = lesson.lesson_video_path
    if video_path is None or not video_path.exists() or video_path.stat().st_size == 0:
        raise HTTPException(status_code=404, detail=f"No video available for '{chord}'.")
    if LESSON_ASSETS_BASE_URL:
        return RedirectResponse(f"{LESSON_ASSETS_BASE_URL}/{quote(chord, safe='')}/lesson.mp4")
    return FileResponse(str(video_path), media_type="video/mp4", filename=f"{chord}.mp4")


@app.get("/fingering/{chord}")
def get_fingering(chord: str) -> Dict[str, Any]:
    """Get fingering data for a chord diagram."""
    if chord not in _fingerings_by_chord:
        raise HTTPException(status_code=404, detail=f"No fingering data for '{chord}'.")
    return _fingerings_by_chord[chord]


@app.get("/audio/{chord}")
def get_audio(chord: str):
    """Stream the reference audio for a chord (or redirect to its CDN-cacheable copy)."""
    lesson = lesson_service.get_lesson(chord)
    if lesson is None:
        raise HTTPException(status_code=404, detail=f"No lesson found for '{chord}'.")
    audio_path = lesson.reference_audio_path
    if audio_path is None or not audio_path.exists() or audio_path.stat().st_size == 0:
        raise HTTPException(status_code=404, detail=f"No audio available for '{chord}'.")
    if LESSON_ASSETS_BASE_URL:
        return RedirectResponse(f"{LESSON_ASSETS_BASE_URL}/{quote(chord, safe='')}/reference.wav")
    return FileResponse(str(audio_path), media_type="audio/wav", filename=f"{chord}.wav")


@app.post("/learn_chord")
def learn_chord(
    request: LearnChordRequest,
    x_session_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Start a tutoring session for the given chord."""
    sid, agent = _resolve_session(x_session_id)
    result = agent.start_lesson(request.chord_name)
    if result["status"] == "error":
        raise HTTPException(status_code=404, detail=result["message"])
    # Pass fingering positions so the feedback generator can reference specific fingers/strings
    fingering_data = _fingerings_by_chord.get(request.chord_name, {})
    agent.set_fingering_positions(fingering_data.get("positions", []))
    result["session_id"] = sid
    return result


def _parse_previous_scores(raw: Optional[str]) -> List[float]:
    """Parse the client's earlier scores for this chord (JSON list of floats)."""
    if not raw:
        return []
    try:
        values = [float(v) for v in json.loads(raw)]
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="previous_scores must be a JSON list of numbers.")
    if not all(math.isfinite(v) for v in values):
        raise HTTPException(status_code=422, detail="previous_scores must be finite numbers.")
    return [min(1.0, max(0.0, v)) for v in values][-HISTORY_LIMIT:]


_anon_submit_limiter = RateLimiter(max_hits=60, window_seconds=60)
_user_submit_limiter = RateLimiter(max_hits=120, window_seconds=60)


@app.post("/submit_audio")
async def submit_audio(
    request: Request,
    audio: UploadFile = File(...),
    chord_name: Optional[str] = Form(None),
    previous_scores: Optional[str] = Form(None),
    x_session_id: Optional[str] = Header(None),
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Accept audio recording and return evaluation feedback.

    Stateless when the client sends ``chord_name`` (and optionally
    ``previous_scores``): any instance can grade the request. Without it,
    falls back to the legacy in-memory session started by /learn_chord.
    """
    limiter, key = (
        (_user_submit_limiter, f"user:{user.id}") if user is not None
        else (_anon_submit_limiter, f"ip:{client_ip(request)}")
    )
    limiter.check(key)
    limiter.hit(key)

    sid = x_session_id or str(uuid.uuid4())
    agent: Optional[TutorAgent] = None
    lesson = None
    prior: List[float] = []

    if chord_name:
        lesson = lesson_service.get_lesson(chord_name)
        if lesson is None:
            raise HTTPException(status_code=404, detail=f"No lesson found for '{chord_name}'.")
        prior = _parse_previous_scores(previous_scores)
    else:
        sid, agent = _resolve_session(x_session_id)
        if agent.state.value not in ("WAITING_FOR_PLAY", "FEEDBACK"):
            raise HTTPException(
                status_code=400,
                detail="Not ready for audio. Start a lesson first.",
            )

    suffix = Path(audio.filename or "recording.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        size = 0
        while chunk := await audio.read(64 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                tmp.close()
                Path(tmp_path).unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail="Recording is too long. Keep it under about 10 seconds and try again.",
                )
            tmp.write(chunk)

    # Build user profile context for personalized feedback
    # Capture before the rollback below: rollback expires loaded ORM objects, and
    # touching user.id afterwards would trigger a lazy load outside the greenlet.
    user_id = user.id if user is not None else None
    user_context = await build_user_context(db, user_id)
    # Release the DB connection while we analyse and wait on the LLM (up to ~8 s);
    # the pool is small and graded takes are the busiest request.
    await db.rollback()
    try:
        if agent is not None:
            result = await agent.submit_audio(tmp_path, user_context=user_context)
            chord_key = agent.current_chord or ""
        else:
            chord_key = lesson.chord_name
            result = await grade_attempt(
                lesson,
                evaluator,
                feedback_generator,
                tmp_path,
                attempt=len(prior) + 1,
                previous_scores=prior,
                fingering_positions=_fingerings_by_chord.get(chord_key, {}).get("positions", []),
                user_context=user_context,
                chord_lookup=lesson_service.find_chord_by_notes,
            )
            result.pop("_evaluation", None)
    finally:
        try:
            Path(tmp_path).unlink()
        except OSError:
            pass

    eval_data = result.get("evaluation", {})
    issue = eval_data.get("issue") if isinstance(eval_data, dict) else None
    if issue == "unsupported_format":
        raise HTTPException(status_code=422, detail=result.get("feedback") or "Unsupported audio format.")

    # Persist chord attempt for authenticated users. Attempts where nothing was
    # actually graded (no sound, decode errors) are not recorded as 0% takes.
    if user_id is not None and issue not in UNGRADED_ISSUES:
        if isinstance(eval_data, dict) and eval_data.get("score") is not None:
            from db.models import ChordAttempt
            feedback_text = result.get("feedback", "")
            db.add(ChordAttempt(
                user_id=user_id,
                chord_name=chord_key or "unknown",
                score=float(eval_data.get("score", 0.0)),
                detected_notes=eval_data.get("detected_notes", []),
                missing_notes=eval_data.get("missing_notes", []),
                extra_notes=eval_data.get("extra_notes", []),
                issue=eval_data.get("issue"),
                feedback_text=feedback_text,
            ))
            await db.commit()

    # Inject analysis summary and fingering tips
    eval_data = result.get("evaluation", {})
    if isinstance(eval_data, dict):
        result["analysis"] = feedback_generator.generate_analysis_summary(eval_data)
        missing = eval_data.get("missing_notes", [])
        fingering_data = _fingerings_by_chord.get(chord_key, {})
        if missing and fingering_data:
            result["fingering_tips"] = feedback_generator.generate_fingering_tips(
                missing, fingering_data.get("positions", [])
            )

    result["session_id"] = sid
    return result


@app.get("/session")
def get_session(x_session_id: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Get current session state."""
    sid, agent = _resolve_session(x_session_id)
    info = agent.get_session_info()
    info["session_id"] = sid
    return info


@app.post("/reset")
def reset_session(x_session_id: Optional[str] = Header(None)) -> Dict[str, str]:
    """Reset the tutoring session."""
    sid, agent = _resolve_session(x_session_id)
    agent.reset()
    return {"status": "ok", "message": "Session reset.", "session_id": sid}
