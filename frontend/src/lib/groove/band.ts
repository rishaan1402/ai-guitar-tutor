/**
 * The backing band for Grooves, synthesised with Web Audio (no audio files):
 * drums (kick, snare, hats), bass, a soft chord pad and a plucked guide guitar,
 * through a little room reverb and a gentle compressor.
 *
 * The transport calls playEighth() a fraction of a second ahead of time with
 * exact audio-clock timestamps, so the groove stays tight.
 */
import type { GrooveStyle } from "./groove";
import { chordNotes, midiInOctave, midiToHz, type ChordNotes } from "./theory";

interface DrumHit {
  kick?: number;
  snare?: number;
  hat?: number;
}

/** Drum velocities for the 8 eighth-note slots of a bar, per style. */
const DRUMS: Record<GrooveStyle, DrumHit[]> = {
  pop: [
    { kick: 1, hat: 0.55 }, { hat: 0.3 }, { snare: 0.9, hat: 0.5 }, { hat: 0.3, kick: 0.55 },
    { kick: 0.9, hat: 0.55 }, { hat: 0.3 }, { snare: 0.9, hat: 0.5 }, { hat: 0.35 },
  ],
  rock: [
    { kick: 1, hat: 0.7 }, { hat: 0.45 }, { snare: 1, hat: 0.7 }, { hat: 0.45 },
    { kick: 0.95, hat: 0.7 }, { kick: 0.7, hat: 0.45 }, { snare: 1, hat: 0.7 }, { hat: 0.5 },
  ],
  ballad: [
    { kick: 0.85, hat: 0.3 }, {}, { hat: 0.25 }, {},
    { snare: 0.55, hat: 0.3 }, {}, { hat: 0.25 }, { kick: 0.4 },
  ],
  folk: [
    { kick: 0.75, hat: 0.4 }, { hat: 0.25 }, { snare: 0.5, hat: 0.4 }, { hat: 0.25 },
    { kick: 0.65, hat: 0.4 }, { hat: 0.25 }, { snare: 0.5, hat: 0.4 }, { hat: 0.3 },
  ],
};

/** Bass notes per slot: "R" root, "5" fifth, "8" octave. */
const BASS: Record<GrooveStyle, (string | null)[]> = {
  pop: ["R", null, null, "R", "R", null, "5", null],
  rock: ["R", "R", "R", "R", "R", "R", "R", "R"],
  ballad: ["R", null, null, null, "5", null, null, null],
  folk: ["R", null, null, null, "5", null, null, null],
};

export interface EighthOptions {
  /** Waiting for you at a chord change: drums only, softer. */
  hold?: boolean;
  /** Strum slot from the Groove's pattern ("D", "U", "."). */
  strum?: string;
  /** Full band (pad + guide guitar). Off when the phone's speaker could leak into its mic. */
  full?: boolean;
  /** First eighth of a new chord: the pad starts here, lasting `padSeconds`. */
  padSeconds?: number;
}

