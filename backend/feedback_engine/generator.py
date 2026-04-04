from __future__ import annotations

import logging
import random
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class FeedbackGenerator:
    """
    Converts audio evaluation results into human-readable,
    beginner-friendly tutor feedback.

    Feedback is short, encouraging, and actionable.
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

    def generate(self, evaluation: Dict[str, Any]) -> str:
        """
        Generate feedback text from an evaluation result dict.

        Expected keys:
            score (float), detected_notes (list), missing_notes (list),
            issue (str | None)
        """
        issue: Optional[str] = evaluation.get("issue")
        score: float = evaluation.get("score", 0.0)
        missing: List[str] = evaluation.get("missing_notes", [])

        if issue == "missing_audio" or issue == "processing_error":
            return random.choice(self._ERROR_RESPONSES)

        if issue == "no_sound":
            return random.choice(self._NO_SOUND_RESPONSES)

        if issue == "wrong_chord":
            return random.choice(self._WRONG_CHORD_RESPONSES)

        if score >= 1.0:
            return random.choice(self._PERFECT_RESPONSES)

        if score >= 0.8 and not missing:
            return random.choice(self._GOOD_RESPONSES)

        if issue == "muted_string" and missing:
            return self._format_note_feedback(self._MUTED_STRING_TEMPLATES, missing)

        if issue == "missing_note" and missing:
            return self._format_note_feedback(self._MISSING_NOTE_TEMPLATES, missing)

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

        # Describe what was heard
        if total_detected == 0:
            heard_desc = "No notes were detected in your recording."
        elif total_detected == 1:
            heard_desc = f"The engine picked up 1 note: {detected[0]}."
        else:
            heard_desc = f"The engine picked up {total_detected} notes: {', '.join(detected)}."

        # Describe match quality
        if score >= 1.0:
            match_desc = f"All {total_expected} expected notes were found — perfect match!"
        elif len(matched) > 0:
            match_desc = f"{len(matched)} of {total_expected} expected notes matched: {', '.join(matched)}."
        else:
            match_desc = f"None of the {total_expected} expected notes were found."

        # Describe issues
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

        # Extra notes explanation
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
        """Format a template with the missing note names."""
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
