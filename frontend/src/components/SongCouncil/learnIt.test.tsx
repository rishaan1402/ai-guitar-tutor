import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import EnhancedPracticeChordCard from "./EnhancedPracticeChordCard";
import PracticeChordCard from "./PracticeChordCard";

const cadd9 = { symbol: "Cadd9", available_in_app: false, chord_key: null };
const am = { symbol: "Am", available_in_app: true, chord_key: "A_minor" };

describe("song chords outside the lesson library", () => {
  it("open a built lesson instead of a dead 'not in app' badge", () => {
    render(<EnhancedPracticeChordCard chord={cadd9} score={null} onPractice={() => {}} />);
    const link = screen.getByRole("link", { name: /learn it/i });
    expect(link.getAttribute("href")).toBe("/chords/learn?c=Cadd9");
    expect(screen.queryByText(/not in app/i)).toBeNull();
  });
  it("library chords still go to the full video lesson", () => {
    render(<PracticeChordCard chord={am} score={null} onPractice={() => {}} />);
    expect(screen.getByRole("button", { name: /practice/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /learn it/i })).toBeNull();
  });
});
