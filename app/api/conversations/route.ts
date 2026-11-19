import type { NextRequest } from "next/server";

import { defaultOwnerId } from "~/server/config/settings";
import { createConversation } from "~/server/db/conversations";
import { checkRateLimit, clientKey } from "~/server/rate-limit";

export const runtime = "nodejs";

/**
 * Ceiling on a stored Mermaid source. Far above any real diagram, but
 * bounded so an unauthenticated client cannot fill the disk.
 */
const MAX_SOURCE_LENGTH = 200_000;

/**
 * POST /api/conversations
 *
 * Body: `{ title?: string, source?: string }`
 * 200: `{ conversation: ConversationSnapshot }`
 * 400: invalid JSON or an over-long field
 * 429: too many requests from this client
 *
 * Creates an empty conversation. The editor calls this when the user has
 * edited something before any chat message existed, so there is no
 * conversation to save into yet.
 */
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`conversations:create:${clientKey(req.headers)}`);
  if (!limit.ok) {
    return new Response("Too many requests. Please try again shortly.", {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  let body: { title?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const title = body.title ?? "";
  const source = body.source ?? "";

  if (title.length > 200 || source.length > MAX_SOURCE_LENGTH) {
    return new Response("Title or source is too long", { status: 400 });
  }

  const conversation = createConversation(defaultOwnerId(), { title, source });
  return Response.json({ conversation });
}
