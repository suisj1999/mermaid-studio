import { describe, expect, test } from "bun:test";
import lzString from "lz-string";
import {
  decodeFromUrl,
  decodeShareState,
  encodeShareState,
  formatShareUrl,
  type ShareState,
} from "../lib/share/encode";

describe("encodeShareState / decodeShareState round-trip", () => {
  test("plain ASCII source", () => {
    const state: ShareState = { v: 1, s: "graph TD\n  A --> B" };
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  test("UTF-8 CJK source (regression: lz-string must preserve code points)", () => {
    const state: ShareState = {
      v: 1,
      s: "graph TD\n  用户 --> 任务\n  任务 --> 结束",
    };
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  test("with optional theme + ui-style fields", () => {
    const state: ShareState = {
      v: 1,
      s: "graph TD\n  A --> B",
      t: "dark",
      u: "newspaper",
    };
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  test("empty source round-trips", () => {
    const state: ShareState = { v: 1, s: "" };
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  test("decoding accepts payloads that already have #s= prefix stripped", () => {
    const encoded = encodeShareState({ v: 1, s: "graph TD" });
    expect(decodeShareState(encoded)).toEqual({ v: 1, s: "graph TD" });
  });

  test("decoding accepts payloads with the raw #s= prefix intact", () => {
    const encoded = encodeShareState({ v: 1, s: "graph TD" });
    expect(decodeShareState(`#s=${encoded}`)).toEqual({ v: 1, s: "graph TD" });
  });
});

describe("decodeShareState error handling", () => {
  test("empty string returns null", () => {
    expect(decodeShareState("")).toBeNull();
  });

  test("non-version-prefixed input returns null", () => {
    expect(decodeShareState("garbage")).toBeNull();
    expect(decodeShareState("v.x.y")).toBeNull();
  });

  test("unknown version returns null", () => {
    expect(decodeShareState("v2.N4cgY")).toBeNull();
    expect(decodeShareState("v99.N4cgY")).toBeNull();
  });

  test("oversized source returns null (DoS guard)", () => {
    const oversized = "A".repeat(100_001);
    const encoded = encodeShareState({ v: 1, s: oversized });
    expect(decodeShareState(encoded)).toBeNull();
  });

  test("non-string source in decoded JSON returns null", () => {
    // Bypass encodeShareState so we can ship a malformed payload
    const compressed = lzString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, s: 42 }),
    );
    expect(decodeShareState(`v1.${compressed}`)).toBeNull();
  });

  test("wrong shape in decoded JSON returns null", () => {
    const compressed = lzString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, s: "ok", t: "rainbow" }),
    );
    expect(decodeShareState(`v1.${compressed}`)).toBeNull();
  });

  test("missing version returns null", () => {
    const compressed = lzString.compressToEncodedURIComponent(
      JSON.stringify({ s: "graph TD" }),
    );
    expect(decodeShareState(`v1.${compressed}`)).toBeNull();
  });
});

describe("formatShareUrl", () => {
  test("default style omits the query parameter", () => {
    const url = formatShareUrl("https://example.com", "neo-brutalism", {
      v: 1,
      s: "graph TD",
    });
    expect(url).toMatch(/^https:\/\/example\.com#s=v1\./);
    expect(url).not.toContain("?ui-style=");
  });

  test("null ui-style also omits the query parameter", () => {
    const url = formatShareUrl("https://example.com", null, {
      v: 1,
      s: "graph TD",
    });
    expect(url).not.toContain("?ui-style=");
  });

  test("non-default style appends ?ui-style=", () => {
    const url = formatShareUrl("https://example.com", "newspaper", {
      v: 1,
      s: "graph TD",
    });
    expect(url).toMatch(/^https:\/\/example\.com\?ui-style=newspaper#s=v1\./);
  });

  test("decoding the formatted URL recovers the source", () => {
    const url = formatShareUrl("https://example.com", "newspaper", {
      v: 1,
      s: "graph TD\n  A --> B",
      t: "dark",
    });
    const decoded = decodeFromUrl(url);
    expect(decoded).toEqual({
      state: { v: 1, s: "graph TD\n  A --> B", t: "dark" },
      uiStyle: "newspaper",
    });
  });
});

describe("decodeFromUrl", () => {
  test("returns null when the URL has no #s= hash payload", () => {
    expect(decodeFromUrl("https://example.com/?ui-style=newspaper")).toBeNull();
  });

  test("returns null when the hash exists but isn't a valid payload", () => {
    expect(decodeFromUrl("https://example.com/#s=garbage")).toBeNull();
  });

  test("reads ui-style from the query string", () => {
    const url = formatShareUrl("https://example.com", "newspaper", {
      v: 1,
      s: "graph TD",
    });
    expect(decodeFromUrl(url)?.uiStyle).toBe("newspaper");
  });

  test("uiStyle is null when the query string omits the param", () => {
    const url = formatShareUrl("https://example.com", null, {
      v: 1,
      s: "graph TD",
    });
    expect(decodeFromUrl(url)?.uiStyle).toBeNull();
  });

  test("accepts a URL object as input", () => {
    const url = new URL(formatShareUrl("https://example.com", "newspaper", {
      v: 1,
      s: "graph TD",
    }));
    expect(decodeFromUrl(url)?.uiStyle).toBe("newspaper");
  });
});