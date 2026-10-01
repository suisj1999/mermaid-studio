import type { NextRequest } from "next/server";
import { generateMermaidDiagram } from "~/server/generate/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate
 *
 * Body: `{ prompt: string }`
 * 200: `{ mermaid: string, provider: string, model: string }`
 * 400: invalid JSON or empty prompt
 * 502: provider error or no LLM configured
 *
 * The route is intentionally thin — provider selection, prompt assembly,
 * and response extraction all live in `~/server/generate/`.
 */
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

  try {
    const result = await generateMermaidDiagram(prompt);
    return Response.json(result);
  } catch (err) {
    console.error("LLM generate failed:", err);
    const message =
      err instanceof Error ? err.message : "LLM generation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}