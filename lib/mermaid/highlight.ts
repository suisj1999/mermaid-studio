// Single-pass Mermaid tokenizer for editor syntax highlighting. Returns a flat
// array of typed spans consumed left-to-right from the source — the CodeEditor
// renders each as a `<span className="surface-syntax-{type}">`. Bracket-shaped
// labels (e.g. `A[User]`, `B{Rhombus?}`, `C4 Person(...)`) are consumed as one
// shape token so the matching pair stays balanced regardless of inner content.

import { C4_KEYWORDS } from "./source-index";

export type TokenType =
  | "comment"
  | "string"
  | "keyword"
  | "edge"
  | "id"
  | "shape"
  | "default";

export interface Token {
  type: TokenType;
  text: string;
}

const DIAGRAM_KEYWORDS = new Set([
  "graph",
  "flowchart",
  "subgraph",
  "end",
  "style",
  "classDef",
  "class",
  "click",
  "linkStyle",
  "applyStyle",
  "direction",
  "default",
  "title",
  "accTitle",
  "accDescr",
]);

const DIRECTIONS = new Set(["TD", "TB", "LR", "RL", "BT"]);

const KEYWORDS = new Set<string>([
  ...DIAGRAM_KEYWORDS,
  ...DIRECTIONS,
  ...C4_KEYWORDS,
]);

const COMMENT_RE = /^%%[^\n]*/;
const STRING_RE = /^"(?:[^"\\\n]|\\.)*"/;
const EDGE_RE = /^(?:-->|---|-\.->|==>|~~~|===|-\.-)(?:\|[^|\n]*\|)?/;
const ID_RE = /^[\p{L}_][\p{L}\p{N}_]*/u;

// Longest-first so `((` matches before `(`, `[/` before `[`, etc.
const SHAPE_OPENERS: ReadonlyArray<{ open: string; close: string }> = [
  { open: "((", close: "))" },
  { open: "{{", close: "}}" },
  { open: "[(", close: ")]" },
  { open: "[/", close: "/]" },
  { open: "[\\", close: "\\]" },
  { open: "[", close: "]" },
  { open: "(", close: ")" },
  { open: "{", close: "}" },
  // `>` is the asymmetric / flag shape (e.g. `A>Wedge]`); its closer is `]`.
  { open: ">", close: "]" },
];

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < source.length) {
    const rest = source.slice(pos);

    if (rest.startsWith("%%")) {
      const nl = rest.indexOf("\n");
      const end = nl === -1 ? rest.length : nl;
      tokens.push({ type: "comment", text: rest.slice(0, end) });
      pos += end;
      continue;
    }

    if (rest[0] === '"') {
      const m = rest.match(STRING_RE);
      if (m) {
        tokens.push({ type: "string", text: m[0] });
        pos += m[0].length;
        continue;
      }
    }

    const edgeMatch = rest.match(EDGE_RE);
    if (edgeMatch) {
      tokens.push({ type: "edge", text: edgeMatch[0] });
      pos += edgeMatch[0].length;
      continue;
    }

    let consumedAsShape = false;
    for (const { open, close } of SHAPE_OPENERS) {
      if (rest.startsWith(open)) {
        const shapeText = consumeShape(rest, open, close);
        tokens.push({ type: "shape", text: shapeText });
        pos += shapeText.length;
        consumedAsShape = true;
        break;
      }
    }
    if (consumedAsShape) continue;

    const idMatch = rest.match(ID_RE);
    if (idMatch) {
      const text = idMatch[0];
      tokens.push({
        type: KEYWORDS.has(text) ? "keyword" : "id",
        text,
      });
      pos += text.length;
      continue;
    }

    tokens.push({ type: "default", text: rest[0] });
    pos += 1;
  }

  return tokens;
}

function consumeShape(
  rest: string,
  open: string,
  close: string,
): string {
  let depth = 1;
  let i = open.length;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === "\n") break;
    if (ch === close) {
      depth -= 1;
      i += 1;
      if (depth === 0) return rest.slice(0, i);
    } else if (ch === open) {
      depth += 1;
      i += 1;
    } else {
      i += 1;
    }
  }
  return rest.slice(0, i);
}
