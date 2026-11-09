/**
 * Canonical site origin used for metadata, canonical links, robots.txt and
 * sitemap.xml. `NEXT_PUBLIC_SITE_URL` must point at the deployed origin
 * (e.g. https://mermaid.example.com) — the localhost fallback only makes
 * the app self-consistent during local development.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed value must not take the whole build down with it.
    return "http://localhost:3000";
  }
}

export const siteUrl = resolveSiteUrl();

export const siteName = "Mermaid Studio";

export const siteDescription =
  "Write Mermaid diagrams in a live editor with syntax highlighting, pan and zoom, SVG/PNG export, or generate one from a plain-language description with AI.";

export const siteLocale = "en_US";
