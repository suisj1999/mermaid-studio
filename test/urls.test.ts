import { describe, expect, test } from "bun:test";
import { DEFAULT_STYLE_ID } from "../components/styles/ids";
import { styleEditorHref, styleHomeHref } from "../components/styles/urls";

describe("styleEditorHref", () => {
  test("omits the default style and the conversation id", () => {
    expect(styleEditorHref(DEFAULT_STYLE_ID)).toBe("/editor");
  });

  test("adds the conversation id", () => {
    expect(styleEditorHref(DEFAULT_STYLE_ID, "abc")).toBe("/editor?c=abc");
  });

  test("adds a non-default style", () => {
    expect(styleEditorHref("newspaper")).toBe("/editor?ui-style=newspaper");
  });

  test("combines a non-default style and a conversation id", () => {
    expect(styleEditorHref("newspaper", "abc")).toBe(
      "/editor?ui-style=newspaper&c=abc",
    );
  });

  test("ignores an empty conversation id", () => {
    expect(styleEditorHref("newspaper", "")).toBe("/editor?ui-style=newspaper");
  });
});

describe("styleHomeHref", () => {
  test("keeps the default style at the root", () => {
    expect(styleHomeHref(DEFAULT_STYLE_ID)).toBe("/");
  });

  test("adds a non-default style", () => {
    expect(styleHomeHref("newspaper")).toBe("/?ui-style=newspaper");
  });
});
