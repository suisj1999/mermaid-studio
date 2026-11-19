import type { NextRequest } from "next/server";

import { buildLlmHistory } from "~/lib/conversations/messages";
import { deriveFallbackTitle } from "~/lib/conversations/title";
import { defaultOwnerId } from "~/server/config/settings";
import {
  appendMessage,
  createConversation,
  getConversationSnapshot,
  listMessages,
  setGeneratedTitle,
  updateConversation,
} from "~/server/db/conversations";
import { generateMermaidDiagram } from "~/server/generate/generate";
import { generateTitle } from "~/server/generate/title";
import { checkRateLimit, clientKey } from "~/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/chat
 *
 * Body: `{ conversationId?: string, prompt: string }`
 * 200: `{ conversationId, mermaid, title, titleEdited, messages, provider, model }`
 * 400: invalid JSON or empty prompt
 * 404: unknown conversation id
 * 429: too many requests from this client
 * 502: provider error or no LLM configured
 *
 * The conversation is created on the first message. The title is generated
 * alongside the diagram — both requests are in flight before either is
 * awaited — but a failing title never fails the diagram.
 */
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`chat:${clientKey(req.headers)}`);
  if (!limit.ok) {
    return new Response("Too many requests. Please try again shortly.", {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  let body: { conversationId?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return new Response("Missing 'prompt' in request body", { status: 400 });
  }

  const owner = defaultOwnerId();

  let existing = null;
  if (body.conversationId) {
    existing = getConversationSnapshot(body.conversationId, owner);
    if (!existing) {
      return new Response("Unknown conversation", { status: 404 });
    }
  }

  const previousPrompts = (existing?.messages ?? [])
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  const history = buildLlmHistory(previousPrompts, existing?.source ?? "");

  const needsTitle = !existing?.title && !existing?.titleEdited;

  // Both calls are started before either is awaited, so the title is
  // produced in parallel with the diagram rather than after it.
  const titlePromise = needsTitle ? generateTitle(prompt) : Promise.resolve(null);
  const diagramPromise = generateMermaidDiagram(prompt, history);

  const [diagram, title] = await Promise.allSettled([diagramPromise, titlePromise]);

  if (diagram.status === "rejected") {
    console.error("LLM generate failed:", diagram.reason);
    const message =
      diagram.reason instanceof Error ? diagram.reason.message : "LLM generation failed";
    return Response.json({ error: message }, { status: 502 });
  }

  if (title.status === "rejected") {
    console.error("Title generation failed:", title.reason);
  }

  // The conversation is created only now, so a failed generation never
  // leaves an empty row behind.
  const conversation =
    existing ??
    createConversation(owner, { source: diagram.value.mermaid });

  if (existing) {
    updateConversation(conversation.id, owner, { source: diagram.value.mermaid });
  }

  if (needsTitle) {
    const generated =
      title.status === "fulfilled" && title.value
        ? title.value
        : deriveFallbackTitle(prompt);
    setGeneratedTitle(conversation.id, generated);
  }

  appendMessage(conversation.id, "user", prompt);
  appendMessage(conversation.id, "assistant", "Diagram updated.");

  const snapshot = getConversationSnapshot(conversation.id, owner);

  return Response.json({
    conversationId: conversation.id,
    mermaid: diagram.value.mermaid,
    title: snapshot?.title ?? "",
    titleEdited: snapshot?.titleEdited ?? false,
    messages: listMessages(conversation.id),
    provider: diagram.value.provider,
    model: diagram.value.model,
  });
}
