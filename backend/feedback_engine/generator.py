from __future__ import annotations

import logging
import os
import random
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Lazily initialised Gemini client — only created if GOOGLE_API_KEY is set
_gemini_model = None


def _get_gemini_model():
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel("gemini-2.0-flash-lite")
        logger.info("Gemini model initialised")
    except Exception as e:
        logger.warning("Failed to initialise Gemini: %s", e)
        _gemini_model = None
    return _gemini_model


class FeedbackGenerator:
    """
    Converts audio evaluation results into human-readable,
    beginner-friendly tutor feedback.

    If GOOGLE_API_KEY is set, uses Gemini 2.0 Flash for rich,
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

    def generate(
        self,
        evaluation: Dict[str, Any],
        chord_name: Optional[str] = None,
        attempt: int = 1,
        score_history: Optional[List[float]] = None,
        fingering_positions: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Generate feedback text from an evaluation result.

        Uses Gemini if GOOGLE_API_KEY is set, otherwise falls back
        to rule-based templates.
        """
        issue: Optional[str] = evaluation.get("issue")

        # These cases don't benefit from LLM — handle directly
        if issue in ("missing_audio", "processing_error"):
            return random.choice(self._ERROR_RESPONSES)
        if issue == "no_sound":
            return random.choice(self._NO_SOUND_RESPONSES)

        model = _get_gemini_model()
        if model is not None:
            try:
                return self._generate_with_gemini(
                    model, evaluation, chord_name, attempt, score_history, fingering_positions
                )
            except Exception as e:
                logger.warning("Gemini call failed, falling back to templates: %s", e)

        return self._generate_from_templates(evaluation)

    def _generate_with_gemini(
        self,
        model: Any,
        evaluation: Dict[str, Any],
        chord_name: Optional[str],
        attempt: int,
        score_history: Optional[List[float]],
        fingering_positions: Optional[List[Dict[str, Any]]],
    ) -> str:
        score: float = evaluation.get("score", 0.0)
        detected: List[str] = evaluation.get("detected_notes", [])
        expected: List[str] = evaluation.get("expected_notes", [])
        missing: List[str] = evaluation.get("missing_notes", [])
        extra: List[str] = evaluation.get("extra_notes", [])
        issue: Optional[str] = evaluation.get("issue")

        chord_display = (chord_name or "this chord").replace("_", " ")
        score_pct = round(score * 100)

        # Build score progression string
        progress_str = ""
        if score_history and len(score_history) > 1:
            history_pcts = [f"{round(s * 100)}%" for s in score_history]
            progress_str = f"Score progression across attempts: {' → '.join(history_pcts)}."

        # Build fingering context for missing notes
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

        response = model.generate_content(prompt)
        return response.text.strip()

    def _generate_from_templates(self, evaluation: Dict[str, Any]) -> str:
        """Rule-based fallback when Gemini is unavailable."""
        issue: Optional[str] = evaluation.get("issue")
        score: float = evaluation.get("score", 0.0)
        missing: List[str] = evaluation.get("missing_notes", [])

        if issue == "wrong_chord":
            return random.choice(self._WRONG_CHORD_RESPONSES)
        if score >= 1.0:
            return random.choice(self._PERFECT_RESPONSES)
        if score >= 0.8 and not missing:
            return random.choice(self._GOOD_RESPONSES)
        if issue == "muted_string" and missing:
            return self._format_note_feedback(self._MUTED_STRING_TEMPLATES, missing)
        if missing:
            return self._format_note_feedback(self._MISSING_NOTE_TEMPLATES, missing)
        if score >= 0.6:
            return random.choice(self._GOOD_RESPONSES)
        return random.choice(self._WRONG_CHORD_RESPONSES)

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
            issue_desc = f"Most notes came through but {', '.join(missing)} {'is' if len(missing) == 1 else 'are'} missing. You may also have extra notes: {', '.join(extra)}."
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
