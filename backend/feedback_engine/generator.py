from __future__ import annotations

import asyncio
import logging
import os
import random
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Override with the GROQ_MODEL env var. llama-3.3-70b-versatile was retired;
# gpt-oss-120b is the strongest general model on Groq as of 2026-11.
GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
# Lighter model for the many short calls (council agents, chairman, tips,
# feedback). Groq rate-limits per model, so splitting the load keeps a song
# lesson from stalling on 429 back-offs.
GROQ_FAST_MODEL = os.environ.get("GROQ_FAST_MODEL", "openai/gpt-oss-20b")
_REASONING_HEADROOM = 512


def llm_params(max_tokens: int, model: str | None = None) -> dict:
    """Model + token settings for a Groq chat completion.

    Reasoning models (gpt-oss, qwen3) spend hidden reasoning tokens out of the
    same budget, so short answers would come back empty: keep reasoning low and
    add headroom on top of the visible-answer budget.
    """
    model = model or GROQ_MODEL
    if model.startswith(("openai/gpt-oss", "qwen/")):
        return {"model": model, "max_tokens": max_tokens + _REASONING_HEADROOM,
                "extra_body": {"reasoning_effort": "low"}}
    return {"model": model, "max_tokens": max_tokens}

# Lazily initialised Groq client — only created if GROQ_API_KEY is set
_groq_client = None


def _get_groq_client():
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        from groq import AsyncGroq
        _groq_client = AsyncGroq(api_key=api_key)
        logger.info("Groq client initialised (model: %s)", GROQ_MODEL)
    except Exception as e:
        logger.warning("Failed to initialise Groq: %s", e)
        _groq_client = None
    return _groq_client


# Backwards-compat alias used by council modules
def _get_gemini_model():
    return _get_groq_client()


