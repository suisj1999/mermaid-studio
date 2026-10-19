// Lightweight source-index for click-to-locate: map Mermaid node / edge IDs
// to the line numbers where they're declared. Used by the preview's click
// handler (components/diagram.tsx) to scroll the editor textarea to the line
// that defines the clicked node.
//
// This is NOT a full Mermaid parser — it's a best-effort regex sweep that
// covers the syntaxes the studio cares about (C4 + flowchart). Anything it
// misses just won't be clickable; rendering still works.

export const C4_KEYWORDS = [
  "Person",
  "Person_Ext",
  "System",
  "System_Ext",
  "SystemDb",
  "SystemDb_Ext",
  "Container",
  "Container_Ext",
  "ContainerDb",
  "ContainerDb_Ext",
  "ContainerQueue",
  "ContainerQueue_Ext",
  "Boundary",
  "Container_Boundary",
  "System_Boundary",
  "Component",
  "Component_Ext",
  "ComponentDb",
  "ComponentQueue",
  "Deployment_Node",
  "Rel",
  "Rel_U",
  "Rel_D",
  "Rel_Back",
  "Rel_Neighbor",
  "Rel_Up",
  "Rel_Down",
  "BiRel",
] as const;

const C4_EDGE_KEYWORDS = new Set([
  "Rel",
  "Rel_U",
  "Rel_D",
  "Rel_Back",
  "Rel_Neighbor",
  "Rel_Up",
  "Rel_Down",
  "BiRel",
]);

const C4_BOUNDARY_KEYWORDS = new Set([
  "Boundary",
  "Container_Boundary",
  "System_Boundary",
]);

export type SourceEntryType = "node" | "edge" | "boundary";

export interface SourceIndexEntry {
  id: string;
  line: number;
  type: SourceEntryType;
}

// Mermaid IDs accept any Unicode letter/digit, must start with a letter-like
// character. `\p{L}` / `\p{N}` are Unicode property escapes — required so
// CJK, accented Latin, etc. work. The `u` flag must be set on every regex
// that uses this class for `\p{...}` to parse correctly.
const ID_CHAR = "[\\p{L}_][\\p{L}\\p{N}_]*";

const C4_LINE = new RegExp(
  `^(${C4_KEYWORDS.join("|")})\\s*\\(\\s*(${ID_CHAR})`,
  "u",
);

const FLOWCHART_NODE_LINE = new RegExp(
  `(?<![\\p{L}\\p{N}_:])\\s*(${ID_CHAR})\\s*[\\[({>]`,
  "gu",
);

// Inline `ID:::className` syntax. The base FLOWCHART_NODE_LINE requires a
// shape opener after the ID, so `A:::important` doesn't match. We capture
// the ID separately here and push it as a node.
const FLOWCHART_NODE_INLINE_CLASS = new RegExp(
  `^\\s*(${ID_CHAR})\\s*:::`,
  "u",
);

// `class A,B,C className` — registers multiple nodes on one line.
const CLASS_ASSIGNMENT = new RegExp(
  `^\\s*class\\s+(${ID_CHAR}(?:\\s*,\\s*${ID_CHAR})*)\\s+(${ID_CHAR})`,
  "u",
);

// `subgraph` is a keyword, not an id — the actual id is the next identifier.
// Without this special-case, FLOWCHART_NODE_LINE captures `subgraph` itself,
// and `first-occurrence-wins` collapses every `subgraph X[...]` to line 2.
const SUBGRAPH_LINE = new RegExp(`^\\s*subgraph\\s+(${ID_CHAR})`, "u");

/**
 * Parse Mermaid source and produce an index from node ID → first line on
 * which that ID appears as the head of a node/edge declaration. First
 * occurrence wins; subsequent duplicates of the same ID are dropped so we
 * always jump to the canonical definition.
 */
export function buildSourceIndex(source: string): SourceIndexEntry[] {
  const entries: SourceIndexEntry[] = [];
  const seen = new Set<string>();
  let lineNumber = 1;

  for (let i = 0; i < source.length; ) {
    const newlineIdx = source.indexOf("\n", i);
    const lineEnd = newlineIdx === -1 ? source.length : newlineIdx;
    const line = source.slice(i, lineEnd);
    i = lineEnd + 1;

    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("%%")) {
      pushEntry(extractFromLine(trimmed, lineNumber), entries, seen);
    }
    lineNumber++;
  }

  return entries;
}

