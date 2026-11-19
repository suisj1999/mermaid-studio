import { HomeStyleRouter } from "~/components/styles/router";
import type { ConversationSummary } from "~/lib/conversations/types";
import { defaultOwnerId } from "~/server/config/settings";
import { listConversationSummaries } from "~/server/db/conversations";

export const dynamic = "force-dynamic";

interface SearchParams {
  "ui-style"?: string;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { "ui-style": uiStyle } = await searchParams;

  let conversations: ConversationSummary[] = [];
  try {
    conversations = listConversationSummaries(defaultOwnerId());
  } catch {
    // A missing or unwritable database degrades to an empty list rather
    // than a 500.
    conversations = [];
  }

  return <HomeStyleRouter uiStyle={uiStyle} conversations={conversations} />;
}
