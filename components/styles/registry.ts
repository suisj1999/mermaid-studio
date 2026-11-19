import dynamic from "next/dynamic";

import type { ComponentType } from "react";

import type {
  ConversationSnapshot,
  ConversationSummary,
} from "~/lib/conversations/types";

import type { StyleId } from "./ids";

export {
  DEFAULT_STYLE_ID,
  STYLE_IDS,
  STYLE_METADATA,
  isKnownStyleId,
  type StyleId,
  type StyleMetadata,
} from "./ids";

/** Props every style's home page receives. */
export interface HomePageProps {
  /** The already-validated style, resolved on the server. */
  styleId: StyleId;
  conversations: ConversationSummary[];
}

/** Props every style's editor receives. */
export interface EditorPageProps {
  /** The already-validated style, resolved on the server. */
  styleId: StyleId;
  /** The conversation being edited, or `null` for a scratch editor. */
  conversation: ConversationSnapshot | null;
  /** Auto-save debounce in milliseconds; `0` disables auto-save. */
  autoSaveIntervalMs: number;
}

/**
 * Each style contributes two pages — a home page listing saved
 * conversations and an editor. Both are lazy-loaded with `next/dynamic`
 * (without `ssr: false`) so only the selected style's CSS and JS load,
 * while the page still server-renders for crawlers.
 */
export const STYLE_PAGES: Record<
  StyleId,
  {
    home: ComponentType<HomePageProps>;
    editor: ComponentType<EditorPageProps>;
  }
> = {
  "neo-brutalism": {
    home: dynamic(
      () => import("./neo-brutalism/HomePage").then((module) => module.default),
    ),
    editor: dynamic(
      () => import("./neo-brutalism/EditorPage").then((module) => module.default),
    ),
  },
  newspaper: {
    home: dynamic(
      () => import("./newspaper/HomePage").then((module) => module.default),
    ),
    editor: dynamic(
      () => import("./newspaper/EditorPage").then((module) => module.default),
    ),
  },
};
