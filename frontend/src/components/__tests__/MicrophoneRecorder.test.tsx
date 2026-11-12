import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import MicrophoneRecorder from "../MicrophoneRecorder";

const trackStop = vi.fn();
const ctxClose = vi.fn(() => Promise.resolve());
const ctxCtor = vi.fn();
let processor: { onaudioprocess: ((e: unknown) => void) | null; connect: () => void; disconnect: () => void };

const order: string[] = [];

class FakeAudioContext {
  sampleRate = 48000;
  state = "running";
  destination = {};
  constructor(opts?: unknown) {
    ctxCtor(opts);
    order.push("context");
  }
  resume() {
    return Promise.resolve();
  }
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createScriptProcessor() {
    processor = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
    return processor;
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      getFloatFrequencyData: (a: Float32Array) => a.fill(-100),
    };
  }
  close() {
    this.state = "closed";
    return ctxClose();
  }
}

const getUserMedia = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no 2D canvas; the meter just skips drawing.
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  trackStop.mockClear();
  ctxClose.mockClear();
  ctxCtor.mockClear();
  getUserMedia.mockReset();
  order.length = 0;
  getUserMedia.mockImplementation(async () => {
    order.push("stream");
    return { getTracks: () => [{ stop: trackStop }] };
  });
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const FRAME = 2048;
const frameOf = (v: number) => ({ inputBuffer: { getChannelData: () => new Float32Array(FRAME).fill(v) } });
/** Alternating ±v square wave: rms = peak = v. */
const toneFrame = (v: number) => ({
  inputBuffer: { getChannelData: () => Float32Array.from({ length: FRAME }, (_, i) => (i % 2 ? v : -v)) },
});
function feed(frame: ReturnType<typeof frameOf>, n: number) {
  act(() => {
    for (let i = 0; i < n; i++) processor.onaudioprocess?.(frame);
  });
}

async function arm(onComplete = vi.fn(), extra: Record<string, unknown> = {}) {
  const utils = render(<MicrophoneRecorder onRecordingComplete={onComplete} onLiveNotes={vi.fn()} {...extra} />);
  fireEvent.click(screen.getByRole("button", { name: /record your chord/i }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  // No countdown: the mic is open and we're listening right away.
  expect(screen.getByRole("button", { name: /listening for your strum/i })).toBeTruthy();
  return { ...utils, onComplete };
}

async function readBlob(blob: Blob) {
  vi.useRealTimers(); // FileReader schedules on real timers
  return new Promise<ArrayBuffer>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.readAsArrayBuffer(blob);
  });
}

describe("MicrophoneRecorder", () => {
  it("opens the context then the mic on press, with no forced sample rate", async () => {
    await arm();
    expect(order).toEqual(["context", "stream"]);
    const constraints = getUserMedia.mock.calls[0][0];
    expect(constraints.audio.sampleRate).toBeUndefined();
    expect(ctxCtor).toHaveBeenCalledWith(undefined);
  });

  it("releases the mic on unmount without emitting a recording", async () => {
    const { unmount, onComplete } = await arm();
    unmount();
    expect(trackStop).toHaveBeenCalled();
    expect(ctxClose).toHaveBeenCalled();
    expect(processor.onaudioprocess).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("silence: gives up after 8 s armed, uploads nothing, shows the mic check", async () => {
    const onSilentTake = vi.fn();
    const { onComplete } = await arm(vi.fn(), { onSilentTake });
    feed(frameOf(0.0005), Math.ceil((8 * 48000) / FRAME) + 2);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onSilentTake).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mic-check").textContent).toMatch(/couldn't hear the guitar/i);
    expect(trackStop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /record your chord/i })).toBeTruthy();
  });

  it("click, then strum: records from the onset (pre-roll 250 ms), drops the click, stops on decay", async () => {
    const { onComplete } = await arm();
    feed(frameOf(0.0008), 3);
    feed(toneFrame(0.3), 1); // the Space-bar click: one loud frame
    feed(frameOf(0.0008), 30); // ~1.3 s of room noise
    expect(screen.getByRole("button", { name: /listening/i })).toBeTruthy();
    feed(toneFrame(0.2), 6); // strum
    expect(screen.getByRole("button", { name: /stop recording/i })).toBeTruthy();
    feed(toneFrame(0.1), 6); // ringing
    feed(frameOf(0.0008), 40); // decayed → auto-stop after 1.2 s
    expect(onComplete).toHaveBeenCalledTimes(1);
    const buf = await readBlob(onComplete.mock.calls[0][0]);
    const view = new DataView(buf);
    expect(view.getUint32(24, true)).toBe(48000);
    const samples = (buf.byteLength - 44) / 2;
    // pre-roll (6 frames) + strum + ring + 1.2 s hold — not the 1.3 s of silence before
    expect(samples / 48000).toBeLessThan(0.25 + 0.6 + 1.4);
    expect(samples / 48000).toBeGreaterThan(1.2);
    // the click (frame 4) is not in the WAV: the first samples are quiet
    const first = Math.abs(view.getInt16(44, true)) / 0x7fff;
    expect(first).toBeLessThan(0.01);
  });

  it("caps a take at 6 s from the onset", async () => {
    const { onComplete } = await arm();
    feed(toneFrame(0.1), Math.ceil((6.5 * 48000) / FRAME) + 20);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("Esc cancels while armed: nothing uploaded, mic released, no mic-check", async () => {
    const { onComplete } = await arm();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(trackStop).toHaveBeenCalled();
    feed(toneFrame(0.2), 10);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mic-check")).toBeNull();
    expect(screen.getByRole("button", { name: /record your chord/i })).toBeTruthy();
  });

  it("Space arms when focus is not on a control", async () => {
    render(<MicrophoneRecorder onRecordingComplete={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: " " });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/strum when ready/i)).toBeTruthy();
  });

  it("hands a dedicated 8192-point analyser to the stage and takes it back", async () => {
    const onAnalyser = vi.fn();
    await arm(vi.fn(), { onAnalyser });
    expect(onAnalyser).toHaveBeenCalledTimes(1);
    expect(onAnalyser.mock.calls[0][0].fftSize).toBe(8192);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onAnalyser).toHaveBeenLastCalledWith(null);
  });
});
