import type { MermaidConfig } from "mermaid";

const FLOWCHART_CONFIG = {
  wrappingWidth: 200,
  curve: "linear" as const,
  nodeSpacing: 50,
  rankSpacing: 50,
  padding: 15,
};

const DARK_THEME_VARIABLES = {
  background: "#1f2631",
  primaryColor: "#2c3544",
  primaryBorderColor: "#6dd4e9",
  primaryTextColor: "#e8edf5",
  lineColor: "#ffd486",
  secondaryColor: "#26303f",
  tertiaryColor: "#323d4d",
};

const LIGHT_THEME_VARIABLES = {
  background: "#ffffff",
  primaryColor: "#f7f7f7",
  primaryBorderColor: "#000000",
  primaryTextColor: "#171717",
  lineColor: "#000000",
  secondaryColor: "#f0f0f0",
  tertiaryColor: "#f7f7f7",
};

const THEME_CSS = `
  .clickable > * {
    scale: 1;
    transform-box: fill-box;
    transform-origin: center;
    transition: scale 160ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  .clickable {
    cursor: pointer;
  }
  @media (hover: hover) and (pointer: fine) {
    .clickable:hover > * {
      scale: 1.05;
      filter: brightness(0.85);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .clickable > * {
      transition: none;
    }
    .clickable:hover > * {
      scale: 1;
    }
  }
`;

/**
 * Mermaid `themeVariables` for the studio's neo-brutalist look, scoped per
 * mode. Returned fresh so callers can spread it without leaking state across
 * renders.
 */
export function getMermaidThemeVariables(isDark: boolean) {
  return isDark ? DARK_THEME_VARIABLES : LIGHT_THEME_VARIABLES;
}

/**
 * Build the full Mermaid configuration used at render time.
 *
 * Pins `theme: "base"` + `layout: "dagre"` so the diagram picks up our custom
 * theme variables; `htmlLabels: false` because Mermaid's HTML labels are an
 * XSS surface that we'd rather not pay for; `themeCSS` adds the clickable
 * hover affordance.
 *
 * `backgroundColor` overrides the theme's default `background` variable when
 * the host wants a different panel color.
 */
export function buildMermaidConfig({
  isDark,
  backgroundColor,
}: {
  isDark: boolean;
  backgroundColor?: string;
}) {
  const themeVariables = {
    ...getMermaidThemeVariables(isDark),
    ...(backgroundColor ? { background: backgroundColor } : {}),
  };
  return {
    startOnLoad: false,
    suppressErrorRendering: true,
    securityLevel: "antiscript" as const,
    secure: ["securityLevel", "startOnLoad", "maxTextSize"],
    theme: "base" as const,
    htmlLabels: false,
    layout: "dagre",
    look: "classic" as const,
    flowchart: FLOWCHART_CONFIG,
    themeVariables,
    themeCSS: THEME_CSS,
  } satisfies MermaidConfig;
}

/**
 * Build a `%%{init: {...}}%%` directive that carries the studio theme so the
 * exported Mermaid source renders with the same look in any Mermaid renderer.
 */
export function buildMermaidInitDirective(isDark: boolean) {
  const payload = {
    theme: "base",
    look: "classic",
    layout: "dagre",
    flowchart: FLOWCHART_CONFIG,
    themeVariables: getMermaidThemeVariables(isDark),
    themeCSS: THEME_CSS.trim(),
  };
  return `%%{init: ${JSON.stringify(payload)} }%%`;
}

/**
 * Options passed to DOMPurify when sanitizing Mermaid's rendered SVG.
 *
 * Keeps the SVG + safe-HTML profiles (so Mermaid's inline-styled labels
 * survive) and forbids `<script>` tags. Note: this is not the full
 * allowlist — `enforceSafeMermaidLinks` runs after to drop non-https
 * `href` attributes that DOMPurify can't infer the semantics of.
 */
export const MERMAID_SVG_SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  FORBID_TAGS: ["script"],
};
