import { describe, it, expect } from "vitest";
import { ApiError, submitErrorMessage } from "../api";

describe("submitErrorMessage", () => {
  it("explains the 2 MB cap on 413", () => {
    expect(submitErrorMessage(new ApiError("Request failed: 413", 413))).toMatch(/too large.*2 MB/);
  });
  it("passes through the server's 422 detail", () => {
    expect(submitErrorMessage(new ApiError("Unsupported audio format. Please record a WAV.", 422))).toBe(
      "Unsupported audio format. Please record a WAV.",
    );
  });
  it("falls back to friendly copy for a bare 422", () => {
    expect(submitErrorMessage(new ApiError("Request failed: 422", 422))).toMatch(/couldn't read that audio/);
  });
});
