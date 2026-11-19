import type { Metadata } from "next";

import { StyleRouter } from "~/components/styles/router";
import { autosaveIntervalMs, defaultOwnerId } from "~/server/config/settings";
import { getConversationSnapshot } from "~/server/db/conversations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editor",
  alternates: { canonical: "/editor" },
  robots: { index: true, follow: true },
};

interface SearchParams {
  "ui-style"?: string;
  c?: string;
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { "ui-style": uiStyle, c } = await searchParams;

  let conversation = null;
  try {
    conversation = c ? getConversationSnapshot(c, defaultOwnerId()) : null;
  } catch {
    // A missing or unwritable database degrades to a scratch editor rather
    // than a 500.
    conversation = null;
  }

  return (
    <StyleRouter
      uiStyle={uiStyle}
      conversation={conversation}
      autoSaveIntervalMs={autosaveIntervalMs()}
    />
  );
}
