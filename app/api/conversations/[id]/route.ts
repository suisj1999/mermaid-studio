import type { NextRequest } from "next/server";

import { defaultOwnerId } from "~/server/config/settings";
import { deleteConversation, updateConversation } from "~/server/db/conversations";
import { checkRateLimit, clientKey } from "~/server/rate-limit";

export const runtime = "nodejs";

/** Ceiling on a stored Mermaid source, matching the create route. */
const MAX_SOURCE_LENGTH = 200_000;

/**
 * Auto-save fires on every edit, so it needs a far higher ceiling than the
 * paid generation endpoint. At the default two-second interval this allows
 * sustained typing with room to spare.
 */
const AUTOSAVE_MAX_REQUESTS = 120;

/** Deletions are rare but destructive. */
const DELETE_MAX_REQUESTS = 30;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/conversations/[id]
 *
 * Body: `{ title?: string, source?: string }`
 * 200: `{ conversation: ConversationSnapshot }`
 * 400: invalid JSON or an over-long field
 * 404: unknown conversation
 *
 * Backs the editor's auto-save. Writing a title marks it as human-edited,
 * which stops the server from ever replacing it with a generated one.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const limit = checkRateLimit(
    `conversations:autosave:${clientKey(req.headers)}`,
    AUTOSAVE_MAX_REQUESTS,
  );
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

  const patch: { title?: string; source?: string } = {};
  if (typeof body.title === "string") {
    if (body.title.length > 200) {
      return new Response("Title is too long", { status: 400 });
    }
    patch.title = body.title;
  }
  if (typeof body.source === "string") {
    if (body.source.length > MAX_SOURCE_LENGTH) {
      return new Response("Source is too long", { status: 400 });
    }
    patch.source = body.source;
  }

  if (patch.title === undefined && patch.source === undefined) {
    return new Response("Nothing to update", { status: 400 });
  }

  const { id } = await context.params;
  const updated = updateConversation(id, defaultOwnerId(), patch);
  if (!updated) {
    return new Response("Unknown conversation", { status: 404 });
  }

  return Response.json({ conversation: updated });
}

/**
 * DELETE /api/conversations/[id]
 *
 * 204: deleted
 * 404: unknown conversation
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const limit = checkRateLimit(
    `conversations:delete:${clientKey(req.headers)}`,
    DELETE_MAX_REQUESTS,
  );
  if (!limit.ok) {
    return new Response("Too many requests. Please try again shortly.", {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  const { id } = await context.params;
  if (!deleteConversation(id, defaultOwnerId())) {
    return new Response("Unknown conversation", { status: 404 });
  }

  return new Response(null, { status: 204 });
}
