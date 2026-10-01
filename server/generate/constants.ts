export const DEFAULT_ANTHROPIC_COMPATIBLE_MODEL = "claude-haiku-4-5";
export const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini";


export const MAX_OUTPUT_TOKENS = 8000;

// Single-shot today. Bumping this would require server-side Mermaid parsing
// to give the model structured feedback on a failed attempt.
export const MAX_GENERATE_ATTEMPTS = 1;

// Matches the route handler's maxDuration. Surfaced here so the pipeline can
// layer in per-attempt budgets later without touching the route file.
export const GENERATION_TIMEOUT_MS = 60_000;