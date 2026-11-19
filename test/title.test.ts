import { describe, expect, test } from "bun:test";
import {
  deriveFallbackTitle,
  MAX_TITLE_LENGTH,
  sanitizeTitle,
} from "../lib/conversations/title";

describe("sanitizeTitle", () => {
  test("keeps a clean title untouched", () => {
    expect(sanitizeTitle("Login flow")).toBe("Login flow");
  });

  test("strips the model's <title> tag", () => {
    expect(sanitizeTitle("<title>Login flow</title>")).toBe("Login flow");
  });

  test("strips surrounding quotes and backticks", () => {
    expect(sanitizeTitle('"Login flow"')).toBe("Login flow");
    expect(sanitizeTitle("`Login flow`")).toBe("Login flow");
  });

  test("drops a trailing period", () => {
    expect(sanitizeTitle("Login flow.")).toBe("Login flow");
  });

  test("collapses internal whitespace on the first line", () => {
    expect(sanitizeTitle("Login    flow")).toBe("Login flow");
  });

  test("uses only the first non-empty line", () => {
    expect(sanitizeTitle("\n\nLogin flow\nHere is why")).toBe("Login flow");
  });

  test("returns an empty string when nothing survives", () => {
    expect(sanitizeTitle("")).toBe("");
    expect(sanitizeTitle("   \n  ")).toBe("");
    expect(sanitizeTitle("***")).toBe("");
  });

  test("truncates long titles with an ellipsis", () => {
    const title = sanitizeTitle("a".repeat(120));
    expect(title.length).toBe(MAX_TITLE_LENGTH);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("deriveFallbackTitle", () => {
  test("uses the prompt when it is short", () => {
    expect(deriveFallbackTitle("user login flow")).toBe("user login flow");
  });

  test("collapses whitespace", () => {
    expect(deriveFallbackTitle("user  login\n flow")).toBe("user login flow");
  });

  test("truncates long prompts with an ellipsis", () => {
    const title = deriveFallbackTitle("b".repeat(100));
    expect(title.length).toBe(40);
    expect(title.endsWith("…")).toBe(true);
  });

  test("returns an empty string for an empty prompt", () => {
    expect(deriveFallbackTitle("   ")).toBe("");
  });
});
