import { describe, expect, test } from "bun:test";
import { buildSourceIndex, matchKnownId } from "../lib/mermaid/source-index";
import type { SourceIndexEntry } from "../lib/mermaid/source-index";

function indexOf(entries: SourceIndexEntry[], id: string): SourceIndexEntry | undefined {
  return entries.find((e) => e.id === id);
}

describe("buildSourceIndex — line numbers", () => {
  test("simple A[Label] on L2", () => {
    const src = "graph TD\n  A[User]\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "A", line: 2, type: "node" });
  });

  test("isolated node without edge gets indexed (regression: FLOWCHART_NODE_LINE u-flag bug)", () => {
    const src = "graph TD\n  A[Lonely]\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "A", line: 2, type: "node" });
  });

  test("deep line number is correct (regression: off-by-one bug)", () => {
    const lines = ["graph TD", "  K --> L"];
    for (let i = 0; i < 47; i++) lines.push("  K --> L");
    lines.push("  A[Deep]");
    const idx = buildSourceIndex(lines.join("\n") + "\n");
    expect(indexOf(idx, "A")).toMatchObject({ line: 50, type: "node" });
  });

  test("last line without trailing newline still gets correct line number", () => {
    const src = "graph TD\n  A[End]";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "A", line: 2, type: "node" });
  });
});

describe("buildSourceIndex — multi-node and edge-target capture", () => {
  test("A[U] --> B[V] captures both endpoints", () => {
    const src = "graph TD\n  A[U] --> B[V]\n  B --> C\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "A", line: 2, type: "node" });
    expect(idx).toContainEqual({ id: "B", line: 2, type: "node" });
    expect(idx).toContainEqual({ id: "C", line: 3, type: "node" });
  });

  test("bare edge A --> B captures both source and target", () => {
    const src = "graph TD\n  A --> B\n";
    const idx = buildSourceIndex(src);
    expect(indexOf(idx, "A")?.type).toBe("edge");
    expect(indexOf(idx, "B")?.type).toBe("node");
  });
});

describe("buildSourceIndex — inline ::: class syntax", () => {
  test("A:::important --> B captures A as source and B as target", () => {
    const src = "graph TD\n  A:::important --> B\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "A", line: 2, type: "node" });
    expect(idx).toContainEqual({ id: "B", line: 2, type: "node" });
  });

  test("inline ::: with explicit shape", () => {
    const src = "graph TD\n  A:::important[Go] --> B\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "A", line: 2, type: "node" });
    expect(idx).toContainEqual({ id: "B", line: 2, type: "node" });
  });

  test("className itself is NOT registered as a node", () => {
    const src = "graph TD\n  A:::important --> B\n";
    const idx = buildSourceIndex(src);
    expect(indexOf(idx, "important")).toBeUndefined();
  });
});

describe("buildSourceIndex — class statement", () => {
  test("class A,B done registers both ids as nodes", () => {
    const src = "graph TD\n  A --> B\n  class A,B done\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "A", line: 2, type: "edge" });
    expect(idx).toContainEqual({ id: "B", line: 2, type: "node" });
  });

  test("single-id class assignment", () => {
    const src = "graph TD\n  A[Node]\n  class A done\n";
    const idx = buildSourceIndex(src);
    expect(indexOf(idx, "A")?.line).toBe(2);
  });
});

describe("buildSourceIndex — classDef does not leak", () => {
  test("classDef alone indexes nothing", () => {
    const src = "classDef important fill:#f9f\nclassDef done fill:#cfc\n";
    expect(buildSourceIndex(src)).toEqual([]);
  });
});

describe("buildSourceIndex — Unicode IDs", () => {
  test("CJK ids are indexed correctly (regression: \\b is ASCII-only)", () => {
    const src = "graph TD\n  用户[用户] --> 任务[任务]\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "用户", line: 2, type: "node" });
    expect(idx).toContainEqual({ id: "任务", line: 2, type: "node" });
  });
});

describe("buildSourceIndex — subgraph", () => {
  test("subgraph id is captured as boundary", () => {
    const src = "graph TD\n  subgraph sg [Group]\n    A --> B\n  end\n";
    const idx = buildSourceIndex(src);
    expect(idx).toContainEqual({ id: "sg", line: 2, type: "boundary" });
    expect(indexOf(idx, "A")?.line).toBe(3);
    expect(indexOf(idx, "B")?.line).toBe(3);
  });
});

describe("buildSourceIndex — line numbers match the raw editor text", () => {
  test("a wrapped classDef does not shift the lines of later nodes", () => {
    // The renderer rejoins these three lines into one before handing them
    // to Mermaid, but the editor still shows all three. The index has to
    // be built from the raw text so the click lands on the right row.
    const src = [
      "graph TD",
      "  A[User] --> B{Auth?}",
      "classDef important",
      "  fill:#f9f",
      "  stroke:#333",
      "  B --> C[Dashboard]",
    ].join("\n");
    expect(indexOf(buildSourceIndex(src), "C")?.line).toBe(6);
  });

  test("an init directive does not shift the lines of later nodes", () => {
    const src = [
      "%%{init: {'theme': 'dark'}}%%",
      "graph TD",
      "  A --> B",
    ].join("\n");
    expect(indexOf(buildSourceIndex(src), "A")?.line).toBe(3);
  });

  test("classDef bodies never register as nodes", () => {
    const src = [
      "graph TD",
      "classDef important",
      "  fill:#f9f",
      "  stroke:#333",
    ].join("\n");
    expect(buildSourceIndex(src)).toEqual([]);
  });
});

describe("matchKnownId", () => {
  test("exact split match", () => {
    expect(matchKnownId("flowchart-A-1", new Set(["A", "B"]))).toBe("A");
  });

  test("underscore-containing ids", () => {
    expect(matchKnownId("flowchart-web_app-2", new Set(["web_app"]))).toBe("web_app");
  });

  test("returns null when no known id is found", () => {
    expect(matchKnownId("flowchart-XYZ-9", new Set(["A", "B"]))).toBeNull();
  });
});