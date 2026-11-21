import { describe, expect, it } from "vitest";
import { PhraseMatcher, echoStars, OnsetDetector, startLadder, climb, ladderDone, ladderStars, scoreSolo, fretQuestion, sameNote } from "./exercises";
import { notes, pcs } from "./steps";
import { makeRound, numeralChord, voiceProgression } from "./ear";

describe("play it back", () => {
  it("matches a phrase in order, any octave, and counts wrong notes", () => {
    const m = new PhraseMatcher(notes("3:5 3:7 2:5")); // C D E
    expect(m.feed(60)).toBe("hit");
    expect(m.feed(65)).toBe("miss"); // F
    expect(m.feed(62 + 12)).toBe("hit"); // D an octave up still counts
    expect(m.feed(64)).toBe("done");
    expect(m.misses).toBe(1);
    expect(echoStars(9, 0)).toBe(3);
    expect(echoStars(9, 8)).toBeLessThan(3);
  });
});

describe("strum onsets", () => {
  const frame = (amp: number, n = 512) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = amp * Math.sin(i / 3);
    return a;
  };
  it("finds each strum once and ignores the ring and the room", () => {
    const d = new OnsetDetector();
    const hits: number[] = [];
    let t = 0;
    const step = 0.01;
    const run = (amp: number, frames: number) => {
      for (let k = 0; k < frames; k++) {
        const h = d.feed(frame(amp), t);
        if (h !== null) hits.push(+h.toFixed(2));
        t += step;
      }
    };
    run(0.002, 20); // quiet room
    run(0.3, 1); // strum
    for (let a = 0.25; a > 0.01; a *= 0.85) run(a, 1); // ring out
    run(0.003, 20);
    run(0.3, 1); // second strum
    run(0.1, 10);
    expect(hits.length).toBe(2);
  });
});

describe("speed ladder", () => {
  it("climbs 4 bpm on a good run, stays on a bad one, and scores the climb", () => {
    let l = startLadder(60, 72);
    l = climb(l, 1);
    expect(l.bpm).toBe(60);
    l = climb(l, 3);
    expect(l.bpm).toBe(64);
    expect(ladderStars(l)).toBe(1);
    l = climb(climb(climb(l, 2), 2), 3);
    expect(l.best).toBe(72);
    expect(ladderDone(l)).toBe(true);
    expect(ladderStars(l)).toBe(3);
  });
});

describe("improvise", () => {
  const amPent = pcs("A C D E G").map((t) => t.pc!);
  const at = (midis: number[], gapsAt: number[] = []) => {
    let t = 0;
    return midis.map((m, i) => ({ midi: m, time: (t += gapsAt.includes(i) ? 1.5 : 0.3) }));
  };
  it("rewards scale notes, phrases with space, and ending home", () => {
    const solo = at([57, 60, 62, 64, 67, 69, 67, 64, 62, 60, 62, 64, 60, 57], [5, 10]);
    const s = scoreSolo(solo, amPent, 9);
    expect(s.inScale).toBe(1);
    expect(s.phrases).toBe(3);
    expect(s.endsHome).toBe(true);
    expect(s.stars).toBe(3);
  });
  it("one long run of wrong notes scores low", () => {
    const s = scoreSolo(at([61, 63, 66, 68, 70, 61, 63, 66, 68, 70, 61, 63]), amPent, 9);
    expect(s.inScale).toBe(0);
    expect(s.stars).toBe(0);
  });
});

describe("fretboard game", () => {
  it("asks for real notes and accepts either name", () => {
    let last = null;
    for (let k = 0; k < 50; k++) {
      const q = fretQuestion([6, 5], [0, 12], last);
      expect(q.answer).toBe(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][({ 6: 40, 5: 45 } as Record<number, number>)[q.string] % 12 === 4 ? (4 + q.fret) % 12 : (9 + q.fret) % 12]);
      expect(last && last.string === q.string && last.fret === q.fret).toBeFalsy();
      last = q;
    }
    expect(sameNote("A#", "Bb")).toBe(true);
    expect(sameNote("A", "Bb")).toBe(false);
  });
});

describe("progression ear", () => {
  it("reads Roman numerals and voices progressions in any key", () => {
    expect(numeralChord("vi")).toEqual({ root: 9, tones: [0, 3, 7] });
    expect(numeralChord("bVII")).toEqual({ root: 10, tones: [0, 4, 7] });
    expect(numeralChord("V7")!.tones).toEqual([0, 4, 7, 10]);
    const c = voiceProgression("I–V–vi–IV", 0)!; // C G Am F
    expect(c.map((ch) => ch[0] % 12)).toEqual([0, 7, 9, 5]);
    const r = makeRound("progression", ["I–IV–V–I"], () => 0.2);
    expect(r.chords).toHaveLength(4);
  });
});
