import { sanitizeTitle } from "~/lib/conversations/title";

import { extractTaggedSection } from "./format";
import { callLlm } from "./llm";

/**
 * Instruction for the title model. It is deliberately terse and carries no
 * diagram knowledge: the title call runs alongside the diagram call and
 * must be cheap.
 */
export const TITLE_SYSTEM_PROMPT = `You name diagrams. Reply with exactly one line in this format and nothing else:
<title>A concise descriptive title</title>

Rules:
- At most ${60} characters.
- No quotes, no surrounding punctuation, no trailing period.
- No newline, no explanation, no emoji.
- Use the same language as the user's request.`;

/**
 * Token budget for the title call.
 *
 * Reasoning models spend part of their budget on hidden thinking before
 * writing anything, so a tight ceiling can consume the whole allowance and
 * leave no text block at all. 512 leaves room for the title itself plus a
 * short chain of thought, and still costs a fraction of the diagram call.
 */
const TITLE_MAX_TOKENS = 512;

/**
 * Ask the model for a short title for a diagram request.
 *
 * Returns an empty string when the model's answer cannot be salvaged, so
 * the caller can fall back to a title derived from the prompt.
 */
export async function generateTitle(userPrompt: string): Promise<string> {
  const response = await callLlm({
    system: TITLE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: TITLE_MAX_TOKENS,
    temperature: 0.3,
  });

  return sanitizeTitle(extractTaggedSection(response.text, "title"));
}
