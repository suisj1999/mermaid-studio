"use client";

import { DEFAULT_STYLE_ID, isKnownStyleId, STYLE_PAGES } from "./registry";
import type { EditorPageProps, HomePageProps } from "./registry";

function resolveStyleId(uiStyle: string | undefined) {
  return isKnownStyleId(uiStyle) ? uiStyle : DEFAULT_STYLE_ID;
}

/**
 * Client router for the editor route. Picks the style's editor and hands
 * it the conversation to open.
 */
export function StyleRouter({
  uiStyle,
  conversation,
  autoSaveIntervalMs,
}: Omit<EditorPageProps, "styleId"> & { uiStyle?: string }) {
  const styleId = resolveStyleId(uiStyle);
  const Editor = STYLE_PAGES[styleId].editor;
  return (
    <Editor
      styleId={styleId}
      conversation={conversation}
      autoSaveIntervalMs={autoSaveIntervalMs}
    />
  );
}

/**
 * Client router for the home route. Picks the style's home page and hands
 * it the list of saved conversations.
 */
export function HomeStyleRouter({
  uiStyle,
  conversations,
}: Omit<HomePageProps, "styleId"> & { uiStyle?: string }) {
  const styleId = resolveStyleId(uiStyle);
  const Home = STYLE_PAGES[styleId].home;
  return <Home styleId={styleId} conversations={conversations} />;
}
