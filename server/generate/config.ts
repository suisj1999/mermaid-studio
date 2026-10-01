import {
  DEFAULT_ANTHROPIC_COMPATIBLE_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
} from "./constants";

/**
 * Resolved LLM provider configuration.
 *
 * Both `provider` branches are API-compatible third-party endpoints (not
 * Anthropic / OpenAI themselves) — naming reflects the wire protocol.
 */
export type LlmConfig =
  | {
      provider: "anthropic-compatible";
      apiKey: string;
      baseUrl?: string;
      model: string;
    }
  | {
      provider: "openai-compatible";
      apiKey: string;
      baseUrl?: string;
      model: string;
    };

/**
 * Pick the LLM configuration from environment variables.
 *
 * Prefers the Anthropic-compatible provider (any Anthropic-Messages-API
 * endpoint), falls back to OpenAI-compatible. Throws when neither key is
 * set so the route handler can surface a clear 500.
 */
export function readLlmConfig(): LlmConfig {
  const anthropicKey = process.env.ANTHROPIC_COMPATIBLE_API_KEY?.trim();
  if (anthropicKey) {
    return {
      provider: "anthropic-compatible",
      apiKey: anthropicKey,
      baseUrl: process.env.ANTHROPIC_COMPATIBLE_BASE_URL?.trim() || undefined,
      model:
        process.env.ANTHROPIC_COMPATIBLE_MODEL?.trim() ||
        DEFAULT_ANTHROPIC_COMPATIBLE_MODEL,
    };
  }

  const openaiKey = process.env.OPENAI_COMPATIBLE_API_KEY?.trim();
  if (openaiKey) {
    return {
      provider: "openai-compatible",
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() || undefined,
      model:
        process.env.OPENAI_COMPATIBLE_MODEL?.trim() ||
        DEFAULT_OPENAI_COMPATIBLE_MODEL,
    };
  }

  throw new Error(
    "No LLM configured. Set ANTHROPIC_COMPATIBLE_API_KEY or OPENAI_COMPATIBLE_API_KEY in .env.local.",
  );
}