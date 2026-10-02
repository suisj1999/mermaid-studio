import dynamic from "next/dynamic";

import type { ComponentType } from "react";

export const DEFAULT_STYLE_ID = "neo-brutalism" as const;

export type StyleId = "neo-brutalism" | "newspaper";

export interface StyleMetadata {
  id: StyleId;
  name: string;
  description: string;
}

export const STYLE_METADATA: readonly StyleMetadata[] = [
  {
    id: "neo-brutalism",
    name: "Neo-brutalism",
    description: "",
  },
  {
    id: "newspaper",
    name: "Newspaper",
    description: "",
  },
] as const;

export const STYLE_IDS = STYLE_METADATA.map((style) => style.id);

export function isKnownStyleId(value: unknown): value is StyleId {
  return typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
}

export const STYLES: Record<StyleId, ComponentType> = {
  "neo-brutalism": dynamic(
    () => import("./neo-brutalism/Page").then((module) => module.default),
  ),
  newspaper: dynamic(
    () => import("./newspaper/Page").then((module) => module.default),
  ),
};