export class Band {
  readonly ctx: AudioContext;
  private master: GainNode;
  private reverbSend: GainNode;
  private noise: AudioBuffer;
  private strumCache = new Map<string, AudioBuffer>();
  style: GrooveStyle = "pop";

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp);
    // small warm room
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(1.8, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    verb.connect(wet).connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(verb);
    this.noise = this.whiteNoise(1);
  }

  setVolume(v: number) {
    this.master.gain.value = v;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seconds);
    const b = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  private whiteNoise(seconds: number): AudioBuffer {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /* ---------------------------------------------------------------- drums */

  kick(t: number, v: number) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    this.env(g, t, 0.95 * v, 0.003, 0.38);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.45);
  }

  snare(t: number, v: number) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    this.env(g, t, 0.55 * v, 0.002, 0.17);
    n.connect(bp).connect(g);
    g.connect(this.master);
    g.connect(this.reverbSend);
    n.start(t);
    n.stop(t + 0.25);
    const o = this.ctx.createOscillator(), og = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(og, t, 0.35 * v, 0.002, 0.08);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.12);
  }

  hat(t: number, v: number) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7200;
    const g = this.ctx.createGain();
    this.env(g, t, 0.22 * v, 0.001, 0.045);
    n.connect(hp).connect(g).connect(this.master);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.08);
  }

  click(t: number, accent: boolean) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175;
    this.env(g, t, accent ? 0.5 : 0.32, 0.001, 0.05);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.08);
  }

  /* ---------------------------------------------------------------- bass, pad, guide */

  bass(t: number, midi: number, dur: number, v = 1) {
    const f = midiToHz(midi);
    const saw = this.ctx.createOscillator(), sub = this.ctx.createOscillator();
    saw.type = "sawtooth";
    sub.type = "sine";
    saw.frequency.value = f;
    sub.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.25);
    lp.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.18 * v, t + 0.15);
    g.gain.setValueAtTime(0.18 * v, t + Math.max(0.16, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const sg = this.ctx.createGain();
    sg.gain.value = 0.6;
    saw.connect(lp).connect(g);
    sub.connect(sg).connect(g);
    g.connect(this.master);
    saw.start(t);
    sub.start(t);
    saw.stop(t + dur + 0.02);
    sub.stop(t + dur + 0.02);
  }

  pad(t: number, chord: ChordNotes, dur: number) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1300;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
    g.gain.setValueAtTime(0.06, t + Math.max(0.31, dur - 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    lp.connect(g);
    g.connect(this.master);
    g.connect(this.reverbSend);
    for (const pc of chord.pcs) {
      const m = midiInOctave(pc, 57);
      for (const det of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midiToHz(m);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.35);
      }
    }
  }

  /** A strummed chord (Karplus-Strong strings), cached per chord and direction. */
  guide(t: number, chord: ChordNotes, dir: "D" | "U") {
    const key = `${chord.symbol}:${dir}`;
    let buf = this.strumCache.get(key);
    if (!buf) {
      buf = this.renderStrum(chord, dir);
      this.strumCache.set(key, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = dir === "D" ? 0.42 : 0.28;
    src.connect(g);
    g.connect(this.master);
    g.connect(this.reverbSend);
    src.start(t);
  }

  /** One plucked note (the guide guitar playing a melody). */
  note(t: number, midi: number) {
    const key = `note:${midi}`;
    let buf = this.strumCache.get(key);
    if (!buf) {
      buf = this.renderStrum({ symbol: key, root: midi % 12, pcs: [] }, "D", [midi]);
      this.strumCache.set(key, buf);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.9;
    src.connect(g);
    g.connect(this.master);
    g.connect(this.reverbSend);
    src.start(t);
  }

  private renderStrum(chord: ChordNotes, dir: "D" | "U", only?: number[]): AudioBuffer {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 1.4);
    const out = this.ctx.createBuffer(1, len, sr);
    const d = out.getChannelData(0);
    // a guitar-like voicing: bass root, then chord tones climbing to ~E4
    const notes = only ?? [midiInOctave(chord.root, 40)];
    let m = notes[0];
    while (!only && notes.length < 6) {
      m += 1;
      if (chord.pcs.includes(m % 12) && m - notes[notes.length - 1] >= 3) notes.push(m);
      if (m > 72) break;
    }
    const order = dir === "D" ? notes : [...notes].reverse().slice(0, 4);
    order.forEach((note, k) => {
      const start = Math.floor(k * 0.011 * sr);
      const period = Math.max(2, Math.round(sr / midiToHz(note)));
      const ring = new Float32Array(period);
      let lp = 0;
      for (let i = 0; i < period; i++) {
        lp = 0.55 * (Math.random() * 2 - 1) + 0.45 * lp;
        ring[i] = lp;
      }
      let idx = 0;
      for (let i = start; i < len; i++) {
        const nx = (idx + 1) % period;
        const v = 0.995 * 0.5 * (ring[idx] + ring[nx]);
        d[i] += ring[idx] * 0.32;
        ring[idx] = v;
        idx = nx;
      }
    });
    return out;
  }

  /* ---------------------------------------------------------------- one eighth note */

  playEighth(t: number, slot: number, chordSymbol: string | null, eighth: number, o: EighthOptions = {}) {
    const hit = DRUMS[this.style][slot % 8];
    const soft = o.hold ? 0.55 : 1;
    if (hit.kick && (!o.hold || slot % 8 === 0)) this.kick(t, hit.kick * soft);
    if (hit.snare && !o.hold) this.snare(t, hit.snare);
    if (hit.hat) this.hat(t, hit.hat * soft);
    if (o.hold || !chordSymbol) return;
    const chord = chordNotes(chordSymbol);
    if (!chord) return;
    const b = BASS[this.style][slot % 8];
    if (b) {
      const root = midiInOctave(chord.root, 40);
      const midi = b === "5" ? root + 7 : b === "8" ? root + 12 : root;
      this.bass(t, midi, eighth * (this.style === "rock" ? 0.9 : 1.8));
    }
    if (o.full) {
      if (o.padSeconds) this.pad(t, chord, o.padSeconds);
      if (o.strum === "D" || o.strum === "U") this.guide(t, chord, o.strum);
    }
  }
}
