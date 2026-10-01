const clickDirectiveStart = /^click(\s|$)/u;

// Declaration heads that copy-paste routinely splits into multiple lines. The
// rest of the declaration is a space-separated list of CSS properties, so we
// can rejoin any number of trailing `prop: value` lines onto the head.
const CLASSDEF_HEAD = /^(\s*)classDef\s+([a-zA-Z_][a-zA-Z0-9_-]*)\s*$/u;
const STYLE_HEAD = /^(\s*)style\s+((?:[a-zA-Z_][a-zA-Z0-9_.-]*\s*,\s*)*[a-zA-Z_][a-zA-Z0-9_.-]*)\s*$/u;
const CSS_PROPERTY = /^(?:fill|stroke|stroke-width|color|opacity|font-size|font-family|font-weight)\s*:/iu;

function getJoinableHeadPrefix(line: string): string | null {
  const classMatch = line.match(CLASSDEF_HEAD);
  if (classMatch) return `${classMatch[1]}classDef ${classMatch[2]}`;
  const styleMatch = line.match(STYLE_HEAD);
  if (styleMatch) return `${styleMatch[1]}style ${styleMatch[2]}`;
  return null;
}

/**
 * Fix the most common copy-paste damage before Mermaid's parser sees it:
 * - strip BOM and zero-width characters
 * - normalize CRLF / CR to LF
 * - rejoin `classDef <name>` and `style <id>` heads that ended up on their
 *   own line, with the CSS property lines that follow them
 *
 * Without this, a long classDef line that wraps at column 80 in a chat
 * client gets pasted in with the `fill:` half stranded on its own line, and
 * Mermaid fails the parse with a generic syntax error pointing at the head.
 */
export function normalizeMermaidSource(source: string): string {
  const cleaned = source
    .replace(/^﻿/, "")
    // Strip zero-width spaces / joiners / BOM that sneak in from copy-paste.
    .replace(/[‌‍﻿]/gu, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = cleaned.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("%%")) {
      result.push(line);
      continue;
    }

    const head = getJoinableHeadPrefix(line);
    if (!head) {
      result.push(line);
      continue;
    }

    let combined = head;
    let j = i + 1;
    while (j < lines.length) {
      const nextTrimmed = lines[j].trim();
      if (!nextTrimmed) {
        j++;
        continue;
      }
      if (CSS_PROPERTY.test(nextTrimmed)) {
        combined += ` ${nextTrimmed}`;
        j++;
      } else {
        break;
      }
    }

    result.push(combined);
    i = j - 1;
  }

  return result.join("\n");
}

/**
 * Strip click directives that don't target a safe https URL.
 * (Keeps the syntax-level guard from GitDiagram but drops the GitHub-only
 * restriction since this is a general-purpose tool.)
 */
export function sanitizeMermaidSourceForRender(source: string): string {
  const normalized = normalizeMermaidSource(source);
  const lines: string[] = [];
  let insideConfigDirective = false;

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (insideConfigDirective) {
      insideConfigDirective = !trimmed.includes("}%%");
      continue;
    }
    if (trimmed.startsWith("%%{")) {
      insideConfigDirective = !trimmed.includes("}%%");
      continue;
    }
    if (clickDirectiveStart.test(trimmed)) {
      // Allow only click directives that point at an https URL.
      const match = trimmed.match(
        /^click\s+[a-z_][a-z0-9_-]*\s+"(https:\/\/[^"\s]+)"\s*$/iu,
      );
      if (!match) continue;
    }
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Walk the rendered SVG and clean up anchor hrefs:
 * - drop non-https schemes (javascript:, data:, vbscript:, ...)
 * - drop xlink:href entirely
 * - ensure rel="noopener noreferrer" on every kept link
 */
export function enforceSafeMermaidLinks(root: ParentNode): void {
  for (const anchor of root.querySelectorAll("a")) {
    const rawHref =
      anchor.getAttribute("href") ?? anchor.getAttribute("xlink:href") ?? "";

    try {
      const url = new URL(rawHref, window.location.origin);
      if (url.protocol !== "https:") {
        anchor.removeAttribute("href");
        anchor.removeAttribute("xlink:href");
        continue;
      }
      anchor.setAttribute("href", url.toString());
      anchor.removeAttribute("xlink:href");
      anchor.setAttribute("rel", "noopener noreferrer");
    } catch {
      anchor.removeAttribute("href");
      anchor.removeAttribute("xlink:href");
    }
  }
}
