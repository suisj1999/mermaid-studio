const clickDirectiveStart = /^click(\s|$)/u;

/**
 * Strip click directives that don't target a safe https URL.
 * (Keeps the syntax-level guard from GitDiagram but drops the GitHub-only
 * restriction since this is a general-purpose tool.)
 */
export function sanitizeMermaidSourceForRender(source: string): string {
  const lines: string[] = [];
  let insideConfigDirective = false;

  for (const line of source.split("\n")) {
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
