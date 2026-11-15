"""The AI coach: answers from what it heard you play, builds goal plans, writes a weekly report.

Every call has a no-AI fallback, so the coach still answers (more plainly) if the
model is unavailable. The model only ever sees the practice profile, never names
or emails.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ChordAttempt, GrooveRun, PathProgress, TransitionDrill, User
from feedback_engine.generator import GROQ_FAST_MODEL, _get_groq_client, llm_params
from personalization.mastery import user_mastery
from personalization.planner import _key_to_symbol
from practice import theory
from practice.profile import Profile

logger = logging.getLogger(__name__)

# rough difficulty order for learning new chords
LEARN_ORDER = ["Em", "Am", "E", "A", "D", "G", "C", "Dm", "E7", "A7", "D7", "G7", "Am7", "Em7", "C7", "B7",
               "Cmaj7", "Fmaj7", "F", "Bm", "F#m", "Gm", "Cm", "B", "Bb", "A#", "C#m", "G#m"]

ISSUE_ADVICE = {
    "muted_string": "a string is getting muted: arch your fingers and press with the very tips, so the next string can ring",
    "missing_note": "one note isn't sounding: check each string one at a time to find which",
    "extra_notes": "an extra note is ringing: watch for strings you should skip or mute",
    "out_of_tune": "your guitar was out of tune: use the tuner pedal first",
    "wrong_chord": "a different chord came out: compare your fingers to the diagram, finger by finger",
}


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=1000)


class CoachAction(BaseModel):
    type: str  # "groove" | "practice" | "tuner" | "path" | "song"
    label: str
    focus: Optional[list[str]] = None
    chord: Optional[str] = None
    style: Optional[str] = None


class CoachReply(BaseModel):
    reply: str
    actions: list[CoachAction] = []


_CHAT_SYSTEM = """You are a warm, expert guitar teacher inside a practice app. You have the learner's real practice data.
Answer in 2-5 short sentences of plain language. Diagnose from their data (named chords, issues, slow changes),
give ONE concrete thing to try, and suggest an action in the app when useful.
If they'd benefit from a human teacher (pain, posture they can't see, repeated stalls), say a teacher can help in one lesson.
Return ONLY JSON: {"reply": str, "actions": [{"type": "groove"|"practice"|"tuner"|"path", "label": str,
"focus": [chordA, chordB] (groove only), "chord": str (practice only), "style": "pop"|"ballad"|"rock"|"folk" (optional)}]}
Use at most 2 actions. Only use chord symbols like G, Am, D7."""


def _fallback_reply(prof: Profile, question: str) -> CoachReply:
    weak = prof.weakest_pair()
    q = question.lower()
    actions: list[CoachAction] = []
    for chord, issues in prof.issues.items():
        if chord.lower() in q and issues:
            top = max(issues.items(), key=lambda kv: kv[1])[0]
            tip = ISSUE_ADVICE.get(top, "slow it right down and check each string")
            actions.append(CoachAction(type="practice", label=f"Practise {chord}", chord=chord))
            return CoachReply(reply=f"On {chord}, {tip}. Strum one string at a time to find it, then play the whole chord.", actions=actions)
    if "tune" in q:
        return CoachReply(reply="Tune before every session: it makes chords sound right and helps the app hear you.",
                          actions=[CoachAction(type="tuner", label="Open the tuner")])
    if weak:
        a, b = weak
        return CoachReply(
            reply=f"Your slowest change right now is {a} to {b}. A short loop that repeats it with a band will speed it up fastest.",
            actions=[CoachAction(type="groove", label=f"Groove for {a} → {b}", focus=[a, b])])
    return CoachReply(reply="Keep it short and daily: ten focused minutes beat an hour once a week. Start with today's lesson.",
                      actions=[CoachAction(type="path", label="Today's lesson")])


def _parse_reply(text: str, prof: Profile) -> Optional[CoachReply]:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        raw = json.loads(m.group(0))
        reply = re.sub(r"\s+", " ", str(raw.get("reply", ""))).strip()[:900]
        if not reply:
            return None
        actions: list[CoachAction] = []
        for a in (raw.get("actions") or [])[:2]:
            t = a.get("type")
            if t == "groove":
                f = [theory.normalise(str(x)) for x in (a.get("focus") or [])][:2]
                if len(f) == 2 and all(f):
                    actions.append(CoachAction(type="groove", label=str(a.get("label") or f"Groove {f[0]} → {f[1]}")[:60],
                                               focus=f, style=a.get("style") if a.get("style") in ("pop", "ballad", "rock", "folk") else None))
            elif t == "practice":
                c = theory.normalise(str(a.get("chord", "")))
                if c:
                    actions.append(CoachAction(type="practice", label=str(a.get("label") or f"Practise {c}")[:60], chord=c))
            elif t in ("tuner", "path"):
                actions.append(CoachAction(type=t, label=str(a.get("label") or ("Open the tuner" if t == "tuner" else "Today's lesson"))[:60]))
        return CoachReply(reply=reply, actions=actions)
    except (json.JSONDecodeError, AttributeError, TypeError):
        return None


async def chat(prof: Profile, messages: list[ChatMessage]) -> CoachReply:
    question = messages[-1].content if messages else ""
    client = _get_groq_client()
    if client is None:
        return _fallback_reply(prof, question)
    convo = [{"role": "system", "content": _CHAT_SYSTEM + "\n\nLearner data:\n" + prof.summary()}]
    convo += [{"role": m.role, "content": m.content} for m in messages[-10:]]
    try:
        resp = await client.chat.completions.create(messages=convo, temperature=0.6, **llm_params(400, GROQ_FAST_MODEL))
        parsed = _parse_reply(resp.choices[0].message.content or "", prof)
        if parsed:
            return parsed
    except Exception as exc:
        logger.warning("Coach chat failed: %s", exc)
    return _fallback_reply(prof, question)


# ------------------------------------------------------------------ goal plans

def build_goal_plan(chords: list[str], days: int, prof: Profile, start: Optional[date] = None) -> dict[str, Any]:
    """Day-by-day plan to play a set of chords (a song) by a date. Pure and deterministic."""
    start = start or date.today()
    days = max(3, min(90, days))
    song = [c for c in (theory.normalise(x) for x in chords) if c]
    uniq = list(dict.fromkeys(song))
    # chords actually played (not the starter defaults a brand-new profile falls back to)
    known = set(prof.mastered + prof.learning)
    new = sorted([c for c in uniq if c not in known], key=lambda c: LEARN_ORDER.index(c) if c in LEARN_ORDER else 99)
    pairs = list(dict.fromkeys((a, b) for a, b in zip(song, song[1:]) if a != b))
    plan: list[dict[str, Any]] = []
    learn_days = min(len(new) * 2, max(1, days // 2)) if new else 0
    for d in range(days):
        day = start + timedelta(days=d)
        tasks: list[dict[str, Any]] = []
        if d < learn_days:
            c = new[min(len(new) - 1, d * len(new) // max(1, learn_days))]
            tasks.append({"type": "learn", "chord": c, "label": f"Learn {c}"})
            prev = next((x for x in uniq if x != c and x in known), None)
            if prev:
                tasks.append({"type": "groove", "focus": [prev, c], "label": f"Groove {prev} → {c}"})
        elif pairs:
            a, b = pairs[(d - learn_days) % len(pairs)]
            tasks.append({"type": "groove", "focus": [a, b], "label": f"Groove {a} → {b}"})
            if d >= days - max(2, days // 4):
                tasks.append({"type": "song", "label": "Play the whole song along"})
        else:
            tasks.append({"type": "song", "label": "Play the whole song along"})
        plan.append({"date": day.isoformat(), "tasks": tasks})
    return {"new_chords": new, "changes": [list(p) for p in pairs], "days": plan}


# ------------------------------------------------------------------ weekly report

async def weekly_stats(db: AsyncSession, user: User, today: Optional[date] = None) -> dict[str, Any]:
    today = today or datetime.now(timezone.utc).date()
    since_d = today - timedelta(days=6)
    since = datetime.combine(since_d, datetime.min.time(), tzinfo=timezone.utc)
    uid = user.id
    takes = (await db.execute(select(ChordAttempt.chord_name, ChordAttempt.issue, ChordAttempt.score, ChordAttempt.created_at)
                              .where(ChordAttempt.user_id == uid, ChordAttempt.created_at >= since))).all()
    graded = [t for t in takes if t.issue not in ("imported", "unclear")]
    clean = [t for t in graded if t.issue is None and (t.score or 0) >= 1.0]
    runs = (await db.execute(select(GrooveRun).where(GrooveRun.user_id == uid, GrooveRun.created_at >= since))).scalars().all()
    drills = (await db.execute(select(func.count()).select_from(TransitionDrill)
                               .where(TransitionDrill.user_id == uid, TransitionDrill.created_at >= since))).scalar() or 0
    path = (await db.execute(select(func.count()).select_from(PathProgress)
                             .where(PathProgress.user_id == uid, PathProgress.completed_at >= since))).scalar() or 0
    mastery = await user_mastery(db, uid)
    new_mastered = sorted(_key_to_symbol(k) for k, m in mastery.items() if m.mastered_on and m.mastered_on >= since_d)
    days = {t.created_at.date() for t in takes} | {r.created_at.date() for r in runs}
    on_time = sum(1 for r in runs for c in (r.changes or []) if c.get("status") == "on_time")
    total_changes = sum(len(r.changes or []) for r in runs)
    worst = None
    per_chord: dict[str, int] = {}
    for t in graded:
        if t.issue:
            sym = _key_to_symbol(t.chord_name)
            per_chord[sym] = per_chord.get(sym, 0) + 1
    if per_chord:
        worst = max(per_chord.items(), key=lambda kv: kv[1])[0]
    return {
        "week_start": since_d.isoformat(), "active_days": len(days), "takes": len(graded), "clean_takes": len(clean),
        "grooves": len(runs), "groove_stars": sum(r.stars for r in runs),
        "on_time_rate": round(on_time / total_changes, 2) if total_changes else None,
        "drills": int(drills), "path_sessions": int(path), "new_mastered": new_mastered, "trouble_chord": worst,
    }


def fallback_summary(s: dict[str, Any]) -> str:
    if not s["takes"] and not s["grooves"]:
        return "A quiet week. Even five minutes a day keeps your fingers learning: start with today's Groove."
    parts = [f"You practised on {s['active_days']} day{'s' if s['active_days'] != 1 else ''} this week"]
    if s["clean_takes"]:
        parts.append(f"with {s['clean_takes']} clean takes")
    if s["new_mastered"]:
        parts.append(f"and mastered {', '.join(s['new_mastered'])}")
    out = " ".join(parts) + "."
    if s["on_time_rate"] is not None:
        out += f" Your chord changes landed on time {round(s['on_time_rate'] * 100)}% of the time in Grooves."
    if s["trouble_chord"]:
        out += f" Next week, give {s['trouble_chord']} a little extra attention."
    return out


async def weekly_summary(stats: dict[str, Any], prof: Profile) -> str:
    client = _get_groq_client()
    if client is None:
        return fallback_summary(stats)
    try:
        resp = await client.chat.completions.create(
            messages=[{"role": "system", "content": "You are a guitar teacher writing a learner's weekly report. "
                       "3-4 warm, specific sentences: what improved, what's stuck, one focus for next week. No headings, no lists."},
                      {"role": "user", "content": f"This week's numbers: {json.dumps(stats)}\nProfile:\n{prof.summary()}"}],
            temperature=0.6, **llm_params(250, GROQ_FAST_MODEL))
        text = re.sub(r"\s+", " ", resp.choices[0].message.content or "").strip()
        return text[:1200] or fallback_summary(stats)
    except Exception as exc:
        logger.warning("Weekly report failed: %s", exc)
        return fallback_summary(stats)