function extractFromLine(
  line: string,
  lineNumber: number,
): SourceIndexEntry[] {
  const out: SourceIndexEntry[] = [];

  const c4 = line.match(C4_LINE);
  if (c4) {
    const keyword = c4[1];
    const id = c4[2];
    const type: SourceEntryType = C4_EDGE_KEYWORDS.has(keyword)
      ? "edge"
      : C4_BOUNDARY_KEYWORDS.has(keyword)
        ? "boundary"
        : "node";
    out.push({ id, line: lineNumber, type });
    return out;
  }

  const subgraph = line.match(SUBGRAPH_LINE);
  if (subgraph) {
    out.push({ id: subgraph[1], line: lineNumber, type: "boundary" });
    return out;
  }

  // `class A,B,C name` — register every comma-separated id as a node.
  // Run before the inline-class regex so we don't capture just the first id.
  const classAssign = line.match(CLASS_ASSIGNMENT);
  if (classAssign) {
    for (const id of classAssign[1].split(/\s*,\s*/)) {
      out.push({ id, line: lineNumber, type: "node" });
    }
    return out;
  }

  // Inline `A:::className ...` — the base node regex requires a shape
  // opener, so this won't match without help. Register the leading id
  // as a node, then scan for any arrow + target id on the same line
  // (e.g. `A:::important --> B` still needs to register B).
  const inlineClass = line.match(FLOWCHART_NODE_INLINE_CLASS);
  if (inlineClass) {
    out.push({ id: inlineClass[1], line: lineNumber, type: "node" });
    for (const m of line.matchAll(
      /(?:-->|---|-\.->|==>|~~~|===|-~-)\s*([\p{L}_][\p{L}\p{N}_]*)/gu,
    )) {
      out.push({ id: m[1], line: lineNumber, type: "node" });
    }
    return out;
  }

  const nodeMatches = line.matchAll(FLOWCHART_NODE_LINE);
  for (const node of nodeMatches) {
    out.push({ id: node[1], line: lineNumber, type: "node" });
  }

  // Capture both edge sources (`A` in `A --> B`) and edge targets
  // (`B` in `A --> B`). Target-only capture catches the second node
  // on lines like `A[U] --> B[V]` where B is behind an arrow, not at
  // the start of the line.
  const edgeSources = line.matchAll(
    /([\p{L}_][\p{L}\p{N}_]*)\s*(?:-->|---|-\.->|==>|~~~|===|-~-)/gu,
  );
  for (const edge of edgeSources) {
    out.push({ id: edge[1], line: lineNumber, type: "edge" });
  }
  const edgeTargets = line.matchAll(
    /(?:-->|---|-\.->|==>|~~~|===|-~-)\s*([\p{L}_][\p{L}\p{N}_]*)/gu,
  );
  for (const target of edgeTargets) {
    out.push({ id: target[1], line: lineNumber, type: "node" });
  }

  return out;
}

function pushEntry(
  candidate: SourceIndexEntry | SourceIndexEntry[] | null,
  entries: SourceIndexEntry[],
  seen: Set<string>,
) {
  if (!candidate) return;
  const list = Array.isArray(candidate) ? candidate : [candidate];
  for (const entry of list) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }
}

/**
 * Find the first known user ID that appears in the Mermaid-generated SVG
 * `id` attribute. Mermaid embeds IDs as e.g. `flowchart-A-1`,
 * `stateDiagram-A-3`, or `c4c-Container-web_app-5`. We try:
 *     1. exact match of any segment split by `-`
 *     2. substring match with `-` boundary on either side (catches IDs
 *        containing `_` like `web_app`).
 */
export function matchKnownId(
  svgId: string,
  knownIds: ReadonlySet<string>,
): string | null {
  for (const part of svgId.split("-")) {
    if (knownIds.has(part)) return part;
  }
  for (const id of knownIds) {
    if (
      svgId.includes(`-${id}-`) ||
      svgId.endsWith(`-${id}`) ||
      svgId.startsWith(`${id}-`)
    ) {
      return id;
    }
  }
  return null;
}