import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import RichText from "./RichText";

describe("RichText", () => {
  it("turns AI markdown into text, without raw markers", () => {
    const { container } = render(<RichText text={"**Key & Why**\nIn **G major**, use a *capo*.\n\n- **Em7** – i\n- G – III\n1. First\n2. Second\n<script>x</script>"} />);
    const t = container.textContent ?? "";
    expect(t).not.toContain("**");
    expect(container.querySelector("strong")?.textContent).toBe("G major");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelector("script")).toBeNull(); // never raw HTML
  });
});
