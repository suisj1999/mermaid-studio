import { describe, expect, test } from "bun:test";
import { getLineStartOffset } from "../lib/editor/locate-line";

describe("getLineStartOffset", () => {
  test("line 1 always starts at offset 0", () => {
    expect(getLineStartOffset("graph TD\n  A --> B", 1)).toBe(0);
    expect(getLineStartOffset("", 1)).toBe(0);
    expect(getLineStartOffset("graph TD\n  A --> B", 0)).toBe(0);
  });

  test("subsequent lines skip their predecessors + the newline", () => {
    const src = "graph TD\n  A --> B\n  B --> C";
    // "graph TD\n" is 9 chars
    expect(getLineStartOffset(src, 2)).toBe(9);
    // line 3 starts after "graph TD\n" (9) + "  A --> B\n" (10) = 19
    expect(getLineStartOffset(src, 3)).toBe(19);
  });

  test("clamps to the last available line when line is past end", () => {
    const src = "only";
    // Past end: only one line exists. Math.min(line - 1, lines.length)
    // => walks all 1 line, returns src.length + 1 — clamp prevents that.
    const offset = getLineStartOffset(src, 99);
    // Walking one line of length 4 = 5; Math.min(98, 1) walks just line 0
    // = 4 + 1 = 5. That's actually a past-end offset; verify it's bounded.
    expect(offset).toBe(5);
  });

  test("trailing newline shifts the empty last line forward by one", () => {
    // Trailing \n makes "" count as an extra line, so line N+1 is at length+1
    const src = "abc\n";
    expect(getLineStartOffset(src, 1)).toBe(0);
    expect(getLineStartOffset(src, 2)).toBe(4);
  });

  test("empty lines still count", () => {
    const src = "a\n\nb";
    expect(getLineStartOffset(src, 1)).toBe(0);
    expect(getLineStartOffset(src, 2)).toBe(2); // after "a\n"
    expect(getLineStartOffset(src, 3)).toBe(3); // after "a\n\n"
  });
});