import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a Mermaid diagram expert. The user describes what they want in natural language; you produce valid Mermaid source code.

Rules:
- Output ONLY a single \`\`\`mermaid ... \`\`\` code block. No prose before or after.
- Choose the simplest diagram type that fits:
  - flow / branching / decision → flowchart (graph TD or LR)
  - sequence / interaction over time → sequenceDiagram
  - database / entity relationship → erDiagram
  - state machine → stateDiagram-v2
  - class / OOP structure → classDiagram
  - timeline / chronology → timeline
  - git branching → gitGraph
  - layered architecture → flowchart with subgraphs
- Labels: 2–4 words. Edge verbs: 1–3 words.
- Prefer arrows that match real flow (--> for solid, -.-> for dashed/optional).
- If the request is ambiguous, pick the most common interpretation; don't ask.

Few-shot examples:

User: user login flow with OAuth and retry
Output:
\`\`\`mermaid
graph TD
  U[User] --> L[Login Page]
  L --> O[OAuth Provider]
  O -->|ok| D[Dashboard]
  O -->|fail| R[Retry]
  R --> O
\`\`\`

User: show three microservices calling each other through a queue
Output:
\`\`\`mermaid
graph LR
  A[API Gateway] --> B[Order Service]
  B --> Q[Message Queue]
  Q --> C[Payment Service]
  Q --> D[Inventory Service]
\`\`\`

User: how a TCP connection opens
Output:
\`\`\`mermaid
sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: SYN
  S-->>C: SYN-ACK
  C->>S: ACK
\`\`\``;

type LlmConfig =
  | {
      provider: "anthropic";
      apiKey: string;
      model: string;
    }
  | {
      provider: "openai-compatible";
      apiKey: string;
      baseUrl?: string;
      model: string;
    };

function readConfig(): LlmConfig {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5",
    };
  }

  const openaiKey = process.env.OPENAI_COMPATIBLE_API_KEY?.trim();
  if (openaiKey) {
    return {
      provider: "openai-compatible",
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() || undefined,
      model:
        process.env.OPENAI_COMPATIBLE_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  throw new Error(
    "No LLM configured. Set ANTHROPIC_API_KEY or OPENAI_COMPATIBLE_API_KEY in .env.local.",
  );
}

function extractMermaidBlock(text: string): string {
  const fenced = text.match(/```(?:mermaid)?\s*\n?([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

async function generateWithAnthropic(
  config: Extract<LlmConfig, { provider: "anthropic" }>,
  prompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content.find((entry) => entry.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }
  return extractMermaidBlock(block.text);
}

async function generateWithOpenAICompatible(
  config: Extract<LlmConfig, { provider: "openai-compatible" }>,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 2048,
  });

  const text = response.choices[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenAI-compatible returned empty content");
  return extractMermaidBlock(text);
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return new Response("Missing 'prompt' in request body", { status: 400 });
  }

  let config: LlmConfig;
  try {
    config = readConfig();
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "LLM not configured",
      { status: 500 },
    );
  }

  try {
    const mermaid =
      config.provider === "anthropic"
        ? await generateWithAnthropic(config, prompt)
        : await generateWithOpenAICompatible(config, prompt);

    return Response.json({
      mermaid,
      provider: config.provider,
      model: config.model,
    });
  } catch (err) {
    console.error("LLM generate failed:", err);
    const message =
      err instanceof Error ? err.message : "LLM generation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
