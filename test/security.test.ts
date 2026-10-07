import { describe, expect, test } from "bun:test";
import {
  normalizeMermaidSource,
  sanitizeMermaidSourceForRender,
} from "../lib/mermaid/security";

describe("normalizeMermaidSource", () => {
  test("passes clean source through unchanged", () => {
    const src = "graph TD\n  A[Foo] --> B[Bar]\n";
    expect(normalizeMermaidSource(src)).toBe(src);
  });

  test("strips leading BOM", () => {
    expect(normalizeMermaidSource("﻿graph TD\n")).toBe("graph TD\n");
  });

  test("strips zero-width spaces / joiners", () => {
    expect(normalizeMermaidSource("graph TD\n")).toBe("graph TD\n");
  });

  test("normalizes CRLF and CR line endings to LF", () => {
    expect(normalizeMermaidSource("graph TD\r\n  A\r\n")).toBe(
      "graph TD\n  A\n",
    );
    expect(normalizeMermaidSource("graph TD\rB")).toBe("graph TD\nB");
  });

  test("rejoins classDef split across two lines", () => {
    const src = "classDef foo\n  fill:#f9f\n  stroke:#333";
    expect(normalizeMermaidSource(src)).toBe(
      "classDef foo fill:#f9f stroke:#333",
    );
  });

  test("rejoin stops at non-CSS line", () => {
    const src = "classDef foo\n  fill:#f9f\nclass A done";
    expect(normalizeMermaidSource(src)).toBe(
      "classDef foo fill:#f9f\nclass A done",
    );
  });

  test("rejoins style split across two lines", () => {
    const src = "style A\n  fill:#f9f\n  stroke:#333";
    expect(normalizeMermaidSource(src)).toBe(
      "style A fill:#f9f stroke:#333",
    );
  });

  test("preserves %% comments verbatim", () => {
    const src = "%% header\ngraph TD\n  A[Foo] %% inline\n";
    expect(normalizeMermaidSource(src)).toBe(src);
  });

  test("empty source stays empty", () => {
    expect(normalizeMermaidSource("")).toBe("");
  });
});

describe("sanitizeMermaidSourceForRender", () => {
  test("plain source (no click directives) passes through", () => {
    const src = "graph TD\n  A[Foo] --> B[Bar]\n";
    expect(sanitizeMermaidSourceForRender(src)).toBe(src);
  });

  test("keeps click directive that targets https URL", () => {
    const src = 'click a "https://example.com"\n';
    expect(sanitizeMermaidSourceForRender(src)).toContain(
      'click a "https://example.com"',
    );
  });

  test("drops click directive that targets javascript: URL", () => {
    const src = 'click a "javascript:alert(1)"\ngraph TD\n';
    const out = sanitizeMermaidSourceForRender(src);
    expect(out).not.toContain("javascript:");
    expect(out).toContain("graph TD");
  });

  test("drops click directive that targets data: URL", () => {
    const src = 'click a "data:text/html,<script>"\ngraph TD\n';
    expect(sanitizeMermaidSourceForRender(src)).not.toContain("data:");
  });

  test("drops click directive that targets http:// (non-https)", () => {
    const src = 'click a "http://example.com"\ngraph TD\n';
    expect(sanitizeMermaidSourceForRender(src)).not.toContain("http://");
  });

  test("drops malformed click directive (no URL)", () => {
    const src = "click a\ngraph TD\n";
    expect(sanitizeMermaidSourceForRender(src)).not.toContain("click a");
  });

  test("consumes %%{init: ...}%% multi-line config directive", () => {
    const src =
      '%%{init: {"theme": "forest"}}%%\ngraph TD\n  A[Foo]\n';
    expect(sanitizeMermaidSourceForRender(src)).not.toContain("%%{");
  });

  test("preserves %% comments", () => {
    const src = "%% header\ngraph TD\n";
    expect(sanitizeMermaidSourceForRender(src)).toContain("%% header");
  });

  test("combines: comment + bad click + diagram", () => {
    const src =
      '%% header\nclick a "javascript:alert(1)"\ngraph TD\n  A[Foo]\n';
    const out = sanitizeMermaidSourceForRender(src);
    expect(out).toContain("%% header");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("graph TD");
    expect(out).toContain("A[Foo]");
  });
});