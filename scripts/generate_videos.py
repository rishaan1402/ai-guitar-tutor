"""
Generate chord diagram lesson videos for all 84 chords.

Draws a guitar fretboard diagram using Pillow and saves as MP4
using imageio-ffmpeg.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FINGERINGS_PATH = PROJECT_ROOT / "data" / "chords" / "fingerings.json"
LESSONS_DIR = PROJECT_ROOT / "data" / "lessons"

# Video dimensions (divisible by 16 for codec compatibility)
WIDTH = 1280
HEIGHT = 720
FPS = 1
DURATION_SECONDS = 8

# Colors
BG_COLOR = (15, 17, 23)           # dark background matching frontend
FRETBOARD_COLOR = (50, 45, 35)    # dark wood
STRING_COLOR = (200, 200, 200)
FRET_COLOR = (160, 150, 130)
NUT_COLOR = (240, 235, 220)
DOT_COLORS = {
    "beginner": (59, 130, 246),     # blue
    "intermediate": (234, 179, 8),  # yellow
    "advanced": (239, 68, 68),      # red
}
TEXT_COLOR = (229, 231, 235)
MUTED_COLOR = (239, 68, 68)
OPEN_COLOR = (74, 222, 128)
NOTE_TEXT_COLOR = (255, 255, 255)
SUBTITLE_COLOR = (156, 163, 175)

# Fretboard layout
FRETBOARD_X = 400
FRETBOARD_Y = 140
FRET_COUNT = 5
STRING_COUNT = 6
FRET_HEIGHT = 80
STRING_SPACING = 50
FRETBOARD_WIDTH = STRING_SPACING * (STRING_COUNT - 1)
FRETBOARD_HEIGHT = FRET_HEIGHT * FRET_COUNT
DOT_RADIUS = 18


def get_font(size: int) -> ImageFont.FreeTypeFont:
    """Try to load a system font, fall back to default."""
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/System/Library/Fonts/Menlo.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for fp in font_paths:
        if Path(fp).exists():
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_fretboard(
    draw: ImageDraw.ImageDraw,
    chord_data: Dict[str, Any],
) -> None:
    """Draw a guitar fretboard diagram with finger positions."""
    positions = chord_data.get("positions", [])
    difficulty = "beginner"

    # Load difficulty from lesson metadata if available
    meta_path = LESSONS_DIR / chord_data["chord"] / "metadata.json"
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
            difficulty = meta.get("difficulty", "beginner")

    dot_color = DOT_COLORS.get(difficulty, DOT_COLORS["beginner"])

    # Determine fret range for the diagram
    played_frets = [p["fret"] for p in positions if "fret" in p and p["fret"] > 0]
    if played_frets:
        min_fret = min(played_frets)
        max_fret = max(played_frets)
        if max_fret <= 5:
            start_fret = 1
        else:
            start_fret = min_fret
    else:
        start_fret = 1

    is_open_position = start_fret == 1

    # Draw fretboard background
    fb_x = FRETBOARD_X
    fb_y = FRETBOARD_Y
    draw.rectangle(
        [fb_x - 20, fb_y - 10, fb_x + FRETBOARD_WIDTH + 20, fb_y + FRETBOARD_HEIGHT + 10],
        fill=FRETBOARD_COLOR,
        outline=(80, 75, 65),
        width=2,
    )

    # Draw nut (thick bar at top) if open position
    if is_open_position:
        draw.rectangle(
            [fb_x - 5, fb_y - 6, fb_x + FRETBOARD_WIDTH + 5, fb_y + 4],
            fill=NUT_COLOR,
        )

    # Draw frets (horizontal lines)
    for i in range(FRET_COUNT + 1):
        y = fb_y + i * FRET_HEIGHT
        lw = 3 if i == 0 else 2
        draw.line([(fb_x, y), (fb_x + FRETBOARD_WIDTH, y)], fill=FRET_COLOR, width=lw)

    # Draw strings (vertical lines)
    for i in range(STRING_COUNT):
        x = fb_x + i * STRING_SPACING
        thickness = 3 - (i * 0.3)  # thicker for bass strings
        draw.line(
            [(x, fb_y), (x, fb_y + FRETBOARD_HEIGHT)],
            fill=STRING_COLOR, width=max(1, int(thickness)),
        )

    # Draw fret numbers on the left
    font_small = get_font(16)
    for i in range(FRET_COUNT):
        fret_num = start_fret + i
        y = fb_y + i * FRET_HEIGHT + FRET_HEIGHT // 2
        draw.text((fb_x - 40, y - 8), str(fret_num), fill=SUBTITLE_COLOR, font=font_small)

    # Draw string numbers at bottom
    for i in range(STRING_COUNT):
        x = fb_x + i * STRING_SPACING
        string_num = STRING_COUNT - i  # string 6 on left, 1 on right
        draw.text((x - 4, fb_y + FRETBOARD_HEIGHT + 15), str(string_num),
                   fill=SUBTITLE_COLOR, font=font_small)

    # Draw finger positions and open/muted markers
    font_dot = get_font(14)
    font_marker = get_font(22)

    for pos in positions:
        string_num = pos["string"]
        string_idx = STRING_COUNT - string_num  # 6->0, 1->5
        x = fb_x + string_idx * STRING_SPACING

        if "action" in pos and pos["action"] == "mute":
            # Draw X above the nut
            draw.text((x - 8, fb_y - 40), "X", fill=MUTED_COLOR, font=font_marker)
            continue

        fret = pos.get("fret", 0)
        note = pos.get("note", "")

        if fret == 0:
            # Open string: draw O above the nut
            draw.text((x - 8, fb_y - 40), "O", fill=OPEN_COLOR, font=font_marker)
        else:
            # Draw dot at the fret position
            fret_offset = fret - start_fret
            if 0 <= fret_offset < FRET_COUNT:
                cy = fb_y + fret_offset * FRET_HEIGHT + FRET_HEIGHT // 2
                draw.ellipse(
                    [x - DOT_RADIUS, cy - DOT_RADIUS, x + DOT_RADIUS, cy + DOT_RADIUS],
                    fill=dot_color,
                    outline=(255, 255, 255),
                    width=2,
                )
                # Draw note name inside dot
                if note:
                    tw = draw.textlength(note, font=font_dot)
                    draw.text((x - tw / 2, cy - 8), note, fill=NOTE_TEXT_COLOR, font=font_dot)


def draw_chord_info(
    draw: ImageDraw.ImageDraw,
    chord_data: Dict[str, Any],
) -> None:
    """Draw chord name, notes, and difficulty on the right side."""
    info_x = FRETBOARD_X + FRETBOARD_WIDTH + 100
    info_y = FRETBOARD_Y

    # Load difficulty
    difficulty = "beginner"
    meta_path = LESSONS_DIR / chord_data["chord"] / "metadata.json"
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
            difficulty = meta.get("difficulty", "beginner")

    font_title = get_font(48)
    font_sub = get_font(24)
    font_body = get_font(20)

    # Chord display name
    display = chord_data.get("display_name", chord_data["chord"])
    draw.text((info_x, info_y), display, fill=TEXT_COLOR, font=font_title)

    # Full chord name
    full_name = chord_data["chord"].replace("_", " ")
    draw.text((info_x, info_y + 60), full_name, fill=SUBTITLE_COLOR, font=font_sub)

    # Notes
    notes = chord_data.get("notes", [])
    notes_str = "Notes: " + "  ".join(notes)
    draw.text((info_x, info_y + 110), notes_str, fill=TEXT_COLOR, font=font_body)

    # Difficulty badge
    badge_y = info_y + 160
    badge_color = DOT_COLORS.get(difficulty, DOT_COLORS["beginner"])
    badge_text = difficulty.capitalize()
    tw = draw.textlength(badge_text, font=font_body)
    draw.rounded_rectangle(
        [info_x, badge_y, info_x + tw + 24, badge_y + 32],
        radius=6, fill=badge_color,
    )
    draw.text((info_x + 12, badge_y + 5), badge_text, fill=(255, 255, 255), font=font_body)

    # Instructions
    draw.text(
        (info_x, badge_y + 60),
        "Place your fingers as shown",
        fill=SUBTITLE_COLOR, font=font_body,
    )
    draw.text(
        (info_x, badge_y + 90),
        "then strum and record!",
        fill=SUBTITLE_COLOR, font=font_body,
    )


def draw_header(draw: ImageDraw.ImageDraw) -> None:
    """Draw the app title at the top."""
    font = get_font(28)
    draw.text((40, 30), "AI Guitar Tutor", fill=(100, 116, 139), font=font)
    draw.line([(40, 70), (WIDTH - 40, 70)], fill=(55, 65, 81), width=1)


def generate_chord_image(chord_data: Dict[str, Any]) -> np.ndarray:
    """Generate a chord diagram image as a numpy array."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    draw_header(draw)
    draw_fretboard(draw, chord_data)
    draw_chord_info(draw, chord_data)

    return np.array(img)


def generate_video(chord_data: Dict[str, Any], output_path: Path) -> None:
    """Generate an MP4 video from the chord diagram."""
    frame = generate_chord_image(chord_data)

    writer = imageio.get_writer(
        str(output_path),
        fps=FPS,
        codec="libx264",
        macro_block_size=16,
        quality=8,
    )

    for _ in range(DURATION_SECONDS * FPS):
        writer.append_data(frame)

    writer.close()


def main() -> None:
    if not FINGERINGS_PATH.exists():
        print(f"ERROR: {FINGERINGS_PATH} not found. Run generate_fingerings.py first.")
        return

    with open(FINGERINGS_PATH) as f:
        all_fingerings = json.load(f)

    print(f"Generating videos for {len(all_fingerings)} chords...")

    for i, chord_data in enumerate(all_fingerings):
        chord_name = chord_data["chord"]
        output_path = LESSONS_DIR / chord_name / "lesson.mp4"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        generate_video(chord_data, output_path)

        size_kb = output_path.stat().st_size / 1024
        print(f"  [{i+1}/{len(all_fingerings)}] {chord_name}: {size_kb:.0f} KB")

    print(f"\nDone! Generated {len(all_fingerings)} videos.")


if __name__ == "__main__":
    main()
