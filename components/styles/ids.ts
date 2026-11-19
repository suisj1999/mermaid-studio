/**
 * Style identifiers and metadata.
 *
 * Kept free of any Next.js import so it can be pulled into plain unit
 * tests and into the URL helpers without dragging the dynamic-import
 * registry along.
 */

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