class FeedbackGenerator:
    """
    Converts audio evaluation results into human-readable,
    beginner-friendly tutor feedback.

    If GROQ_API_KEY is set, uses Llama 3.3 70B via Groq for rich,
    contextual responses. Falls back to rule-based templates otherwise.
    """

    _PERFECT_RESPONSES = [
        "That sounded great! You nailed it.",
        "Perfect! All the notes rang out clearly.",
        "Excellent work! Your chord is spot on.",
        "Well done! That was a clean chord.",
    ]

    _GOOD_RESPONSES = [
        "Nice job! Almost there — just a small adjustment needed.",
        "Good effort! You're very close to getting it perfect.",
        "Sounding good! A tiny tweak will make it even better.",
    ]

    _MUTED_STRING_TEMPLATES = [
        "Your {notes} {noun} not ringing clearly. Try pressing closer to the fret.",
        "It sounds like {notes} {verb} muted. Check your finger placement on {those} {strings}.",
        "I can't hear {notes} clearly. Make sure your fingers aren't touching nearby strings.",
    ]

    _MISSING_NOTE_TEMPLATES = [
        "I'm not hearing {notes} in your chord. Double-check your finger positioning.",
        "The {notes} {noun} missing from your chord. Adjust your hand and try again.",
    ]

    _WRONG_CHORD_RESPONSES = [
        "That doesn't quite sound like the right chord. Let's try again — check the finger diagram.",
        "Hmm, the notes I'm hearing don't match. Review the chord shape and give it another go.",
        "That might be a different chord. Take another look at the lesson and try once more.",
    ]

    _NO_SOUND_RESPONSES = [
        "I didn't pick up any sound. Make sure your microphone is working and strum again.",
        "No audio detected. Check your microphone and try recording again.",
    ]

    _ERROR_RESPONSES = [
        "Something went wrong analyzing your recording. Please try again.",
    ]

    _UNSUPPORTED_RESPONSES = [
        "I couldn't read that recording format. Please record again in the app "
        "(it sends WAV), or upload a .wav, .flac, .ogg or .mp3 file.",
    ]

    LLM_TIMEOUT_S = 8.0

    def generate(
        self,
        evaluation: Dict[str, Any],
        chord_name: Optional[str] = None,
        attempt: int = 1,
        score_history: Optional[List[float]] = None,
        fingering_positions: Optional[List[Dict[str, Any]]] = None,
        user_context: str = "",
    ) -> str:
        """Rule-based feedback only (sync). Use ``agenerate`` for LLM feedback."""
        fixed = self._fixed_response(evaluation)
        if fixed is not None:
            return fixed
        return self._with_tuning_note(
            evaluation, self._generate_from_templates(evaluation, fingering_positions)
        )

    async def agenerate(
        self,
        evaluation: Dict[str, Any],
        chord_name: Optional[str] = None,
        attempt: int = 1,
        score_history: Optional[List[float]] = None,
        fingering_positions: Optional[List[Dict[str, Any]]] = None,
        user_context: str = "",
    ) -> str:
        """Feedback text for an evaluation: Groq LLM when configured, else templates.

        Awaited from the request handler (never ``run_until_complete`` inside a
        running loop), bounded by LLM_TIMEOUT_S, and always falls back to the
        deterministic templates on any failure.
        """
        fixed = self._fixed_response(evaluation)
        if fixed is not None:
            return fixed
        client = _get_groq_client()
        if client is not None:
            try:
                text = await asyncio.wait_for(
                    self._generate_with_groq(
                        client, evaluation, chord_name, attempt, score_history,
                        fingering_positions, user_context,
                    ),
                    timeout=self.LLM_TIMEOUT_S,
                )
                if text:
                    return self._with_tuning_note(evaluation, text)
            except Exception as e:  # includes asyncio.TimeoutError
                logger.warning("Groq call failed, falling back to templates: %s", e)
        return self._with_tuning_note(
            evaluation, self._generate_from_templates(evaluation, fingering_positions)
        )

    def _fixed_response(self, evaluation: Dict[str, Any]) -> Optional[str]:
        """Cases where an LLM adds nothing (no audio, errors)."""
        issue = evaluation.get("issue")
        if issue in ("missing_audio", "processing_error"):
            return random.choice(self._ERROR_RESPONSES)
        if issue == "unsupported_format":
            return random.choice(self._UNSUPPORTED_RESPONSES)
        if issue == "no_sound":
            return random.choice(self._NO_SOUND_RESPONSES)
        if issue == "out_of_tune":
            cents = float(evaluation.get("tuning_cents") or 0.0)
            direction = "sharp" if cents > 0 else "flat"
            return (
                f"Your chord shape sounds right, but your guitar is about {abs(round(cents))} cents "
                f"{direction}. Tune {'down' if cents > 0 else 'up'} and strum it again."
            )
        if issue == "unclear":
            # Not a judgement: the evidence was borderline. Never blame the learner.
            notes = evaluation.get("unclear_notes") or []
            expected = set(evaluation.get("expected_notes") or [])
            quiet = [n for n in notes if n in expected]
            stray = [n for n in notes if n not in expected]
            base = "I couldn't hear every string clearly — let the chord ring and strum once more."
            if quiet:
                base += f" Listen for the {', '.join(quiet)}."
            if stray:
                base += f" I may have heard a stray {', '.join(stray)} — check nothing else is ringing."
            return base
        return None

    @staticmethod
    def _with_tuning_note(evaluation: Dict[str, Any], text: str) -> str:
        if not evaluation.get("tuning_warning") or evaluation.get("issue") == "out_of_tune":
            return text
        cents = float(evaluation.get("tuning_cents") or 0.0)
        direction = "sharp" if cents > 0 else "flat"
        return (
            f"Your guitar sounds about {abs(round(cents))} cents {direction} — "
            f"tune {'down' if cents > 0 else 'up'} for the most accurate grading. {text}"
        )

    async def _generate_with_groq(
        self,
        client: Any,
        evaluation: Dict[str, Any],
        chord_name: Optional[str],
        attempt: int,
        score_history: Optional[List[float]],
        fingering_positions: Optional[List[Dict[str, Any]]],
        user_context: str = "",
    ) -> str:
        score: float = evaluation.get("score", 0.0)
        detected: List[str] = evaluation.get("detected_notes", [])
        expected: List[str] = evaluation.get("expected_notes", [])
        missing: List[str] = evaluation.get("missing_notes", [])
        extra: List[str] = evaluation.get("extra_notes", [])
        issue: Optional[str] = evaluation.get("issue")

        chord_display = (chord_name or "this chord").replace("_", " ")
        score_pct = round(score * 100)

        progress_str = ""
        if score_history and len(score_history) > 1:
            history_pcts = [f"{round(s * 100)}%" for s in score_history]
            progress_str = f"Score progression across attempts: {' → '.join(history_pcts)}."

        fingering_str = ""
        if missing and fingering_positions:
            tips = []
            for note in missing:
                for pos in fingering_positions:
                    if pos.get("note") == note:
                        fret = pos.get("fret", 0)
                        string = pos.get("string")
                        finger = pos.get("finger")
                        if fret > 0 and finger:
                            tips.append(f"{note} → finger {finger} on string {string}, fret {fret}")
                        elif fret > 0:
                            tips.append(f"{note} → string {string}, fret {fret}")
                        else:
                            tips.append(f"{note} → string {string} open")
                        break
            if tips:
                fingering_str = f"Fingering for missing notes: {'; '.join(tips)}."

        prompt = f"""You are a friendly, encouraging guitar tutor giving feedback to a beginner student.

Chord being practised: {chord_display}
Attempt number: {attempt}
Score: {score_pct}%
Expected notes: {', '.join(expected) if expected else 'unknown'}
Detected notes: {', '.join(detected) if detected else 'none'}
Missing notes: {', '.join(missing) if missing else 'none'}
Extra/wrong notes: {', '.join(extra) if extra else 'none'}
Issue: {issue or 'none'}
{progress_str}
{fingering_str}

Write 1-2 sentences of feedback. Be specific about what went wrong and how to fix it. \
Mention specific fingers, strings or frets if you have that information. \
If the score is improving across attempts, acknowledge the progress. \
Keep it encouraging and actionable. Do not use markdown or bullet points."""

        messages = []
        if user_context:
            messages.append({"role": "system", "content": f"You are a guitar tutor.\n\n{user_context}"})
        messages.append({"role": "user", "content": prompt})

        response = await client.chat.completions.create(
            messages=messages,
            temperature=0.7,
            **llm_params(120, GROQ_FAST_MODEL),
        )
        return response.choices[0].message.content.strip()

    def _generate_from_templates(
        self,
        evaluation: Dict[str, Any],
        fingering_positions: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Deterministic feedback that leads with the most actionable fix."""
        issue: Optional[str] = evaluation.get("issue")
        score: float = evaluation.get("score", 0.0)
        missing: List[str] = evaluation.get("missing_notes", [])
        extra: List[str] = evaluation.get("extra_notes", [])
        expected: List[str] = evaluation.get("expected_notes", [])
        sounds_like: Optional[str] = evaluation.get("sounds_like")

        if score >= 1.0 and not missing and not extra:
            return random.choice(self._PERFECT_RESPONSES)
        if sounds_like:
            target = evaluation.get("chord_display") or "this chord"
            return (
                f"That sounded like {sounds_like}, not {target}. "
                "Compare your finger positions with the diagram and try again."
            )
        if issue == "wrong_chord":
            return random.choice(self._WRONG_CHORD_RESPONSES)

        lead = self._fix_lead(missing, fingering_positions or [])
        matched = len(expected) - len(missing)
        if missing:
            if expected and matched / len(expected) >= 2 / 3:
                body = f"Almost there — {', '.join(missing)} {'is' if len(missing) == 1 else 'are'} not ringing yet."
            else:
                body = f"I only heard {matched} of {len(expected)} notes; {', '.join(missing)} {'is' if len(missing) == 1 else 'are'} missing."
            if issue == "muted_string":
                body += " Press just behind the fret and keep other fingers off that string."
            if extra:
                body += f" I also heard {', '.join(extra)}, which isn't in this chord."
            return f"{lead} {body}".strip()
        if extra:
            return (
                f"All the chord notes are there, but I also heard {', '.join(extra)}. "
                "Mute strings that shouldn't ring and check no finger is on the wrong fret."
            )
        if score >= 0.6:
            return random.choice(self._GOOD_RESPONSES)
        return random.choice(self._WRONG_CHORD_RESPONSES)

    @staticmethod
    def _fix_lead(missing: List[str], positions: List[Dict[str, Any]]) -> str:
        """One concrete instruction for the first missing note, e.g. 'Finger 2 on string 5, fret 2:'."""
        for note in missing:
            for pos in positions:
                if pos.get("note") != note:
                    continue
                string, fret, finger = pos.get("string"), pos.get("fret", 0), pos.get("finger")
                if fret and finger:
                    return f"Check finger {finger} on string {string}, fret {fret} ({note})."
                if fret:
                    return f"Check string {string}, fret {fret} ({note})."
                return f"Let open string {string} ({note}) ring — don't touch it."
        return ""

    @staticmethod
    def generate_analysis_summary(evaluation: Dict[str, Any]) -> Dict[str, Any]:
        """Build a detailed analysis summary of what the engine heard."""
        detected = evaluation.get("detected_notes", [])
        expected = evaluation.get("expected_notes", [])
        missing = evaluation.get("missing_notes", [])
        extra = evaluation.get("extra_notes", [])
        score = evaluation.get("score", 0.0)
        issue = evaluation.get("issue")

        matched = [n for n in expected if n in detected]
        total_expected = len(expected)
        total_detected = len(detected)

        if total_detected == 0:
            heard_desc = "No notes were detected in your recording."
        elif total_detected == 1:
            heard_desc = f"The engine picked up 1 note: {detected[0]}."
        else:
            heard_desc = f"The engine picked up {total_detected} notes: {', '.join(detected)}."

        if score >= 1.0:
            match_desc = f"All {total_expected} expected notes were found — perfect match!"
        elif len(matched) > 0:
            match_desc = f"{len(matched)} of {total_expected} expected notes matched: {', '.join(matched)}."
        else:
            match_desc = f"None of the {total_expected} expected notes were found."

        issue_desc = None
        if issue == "wrong_chord":
            if extra:
                issue_desc = f"The notes heard ({', '.join(detected)}) suggest a different chord. You may be playing the wrong shape."
            else:
                issue_desc = "The notes don't match this chord at all. Double-check your finger positions."
        elif issue == "muted_string":
            issue_desc = f"Some strings seem muted — {', '.join(missing)} didn't ring out. Press harder near the frets."
        elif issue == "missing_note":
            lead = "Most notes came through, but" if total_expected and len(matched) / total_expected >= 2 / 3 \
                else f"Only {len(matched)} of {total_expected} notes came through;"
            issue_desc = f"{lead} {', '.join(missing)} {'is' if len(missing) == 1 else 'are'} missing."
            if extra:
                issue_desc += f" Extra notes heard: {', '.join(extra)}."
        elif issue == "no_sound":
            issue_desc = "No sound was captured. Check that your microphone is active and close to the guitar."

        extra_desc = None
        if extra and issue != "wrong_chord":
            extra_desc = f"Extra notes detected: {', '.join(extra)}. These aren't part of the chord — you may be accidentally touching adjacent strings."

        return {
            "heard": heard_desc,
            "match": match_desc,
            "issue_detail": issue_desc,
            "extra_detail": extra_desc,
            "matched_notes": matched,
            "matched_count": len(matched),
            "total_expected": total_expected,
            "total_detected": total_detected,
        }

    @staticmethod
    def generate_fingering_tips(
        missing_notes: List[str],
        positions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Generate finger-specific tips for each missing note."""
        tips: List[Dict[str, Any]] = []
        for note in missing_notes:
            for pos in positions:
                if pos.get("note") == note and pos.get("fret", 0) > 0:
                    finger = pos.get("finger")
                    string = pos["string"]
                    fret = pos["fret"]
                    if finger:
                        tip = f"Place finger {finger} on string {string}, fret {fret} for the {note} note"
                    else:
                        tip = f"Check string {string}, fret {fret} for the {note} note"
                    tips.append({
                        "note": note,
                        "string": string,
                        "fret": fret,
                        "finger": finger,
                        "tip": tip,
                    })
                    break
                elif pos.get("note") == note and pos.get("fret") == 0:
                    tips.append({
                        "note": note,
                        "string": pos["string"],
                        "fret": 0,
                        "finger": None,
                        "tip": f"String {pos['string']} should ring open for the {note} note — make sure you're not muting it",
                    })
                    break
        return tips

    @staticmethod
    def _format_note_feedback(templates: List[str], missing: List[str]) -> str:
        notes_str = ", ".join(missing)
        is_plural = len(missing) > 1
        template = random.choice(templates)
        return template.format(
            notes=notes_str,
            noun="are" if is_plural else "is",
            verb="are" if is_plural else "is",
            those="those" if is_plural else "that",
            strings="strings" if is_plural else "string",
        )
