import { describe, it, expect } from "vitest";
import {
  AutoStopDetector,
  dbfsToLevel,
  encodeWav,
  encodeWavBuffer,
  levelHint,
  mergeChunks,
  sameNotes,
  toDbfs,
} from "../audioCapture";

function header(buf: ArrayBuffer) {
  const v = new DataView(buf);
  const str = (o: number, n: number) => String.fromCharCode.apply(null, Array.from(new Uint8Array(buf, o, n)));
  return {
    riff: str(0, 4),
    wave: str(8, 4),
    channels: v.getUint16(22, true),
    sampleRate: v.getUint32(24, true),
    byteRate: v.getUint32(28, true),
    bits: v.getUint16(34, true),
    dataBytes: v.getUint32(40, true),
  };
}

describe("encodeWav", () => {
  it("writes the capture rate into the header (48 kHz in → 48 kHz out)", () => {
    const h = header(encodeWavBuffer(new Float32Array(4800), 48000));
    expect(h.riff).toBe("RIFF");
    expect(h.wave).toBe("WAVE");
    expect(h.sampleRate).toBe(48000);
    expect(h.byteRate).toBe(96000);
    expect(h.channels).toBe(1);
    expect(h.bits).toBe(16);
    expect(h.dataBytes).toBe(9600);
  });

  it("honours other device rates such as 44.1 kHz", () => {
    expect(header(encodeWavBuffer(new Float32Array(10), 44100)).sampleRate).toBe(44100);
  });

  it("clips samples to 16-bit range", () => {
    const v = new DataView(encodeWavBuffer(new Float32Array([2, -2, 0]), 8000));
    expect(v.getInt16(44, true)).toBe(0x7fff);
    expect(v.getInt16(46, true)).toBe(-0x8000);
    expect(v.getInt16(48, true)).toBe(0);
  });

  it("returns an audio/wav blob of the right size", () => {
    const b = encodeWav(new Float32Array(100), 48000);
    expect(b.type).toBe("audio/wav");
    expect(b.size).toBe(44 + 200);
  });
});

describe("mergeChunks", () => {
  it("concatenates in order", () => {
    expect(Array.from(mergeChunks([new Float32Array([1, 2]), new Float32Array([3])]))).toEqual([1, 2, 3]);
  });
});

describe("level maths", () => {
  it("maps dBFS −60..0 onto 0..1", () => {
    expect(toDbfs(1)).toBe(0);
    expect(toDbfs(0)).toBe(-60);
    expect(toDbfs(0.1)).toBeCloseTo(-20, 5);
    expect(dbfsToLevel(-60)).toBe(0);
    expect(dbfsToLevel(-30)).toBeCloseTo(0.5);
    expect(dbfsToLevel(0)).toBe(1);
  });

  it("a normal guitar level no longer saturates the meter", () => {
    // −32 dBFS RMS pinned the old `rms*40` meter at 100%
    expect(dbfsToLevel(toDbfs(0.025))).toBeLessThan(0.5);
  });

  it("hints too quiet / clipping", () => {
    expect(levelHint(-50, 2)).toBe("too_quiet");
    expect(levelHint(-50, 0.5)).toBeNull(); // give the player a moment
    expect(levelHint(-0.5, 0.2)).toBe("clipping");
    expect(levelHint(-12, 2)).toBeNull();
  });
});

describe("AutoStopDetector", () => {
  const frame = 0.05;
  it("stops 1.2 s after the strum decays below 15% of peak", () => {
    const d = new AutoStopDetector();
    let t = 0;
    let stoppedAt: number | null = null;
    const feed = (rms: number, seconds: number) => {
      for (let i = 0; i < seconds / frame && stoppedAt === null; i++) {
        t += frame;
        if (d.update(rms, t)) stoppedAt = t;
      }
    };
    feed(0.001, 0.5); // silence before the strum
    feed(0.2, 0.5); // strum
    feed(0.1, 0.5); // ringing (50% of peak)
    const quietFrom = t;
    feed(0.01, 3); // decayed (5% of peak)
    expect(stoppedAt).not.toBeNull();
    expect(stoppedAt! - quietFrom).toBeGreaterThanOrEqual(1.2 - 1e-9);
    expect(stoppedAt! - quietFrom).toBeLessThan(1.4);
  });

  it("silence alone runs to the 6 s cap", () => {
    const d = new AutoStopDetector();
    let t = 0;
    while (!d.update(0.0005, (t += frame))) {
      if (t > 10) break;
    }
    expect(t).toBeGreaterThanOrEqual(6 - 1e-9);
    expect(t).toBeLessThan(6.1);
  });
});

describe("sameNotes", () => {
  it("ignores order", () => {
    expect(sameNotes(["C", "E", "G"], ["G", "C", "E"])).toBe(true);
    expect(sameNotes(["C"], ["C", "E"])).toBe(false);
  });
});
