import { describe, expect, test } from "bun:test";
import {
  buildLlmHistory,
  MAX_HISTORY_TURNS,
  normalizeLlmMessages,
} from "../lib/conversations/messages";

describe("normalizeLlmMessages", () => {
  test("keeps an alternating conversation untouched", () => {
    const messages = normalizeLlmMessages([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "user", content: "three" },
    ]);
    expect(messages).toHaveLength(3);
    expect(messages[1].content).toBe("two");
  });

  test("merges consecutive same-role turns", () => {
    const messages = normalizeLlmMessages([
      { role: "user", content: "one" },
      { role: "user", content: "two" },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("one\n\ntwo");
  });

  test("drops a leading assistant turn", () => {
    const messages = normalizeLlmMessages([
      { role: "assistant", content: "leading" },
      { role: "user", content: "one" },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });

  test("never mutates the input", () => {
    const input = [
      { role: "user" as const, content: "one" },
      { role: "user" as const, content: "two" },
    ];
    normalizeLlmMessages(input);
    expect(input[0].content).toBe("one");
  });
});

describe("buildLlmHistory", () => {
  test("is empty when there is no prompt and no source", () => {
    expect(buildLlmHistory([], "")).toHaveLength(0);
  });

  test("carries the diagram in an assistant turn once there are prompts", () => {
    const history = buildLlmHistory(["draw a login flow"], "graph TD\n A-->B");
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toContain("```mermaid");
    expect(history[1].content).toContain("A-->B");
  });

  test("presents a hand-written diagram as a user turn", () => {
    const history = buildLlmHistory([], "graph TD\n A-->B");
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toContain("```mermaid");
  });

  test("keeps only the most recent turns", () => {
    const prompts = Array.from(
      { length: MAX_HISTORY_TURNS + 5 },
      (_, index) => `prompt ${index}`,
    );
    const history = buildLlmHistory(prompts, "");
    expect(history).toHaveLength(MAX_HISTORY_TURNS);
    expect(history[0].content).toBe(
      `prompt ${prompts.length - MAX_HISTORY_TURNS}`,
    );
  });

  test("produces a history the providers accept after normalisation", () => {
    const history = buildLlmHistory(["one", "two"], "graph TD\n A-->B");
    const normalized = normalizeLlmMessages([
      ...history,
      { role: "user", content: "make it blue" },
    ]);
    expect(normalized[0].role).toBe("user");
    expect(normalized[normalized.length - 1].role).toBe("user");
  });
});
