import { describe, expect, test } from "bun:test";
import { toastReducer, type ToastState } from "../hooks/use-toast";

describe("toastReducer", () => {
  test("show replaces null with payload", () => {
    const next: ToastState = { message: "copied", tone: "ok" };
    expect(toastReducer(null, { type: "show", payload: next })).toEqual(next);
  });

  test("show replaces a previous toast with the new payload (no stacking)", () => {
    const prev: ToastState = { message: "first", tone: "ok" };
    const next: ToastState = { message: "second", tone: "error" };
    expect(toastReducer(prev, { type: "show", payload: next })).toEqual(next);
  });

  test("show without payload clears the toast", () => {
    const prev: ToastState = { message: "x", tone: "ok" };
    expect(toastReducer(prev, { type: "show" })).toBeNull();
  });

  test("dismiss clears any toast", () => {
    const prev: ToastState = { message: "x", tone: "ok" };
    expect(toastReducer(prev, { type: "dismiss" })).toBeNull();
  });

  test("dismiss on null stays null", () => {
    expect(toastReducer(null, { type: "dismiss" })).toBeNull();
  });
});
