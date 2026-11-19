import type { LlmMessage } from "~/lib/conversations/types";
import { normalizeLlmMessages } from "~/lib/conversations/messages";

import type { LlmConfig } from "./config";
import { callLlm } from "./llm";
import { SYSTEM_PROMPT } from "./prompts";

/**
 * Output of `generateMermaidDiagram`: the raw Mermaid source plus the
 * provider/model identifiers that produced it (surfaced in the UI status
 * pill so the user knows what model they got).
 */
export interface GenerateResult {
  mermaid: string;
  provider: LlmConfig["provider"];
  model: string;
}

/**
 * Orchestrator: replay the conversation so far, append the new request,
 * call the configured provider, and extract the Mermaid code block from the
 * response.
 *
 * `history` holds the earlier turns of the conversation. When it is empty
 * the call is a plain one-shot request, which is what the legacy
 * `/api/generate` endpoint does.
 *
 * Throws when no provider is configured or when the response contains no
 * text content — the route handler translates these into HTTP errors.
 */
export async function generateMermaidDiagram(
  userPrompt: string,
  history: LlmMessage[] = [],
): Promise<GenerateResult> {
  const messages = normalizeLlmMessages([
    ...history,
    { role: "user", content: userPrompt },
  ]);

  const response = await callLlm({ system: SYSTEM_PROMPT, messages });

  return {
    mermaid: extractMermaidBlock(response.text),
    provider: response.provider,
    model: response.model,
  };
}

function extractMermaidBlock(text: string): string {
  const fenced = text.match(/```(?:mermaid)?\s*\n?([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.trim();
}
