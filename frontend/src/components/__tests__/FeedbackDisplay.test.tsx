import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import FeedbackDisplay, { type Evaluation } from "../FeedbackDisplay";
import type { ChordFingering } from "@/lib/api";

const C_MAJOR: ChordFingering = {
  chord: "C_major",
  display_name: "C",
  root: "C",
  quality: "major",
  notes: ["C", "E", "G"],
  positions: [
    { string: 6, action: "mute" },
    { string: 5, fret: 3, note: "C", finger: 3 },
    { string: 4, fret: 2, note: "E", finger: 2 },
    { string: 3, fret: 0, note: "G" },
    { string: 2, fret: 1, note: "C", finger: 1 },
    { string: 1, fret: 0, note: "E" },
  ],
};

const base: Evaluation = {
  score: 0.99,
  detected_notes: ["C", "G"],
  expected_notes: ["C", "E", "G"],
  missing_notes: [],
  extra_notes: [],
  issue: "unclear",
  unclear_notes: ["E"],
};

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  window.matchMedia =
    window.matchMedia ||
    ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(cleanup);

function scoreRings(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[role="img"]')).filter((el) =>
    (el.getAttribute("aria-label") || "").startsWith("Score"),
  );
}

describe("FeedbackDisplay verdict mapping", () => {
  it("unclear → neutral 'Strum again' card: no score ring, no Missing list, no red", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <FeedbackDisplay
        feedback="I couldn't hear every string clearly — listen for the E and strum once more."
        evaluation={base}
        verdict="unclear"
        attempt={2}
        sessionState="FEEDBACK"
        fingering={C_MAJOR}
        fingeringTips={[{ note: "E", string: 4, fret: 2, tip: "Press harder" }]}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("button", { name: "Strum again" })).toBeTruthy();
    expect(screen.getAllByText(/doesn't count/i).length).toBeGreaterThan(0);
    expect(screen.getByText("E")).toBeTruthy(); // "Listen for: E" chip
    expect(scoreRings(container)).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Missing/);
    expect(container.textContent).not.toMatch(/Fingering Tips/i);
    expect(container.innerHTML).not.toMatch(/text-red-|#ef4444|239,\s*68,\s*68/);
    fireEvent.keyDown(document.body, { key: " " });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("unclear chips split borderline chord tones from strays", () => {
    render(
      <FeedbackDisplay feedback="x" evaluation={{ ...base, unclear_notes: ["E", "F#"] }} verdict="unclear" attempt={1} sessionState="FEEDBACK" />,
    );
    expect(screen.getByText(/Listen for/)).toBeTruthy();
    expect(screen.getByText(/Maybe a stray/)).toBeTruthy();
  });

  it("no_sound → mic-check card with the same neutral shell", () => {
    const { container } = render(
      <FeedbackDisplay
        feedback="No sound detected"
        evaluation={{ ...base, issue: "no_sound", score: 0, unclear_notes: [] }}
        attempt={1}
        sessionState="FEEDBACK"
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("neutral-take").getAttribute("data-kind")).toBe("mic_check");
    expect(scoreRings(container)).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Missing/);
  });

  it("shows the nudge after three takes in a row we couldn't grade", () => {
    render(
      <FeedbackDisplay feedback="x" evaluation={base} verdict="unclear" attempt={3} sessionState="FEEDBACK" unclearStreak={3} />,
    );
    expect(screen.getByTestId("unclear-nudge").textContent).toMatch(/Still having trouble hearing you/);
  });

  it("a graded fail still shows the score ring and the Missing list", () => {
    const { container } = render(
      <FeedbackDisplay
        feedback="Almost — the E is missing."
        evaluation={{ ...base, issue: "missing_note", score: 0.67, missing_notes: ["E"], unclear_notes: [] }}
        verdict="fail"
        attempt={1}
        sessionState="FEEDBACK"
        scoreHistory={[{ attempt: 1, score: 0.67 }]}
      />,
    );
    expect(scoreRings(container)).toHaveLength(1);
    expect(container.textContent).toMatch(/Missing/);
  });

  it("wrong chord: names target, no Missing list", () => {
    const { container } = render(
      <FeedbackDisplay
        feedback="That sounded like G major, not C major."
        evaluation={{ ...base, issue: "wrong_chord", score: 0.33, missing_notes: ["C", "E"], sounds_like: "G", sounds_like_key: "G_major", unclear_notes: [] }}
        verdict="fail"
        chordName="C_major"
        attempt={1}
        sessionState="FEEDBACK"
        scoreHistory={[{ attempt: 1, score: 0.33 }]}
      />,
    );
    expect(screen.getByTestId("wrong-chord").textContent).toMatch(/Heard: G major · Target: C major/);
    expect(container.textContent).not.toMatch(/Missing/);
  });
});
