"""
Generate the animated lesson video for every chord.

Each ~9.5 s, 24 fps, 1280x720 video walks through one chord:

  0.0-1.4  title card: the symbol, its full name, notes and difficulty
  1.4-4.4  fingers go down one at a time, with finger numbers and a caption
           ("Finger 2 - string 4 - fret 2 (E)"), then the open / muted strings
  4.4-7.4  the strum: strings ring low to high, in sync with the chord's
           reference recording, each labelled with the note it sounds
  7.4-9.5  "Your turn": the shape stays up with its fret string (x32010)

The diagram is drawn from exactly the same fingering the app shows, so the
picture always matches the caption. Audio is the chord's reference.wav, muxed
in with ffmpeg (from imageio-ffmpeg).

Usage:  python scripts/generate_videos.py [CHORD_KEY ...]
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import imageio
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FINGERINGS_PATH = PROJECT_ROOT / "data" / "chords" / "fingerings.json"
LESSONS_DIR = PROJECT_ROOT / "data" / "lessons"

WIDTH, HEIGHT, FPS = 1280, 720, 24

T_TITLE = 1.4
T_FINGERS = 4.4
T_STRUM = 7.4
T_END = 9.5
STRUM_AUDIO_AT = T_FINGERS + 0.25   # the reference recording starts here
STRUM_STAGGER = 0.045               # seconds between strings in the strum

# Open Strings "studio at night" palette (see frontend/tailwind.config.ts)
BG = (20, 17, 15)
PANEL = (30, 26, 23)
WOOD = (58, 39, 24)
WOOD_EDGE = (80, 58, 38)
STRING = (233, 225, 207)
FRET = (185, 160, 122)
NUT = (243, 234, 216)
CREAM = (243, 234, 216)
GRAY = (169, 157, 137)
DIM = (110, 100, 88)
AMBER = (232, 165, 75)
SAGE = (163, 198, 171)
AMP = (232, 96, 79)
INK = (12, 10, 9)
FINGER_COLORS = {1: (232, 165, 75), 2: (134, 176, 146), 3: (233, 217, 184), 4: (222, 122, 92)}
LEVEL_COLORS = {"beginner": AMBER, "intermediate": (134, 176, 146), "advanced": (217, 72, 59)}

NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
OPEN_PC = {1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4}
QUALITY_NAME = {
    "major": "major", "minor": "minor", "dominant7": "dominant 7th", "major7": "major 7th",
    "minor7": "minor 7th", "half_dim7": "half-diminished 7th", "power": "power chord",
}
FINGER_NAME = {1: "index", 2: "middle", 3: "ring", 4: "pinky"}

# Fretboard geometry (vertical, low E on the left — same as the in-app diagram)
FRETS_SHOWN = 5
SS = 64          # string spacing
FH = 88          # fret height
BX = 170         # x of string 6
BY = 170         # y of the nut
BW = SS * 5
BH = FH * FRETS_SHOWN
DOT_R = 24
PANEL_X = 640

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")


@lru_cache(maxsize=None)
def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    name = ("DejaVuSansMono" if mono else "DejaVuSans") + ("-Bold" if bold else "") + ".ttf"
    path = FONT_DIR / name
    if path.exists():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return 1 - (1 - t) ** 3


def mix(c1: Tuple[int, int, int], c2: Tuple[int, int, int], a: float) -> Tuple[int, int, int]:
    a = min(1.0, max(0.0, a))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * a) for i in range(3))  # type: ignore[return-value]


def pretty(symbol: str) -> str:
    return symbol.replace("m7b5", "m7♭5")


# ---------- chord facts --------------------------------------------------------

class Lesson:
    def __init__(self, chord: Dict[str, Any]):
        self.key: str = chord["chord"]
        self.symbol = pretty(chord.get("display_name") or self.key)
        root, _, quality = self.key.partition("_")
        self.full_name = f"{root} {QUALITY_NAME.get(quality, quality.replace('_', ' '))}"
        self.notes: List[str] = chord.get("notes", [])
        meta_path = LESSONS_DIR / self.key / "metadata.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        self.level: str = meta.get("difficulty", "beginner")

        played: Dict[int, Dict[str, Any]] = {}
        for p in chord.get("positions", []):
            if p.get("action") == "mute":
                continue
            prev = played.get(p["string"])
            if prev is None or p.get("fret", 0) > prev.get("fret", 0):
                played[p["string"]] = p
        self.played = played
        self.muted = [s for s in range(6, 0, -1) if s not in played]
        self.open = [s for s in range(6, 0, -1) if s in played and played[s].get("fret", 0) == 0]

        frets = [p["fret"] for p in played.values() if p.get("fret", 0) > 0]
        self.start_fret = 1 if not frets or max(frets) <= FRETS_SHOWN else min(frets)

        # finger steps: one per finger, a barre is one finger over several strings
        steps: Dict[Tuple[int, int], List[int]] = {}
        for s, p in played.items():
            if p.get("fret", 0) > 0:
                steps.setdefault((p.get("finger") or 0, p["fret"]), []).append(s)
        self.steps = sorted(steps.items(), key=lambda kv: (kv[0][0] or 9, -max(kv[1])))

    def note_on(self, s: int) -> str:
        p = self.played[s]
        return NOTES[(OPEN_PC[s] + p.get("fret", 0)) % 12]

    def fret_string(self) -> str:
        parts = ["x" if s not in self.played else str(self.played[s].get("fret", 0)) for s in range(6, 0, -1)]
        return ("-" if any(len(x) > 1 for x in parts) else "").join(parts)

    def step_caption(self, i: int) -> str:
        (finger, fret), strings = self.steps[i]
        who = f"Finger {finger} ({FINGER_NAME.get(finger, '')})" if finger else "Fret"
        if len(strings) > 1:
            hi, lo = max(strings), min(strings)
            return f"{who} · barre strings {hi}–{lo} · fret {fret}"
        s = strings[0]
        return f"{who} · string {s} · fret {fret} ({self.note_on(s)})"

    def open_mute_caption(self) -> str:
        bits = []
        if self.open:
            bits.append(f"Let string{'s' if len(self.open) > 1 else ''} {', '.join(map(str, self.open))} ring open")
        if self.muted:
            bits.append(f"don't play string{'s' if len(self.muted) > 1 else ''} {', '.join(map(str, self.muted))}")
        text = " · ".join(bits) if bits else "Every string is fretted"
        return text[0].upper() + text[1:]


# ---------- drawing -----------------------------------------------------------

def sx(s: int) -> int:
    return BX + (6 - s) * SS


def fy(lesson: Lesson, fret: int) -> int:
    return BY + (fret - lesson.start_fret) * FH + FH // 2


def centered(draw: ImageDraw.ImageDraw, xy: Tuple[float, float], text: str, f, fill) -> None:
    w = draw.textlength(text, font=f)
    bbox = f.getbbox(text)
    draw.text((xy[0] - w / 2, xy[1] - (bbox[1] + bbox[3]) / 2), text, font=f, fill=fill)


def draw_header(draw: ImageDraw.ImageDraw, lesson: Lesson) -> None:
    draw.text((48, 34), "OPEN STRINGS", font=font(22, bold=True), fill=AMBER)
    lab = f"LESSON · {lesson.symbol}"
    draw.text((WIDTH - 48 - draw.textlength(lab, font=font(18, mono=True)), 38), lab, font=font(18, mono=True), fill=GRAY)
    draw.line([(48, 76), (WIDTH - 48, 76)], fill=(53, 45, 39), width=1)


def draw_board(draw: ImageDraw.ImageDraw, lesson: Lesson, ring: Optional[Dict[int, float]] = None, t: float = 0.0) -> None:
    draw.rounded_rectangle([BX - 34, BY - 12, BX + BW + 34, BY + BH + 12], radius=10, fill=WOOD, outline=WOOD_EDGE, width=2)
    if lesson.start_fret == 1:
        draw.rectangle([BX - 8, BY - 9, BX + BW + 8, BY + 3], fill=NUT)
    else:
        draw.text((BX - 34 - 64, fy(lesson, lesson.start_fret) - 14), f"{lesson.start_fret}fr", font=font(22, bold=True), fill=CREAM)
    for i in range(FRETS_SHOWN + 1):
        y = BY + i * FH
        draw.line([(BX, y), (BX + BW, y)], fill=FRET, width=3 if i else 2)
    for i in range(FRETS_SHOWN):
        n = lesson.start_fret + i
        if n in (3, 5, 7, 9, 15, 17):
            draw.ellipse([BX + BW / 2 - 6, BY + i * FH + FH / 2 - 6, BX + BW / 2 + 6, BY + i * FH + FH / 2 + 6], fill=WOOD_EDGE)
        if n == 12:
            for dx in (-SS, SS):
                draw.ellipse([BX + BW / 2 + dx - 6, BY + i * FH + FH / 2 - 6, BX + BW / 2 + dx + 6, BY + i * FH + FH / 2 + 6], fill=WOOD_EDGE)
    for s in range(6, 0, -1):
        x = sx(s)
        width = 2 + (s - 1) * 0.5
        amp = (ring or {}).get(s, 0.0)
        color = mix(STRING, SAGE, min(1.0, amp * 1.6)) if amp > 0 else (STRING if s in lesson.played else DIM)
        if amp > 0.01:
            pts = []
            for k in range(0, BH + 1, 6):
                env = math.sin(math.pi * k / BH)
                pts.append((x + amp * 7 * env * math.sin(2 * math.pi * (t * (9 + s) + k / 40)), BY + k))
            draw.line(pts, fill=color, width=max(2, int(width)))
        else:
            draw.line([(x, BY), (x, BY + BH)], fill=color, width=max(2, int(width)))
    for s in range(6, 0, -1):
        draw.text((sx(s) - 5, BY + BH + 22), str(s), font=font(16), fill=DIM)


def draw_dot(draw: ImageDraw.ImageDraw, lesson: Lesson, step: int, scale: float) -> None:
    (finger, fret), strings = lesson.steps[step]
    if fret - lesson.start_fret >= FRETS_SHOWN or scale <= 0:
        return
    y = fy(lesson, fret)
    r = DOT_R * scale
    color = FINGER_COLORS.get(finger, AMBER)
    if len(strings) > 1:
        x0, x1 = sx(max(strings)), sx(min(strings))
        draw.rounded_rectangle([x0 - r, y - r, x1 + r, y + r], radius=int(r), fill=color, outline=CREAM, width=2)
        if scale > 0.6:
            centered(draw, ((x0 + x1) / 2, y), str(finger or ""), font(int(24 * scale), bold=True), INK)
        return
    x = sx(strings[0])
    draw.ellipse([x - r, y - r, x + r, y + r], fill=color, outline=CREAM, width=2)
    if scale > 0.6 and finger:
        centered(draw, (x, y), str(finger), font(int(24 * scale), bold=True), INK)


def draw_markers(draw: ImageDraw.ImageDraw, lesson: Lesson, alpha: float) -> None:
    if alpha <= 0:
        return
    y = BY - 44
    for s in lesson.muted:
        centered(draw, (sx(s), y), "×", font(34, bold=True), mix(BG, AMP, alpha))
    for s in lesson.open:
        x = sx(s)
        c = mix(BG, SAGE, alpha)
        draw.ellipse([x - 11, y - 11, x + 11, y + 11], outline=c, width=3)


def draw_note_labels(draw: ImageDraw.ImageDraw, lesson: Lesson, lit: Dict[int, float]) -> None:
    for s, a in lit.items():
        if a <= 0:
            continue
        centered(draw, (sx(s), BY + BH + 62), lesson.note_on(s), font(22, bold=True), mix(BG, SAGE, a))


def draw_panel_title(draw: ImageDraw.ImageDraw, lesson: Lesson, kicker: str) -> None:
    draw.text((PANEL_X, 128), kicker.upper(), font=font(18, mono=True), fill=AMBER)
    draw.text((PANEL_X, 158), lesson.symbol, font=font(76, bold=True), fill=CREAM)
    draw.text((PANEL_X, 256), lesson.full_name, font=font(26), fill=GRAY)


def wrap(draw: ImageDraw.ImageDraw, text: str, f, width: int) -> List[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        nxt = f"{cur} {w}".strip()
        if draw.textlength(nxt, font=f) <= width:
            cur = nxt
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_step_list(draw: ImageDraw.ImageDraw, lesson: Lesson, active: int, done_markers: bool) -> None:
    y = 322
    items = [lesson.step_caption(i) for i in range(len(lesson.steps))] + [lesson.open_mute_caption()]
    f = font(21)
    for i, text in enumerate(items):
        if i > active:
            break
        is_now = i == active and not (i == len(items) - 1 and done_markers and False)
        color = CREAM if is_now else GRAY
        bullet = AMBER if is_now else DIM
        draw.ellipse([PANEL_X, y + 8, PANEL_X + 10, y + 18], fill=bullet)
        for line in wrap(draw, text, f, WIDTH - PANEL_X - 90):
            draw.text((PANEL_X + 24, y), line, font=f, fill=color)
            y += 30
        y += 12


# ---------- frames ------------------------------------------------------------

def frame(lesson: Lesson, t: float) -> np.ndarray:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    d = ImageDraw.Draw(img)
    draw_header(d, lesson)

    if t < T_TITLE:
        a = ease(t / 0.5)
        level_c = LEVEL_COLORS.get(lesson.level, AMBER)
        centered(d, (WIDTH / 2, 280 - 20 * (1 - a)), lesson.symbol, font(150, bold=True), mix(BG, CREAM, a))
        centered(d, (WIDTH / 2, 400), lesson.full_name, font(34), mix(BG, GRAY, a))
        centered(d, (WIDTH / 2, 460), "   ".join(lesson.notes), font(28, mono=True), mix(BG, AMBER, ease((t - 0.3) / 0.5)))
        b = ease((t - 0.5) / 0.4)
        if b > 0:
            label = lesson.level.capitalize()
            w = d.textlength(label, font=font(20, bold=True)) + 32
            d.rounded_rectangle([WIDTH / 2 - w / 2, 510, WIDTH / 2 + w / 2, 546], radius=18, fill=mix(BG, level_c, b))
            centered(d, (WIDTH / 2, 528), label, font(20, bold=True), INK)
        return np.asarray(img)

    n = len(lesson.steps)
    ring: Dict[int, float] = {}
    lit: Dict[int, float] = {}

    if t < T_FINGERS:
        # n finger steps + 1 open/mute step share the window
        slot = (T_FINGERS - T_TITLE - 0.2) / (n + 1)
        k = (t - T_TITLE) / slot
        active = min(n, int(k))
        draw_panel_title(d, lesson, "Fingers down, one at a time")
        draw_board(d, lesson)
        for i in range(min(active + 1, n)):
            local = (t - T_TITLE - i * slot) / 0.25
            pop = ease(local) * (1 + 0.15 * math.sin(math.pi * min(1, max(0, local))))
            draw_dot(d, lesson, i, pop)
        draw_markers(d, lesson, ease((t - T_TITLE - n * slot) / 0.3))
        draw_step_list(d, lesson, active, False)
        return np.asarray(img)

    # every finger is down from here on
    strings_low_high = [s for s in range(6, 0, -1) if s in lesson.played]
    if t < T_STRUM:
        for j, s in enumerate(strings_low_high):
            hit = STRUM_AUDIO_AT + j * STRUM_STAGGER
            dt = t - hit
            if dt >= 0:
                ring[s] = math.exp(-dt * 1.6)
                lit[s] = ease(dt / 0.25)
        draw_panel_title(d, lesson, "Strum, low string to high")
        draw_board(d, lesson, ring, t)
        for i in range(n):
            draw_dot(d, lesson, i, 1.0)
        draw_markers(d, lesson, 1.0)
        draw_note_labels(d, lesson, lit)
        f = font(22)
        y = 330
        for line in wrap(d, "One smooth stroke down. Every string marked with a circle or a dot should ring; "
                            "skip the ones marked ×.", f, WIDTH - PANEL_X - 90):
            d.text((PANEL_X, y), line, font=f, fill=CREAM)
            y += 32
        d.text((PANEL_X, y + 18), "Listen for:  " + "  ".join(lesson.notes), font=font(22, mono=True), fill=AMBER)
        return np.asarray(img)

    # your turn
    for s in strings_low_high:
        lit[s] = 1.0
    draw_panel_title(d, lesson, "Your turn")
    draw_board(d, lesson)
    for i in range(n):
        draw_dot(d, lesson, i, 1.0)
    draw_markers(d, lesson, 1.0)
    draw_note_labels(d, lesson, lit)
    a = ease((t - T_STRUM) / 0.4)
    d.text((PANEL_X, 330), "Shape", font=font(18, mono=True), fill=mix(BG, GRAY, a))
    d.text((PANEL_X, 356), lesson.fret_string(), font=font(46, bold=True, mono=True), fill=mix(BG, CREAM, a))
    d.text((PANEL_X, 430), "low E  →  high e", font=font(16, mono=True), fill=mix(BG, DIM, a))
    d.rounded_rectangle([PANEL_X, 480, PANEL_X + 440, 540], radius=30, fill=mix(BG, AMBER, a))
    centered(d, (PANEL_X + 220, 510), "Strum it, then hit record", font(24, bold=True), INK)
    return np.asarray(img)


def render(lesson: Lesson, out: Path) -> None:
    ref = LESSONS_DIR / lesson.key / "reference.wav"
    with tempfile.TemporaryDirectory() as tmp:
        silent = Path(tmp) / "v.mp4"
        writer = imageio.get_writer(str(silent), fps=FPS, codec="libx264", macro_block_size=16,
                                    quality=7, pixelformat="yuv420p",
                                    ffmpeg_params=["-preset", "slow", "-tune", "animation"])
        for i in range(int(T_END * FPS)):
            writer.append_data(frame(lesson, i / FPS))
        writer.close()
        if not ref.exists():
            out.write_bytes(silent.read_bytes())
            return
        ms = int(STRUM_AUDIO_AT * 1000)
        subprocess.run(
            [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(silent), "-i", str(ref),
             "-filter_complex", f"[1:a]adelay={ms}|{ms},apad[a]", "-map", "0:v", "-map", "[a]",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", str(out)],
            check=True,
        )


def main(argv: List[str]) -> None:
    chords = json.loads(FINGERINGS_PATH.read_text())
    if argv:
        chords = [c for c in chords if c["chord"] in set(argv)]
    print(f"Generating {len(chords)} lesson videos...")
    for i, c in enumerate(chords, 1):
        out = LESSONS_DIR / c["chord"] / "lesson.mp4"
        out.parent.mkdir(parents=True, exist_ok=True)
        render(Lesson(c), out)
        print(f"  [{i}/{len(chords)}] {c['chord']}: {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
