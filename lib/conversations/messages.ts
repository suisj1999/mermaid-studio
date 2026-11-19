import type { LlmMessage } from "./types";

/**
 * How many earlier user prompts are replayed to the model.
 *
 * The transcript grows with every turn, but the model only needs enough
 * context to know what the current diagram is and what was already asked
 * for. Older turns are dropped rather than sent.
 */
export const MAX_HISTORY_TURNS = 10;

/**
 * Collapse consecutive same-role turns into one.
 *
 * The Anthropic Messages API expects alternating user and assistant turns;
 * consecutive same-role messages are rejected or silently combined,
 * depending on the endpoint. Merging them here means both providers see
 * byte-identical history and the sequence always starts with a user turn
 * and ends with one.
 */
export function normalizeLlmMessages(messages: LlmMessage[]): LlmMessage[] {
  const merged: LlmMessage[] = [];

  for (const message of messages) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`;
    } else {
      merged.push({ role: message.role, content: message.content });
    }
  }

  // A conversation cannot start with an assistant turn.
  while (merged.length > 0 && merged[0].role === "assistant") {
    merged.shift();
  }

  return merged;
}

/** Wrap Mermaid source in a fenced block so the model reads it as code. */
function fenceDiagram(source: string): string {
  return `\`\`\`mermaid\n${source.trim()}\n\`\`\``;
}

/**
 * Build the history that precedes a new user prompt.
 *
 * With earlier prompts present, the current diagram is carried by an
 * assistant turn — the model then reads the exchange as "here is what I
 * produced, now change it". Without any earlier prompt the diagram was
 * written by hand, so it is presented as a user turn instead; there is no
 * assistant turn to attach it to.
 */
export function buildLlmHistory(
  prompts: string[],
  currentSource: string,
): LlmMessage[] {
  const messages: LlmMessage[] = prompts
    .slice(-MAX_HISTORY_TURNS)
    .map((prompt) => ({ role: "user" as const, content: prompt }));

  const source = currentSource.trim();
  if (!source) return messages;

  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: `This is the diagram I have so far:\n${fenceDiagram(source)}`,
    });
  } else {
    messages.push({ role: "assistant", content: fenceDiagram(source) });
  }

  return messages;
}
