import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import MicrophoneRecorder from "../MicrophoneRecorder";

const trackStop = vi.fn();
const ctxClose = vi.fn(() => Promise.resolve());
const ctxCtor = vi.fn();
let processor: { onaudioprocess: ((e: unknown) => void) | null; connect: () => void; disconnect: () => void };

class FakeAudioContext {
  sampleRate = 48000;
  state = "running";
  destination = {};
  constructor(opts?: unknown) {
    ctxCtor(opts);
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
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function startRecording(onComplete = vi.fn()) {
  const utils = render(<MicrophoneRecorder onRecordingComplete={onComplete} onLiveNotes={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /record your chord/i }));
  // 3-2-1-GO countdown
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
  }
  expect(screen.getByRole("button", { name: /stop recording/i })).toBeTruthy();
  return { ...utils, onComplete };
}

describe("MicrophoneRecorder", () => {
  it("does not force a sample rate", async () => {
    await startRecording();
    const constraints = getUserMedia.mock.calls[0][0];
    expect(constraints.audio.sampleRate).toBeUndefined();
    expect(ctxCtor).toHaveBeenCalledWith(undefined);
  });

  it("releases the mic on unmount without emitting a recording", async () => {
    const { unmount, onComplete } = await startRecording();
    unmount();
    expect(trackStop).toHaveBeenCalled();
    expect(ctxClose).toHaveBeenCalled();
    expect(processor.onaudioprocess).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    // intervals were cleared: nothing fires later
    await vi.advanceTimersByTimeAsync(2000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("encodes the WAV at the AudioContext rate and auto-stops at 6 s", async () => {
    const { onComplete } = await startRecording();
    const frame = { inputBuffer: { getChannelData: () => new Float32Array(2048) } };
    // ~6 s of silent 2048-sample frames at 48 kHz
    act(() => {
      for (let i = 0; i < 150 && onComplete.mock.calls.length === 0; i++) processor.onaudioprocess?.(frame);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    const blob: Blob = onComplete.mock.calls[0][0];
    vi.useRealTimers(); // FileReader schedules on real timers
    const buf = await new Promise<ArrayBuffer>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.readAsArrayBuffer(blob);
    });
    expect(new DataView(buf).getUint32(24, true)).toBe(48000);
    expect(trackStop).toHaveBeenCalled();
  });

  it("Space toggles recording when focus is not on a control", async () => {
    render(<MicrophoneRecorder onRecordingComplete={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByText(/get ready/i)).toBeTruthy();
  });
});
