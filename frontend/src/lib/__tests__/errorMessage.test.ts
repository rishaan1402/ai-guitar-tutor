import { describe, it, expect } from "vitest";
import { errorMessage } from "../api";

describe("errorMessage", () => {
  it("passes through string details", () => {
    expect(errorMessage({ detail: "Email already registered" }, "x")).toBe("Email already registered");
  });

  it("uses the first field error on 422", () => {
    const body = { detail: [{ loc: ["body", "password"], msg: "Value error, Password must be at least 8 characters" }] };
    expect(errorMessage(body, "x")).toBe("Password must be at least 8 characters");
  });

  it("falls back when there is no detail", () => {
    expect(errorMessage({}, "Request failed: 500")).toBe("Request failed: 500");
    expect(errorMessage({ detail: [] }, "fallback")).toBe("fallback");
  });
});
