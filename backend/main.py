from __future__ import annotations

import json
import re
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
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audio_engine import ChordEvaluator
from feedback_engine import FeedbackGenerator
from lesson_service import LessonService
from lesson_service.service import Lesson
from tutor_agent import grade_attempt
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
from meta.router import router as meta_router
from practice.router import router as practice_router
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
UNGRADED_ISSUES = {"no_sound", "processing_error", "unsupported_format", "missing_audio", "unclear", "out_of_tune"}

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
# FastAPI app
# ---------------------------------------------------------------------------
_ON_CLOUD_RUN = bool(os.environ.get("K_SERVICE"))
app = FastAPI(
    title="Open Strings",
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
# Optional pattern for preview deployments, e.g. ^https://ai-guitar-tutor-[a-z0-9-]+\.vercel\.app$
_origin_regex = os.environ.get("ALLOWED_ORIGIN_REGEX", "").strip() or None
logger.info("CORS allowed origins: %s (pattern: %s)", _allowed_origins, _origin_regex)

# Body caps enforced while streaming (before multipart spooling to /tmp).
# Added before CORS so CORS is the outer layer and decorates our 413s too.
app.add_middleware(
    BodySizeLimitMiddleware,
    default_limit=256 * 1024,
    path_limits=[("/submit_audio", MAX_UPLOAD_BYTES + 64 * 1024)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_origin_regex if _allowed_origins != ["*"] else None,
    # Auth uses Bearer tokens, not cookies; never combine credentials with "*".
    allow_credentials=_allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    # Default handler echoes the offending input; a JSON NaN/Infinity there
    # can't be serialised and turned every bad request into a 500.
    errors = [
        {k: v for k, v in err.items() if k in ("loc", "msg", "type")}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


app.include_router(council_router)
app.include_router(auth_router)
app.include_router(progress_router)
app.include_router(teacher_router)
app.include_router(class_router)
app.include_router(songs_router)
app.include_router(admin_router)
app.include_router(plan_router)
app.include_router(meta_router)
app.include_router(practice_router)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "service": "Open Strings"}


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


_NOTE_RE = re.compile(r"^[A-G][#b]?$")
_BUILT_SYMBOL_RE = re.compile(r"^[A-G][#b]?[A-Za-z0-9#b+°ø()/\-]{0,14}$")


def _built_lesson(symbol: str, notes_csv: str, positions_json: Optional[str]):
    """A one-off lesson for a chord built in the app: its notes and (optionally) its shape."""
    symbol = symbol.strip()
    notes = [n.strip() for n in notes_csv.split(",") if n.strip()]
    if not _BUILT_SYMBOL_RE.match(symbol) or not 1 <= len(notes) <= 7 or not all(_NOTE_RE.match(n) for n in notes):
        raise HTTPException(status_code=422, detail="That chord couldn't be read.")
    positions: list[dict[str, Any]] = []
    if positions_json:
        try:
            raw = json.loads(positions_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="Bad chord shape.")
        if not isinstance(raw, list) or len(raw) > 6:
            raise HTTPException(status_code=422, detail="Bad chord shape.")
        for p in raw:
            if not isinstance(p, dict) or not isinstance(p.get("string"), int) or not 1 <= p["string"] <= 6:
                raise HTTPException(status_code=422, detail="Bad chord shape.")
            clean: dict[str, Any] = {"string": p["string"]}
            if p.get("action") == "mute":
                clean["action"] = "mute"
            else:
                fret = p.get("fret")
                if not isinstance(fret, int) or not 0 <= fret <= 24:
                    raise HTTPException(status_code=422, detail="Bad chord shape.")
                clean["fret"] = fret
                if isinstance(p.get("finger"), int) and 1 <= p["finger"] <= 4:
                    clean["finger"] = p["finger"]
                if isinstance(p.get("note"), str) and _NOTE_RE.match(p["note"]):
                    clean["note"] = p["note"]
            positions.append(clean)
    lesson = Lesson(
        chord_name=symbol,
        lesson_video_path=None,
        reference_audio_path=None,  # type: ignore[arg-type]  # graded from its notes alone
        metadata={"chord": symbol, "display_name": symbol, "notes": notes, "built": True},
    )
    return lesson, positions


@app.post("/submit_audio")
async def submit_audio(
    request: Request,
    audio: UploadFile = File(...),
    chord_name: str = Form(..., max_length=40),
    previous_scores: Optional[str] = Form(None),
    # a chord built in the app (not in the lesson library): its notes and shape
    chord_notes: Optional[str] = Form(None, max_length=60),
    chord_positions: Optional[str] = Form(None, max_length=1500),
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Accept audio recording and return evaluation feedback.

    Stateless: the client sends ``chord_name`` and its earlier graded scores
    (``previous_scores``), so any instance can grade any request.
    """
    limiter, key = (
        (_user_submit_limiter, f"user:{user.id}") if user is not None
        else (_anon_submit_limiter, f"ip:{client_ip(request)}")
    )
    limiter.check(key)
    limiter.hit(key)

    lesson = lesson_service.get_lesson(chord_name)
    built = False
    built_positions: list[dict[str, Any]] = []
    if lesson is None and chord_notes:
        lesson, built_positions = _built_lesson(chord_name, chord_notes, chord_positions)
        built = True
    if lesson is None:
        raise HTTPException(status_code=404, detail=f"No lesson found for '{chord_name}'.")
    prior = _parse_previous_scores(previous_scores)

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
    chord_key = lesson.chord_name
    try:
        result = await grade_attempt(
            lesson,
            evaluator,
            feedback_generator,
            tmp_path,
            attempt=len(prior) + 1,
            previous_scores=prior,
            fingering_positions=built_positions or _fingerings_by_chord.get(chord_key, {}).get("positions", []),
            user_context=user_context,
            chord_lookup=lesson_service.find_chord_by_notes,
            chord_lookup_by_strengths=lesson_service.find_chord_by_strengths,
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
    # built chords aren't in the progress history yet (it's keyed by library lessons)
    if user_id is not None and issue not in UNGRADED_ISSUES and not built:
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
        fingering_data = {"positions": built_positions} if built_positions else _fingerings_by_chord.get(chord_key, {})
        if missing and fingering_data:
            result["fingering_tips"] = feedback_generator.generate_fingering_tips(
                missing, fingering_data.get("positions", [])
            )

    return result


