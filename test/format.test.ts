import { describe, expect, test } from "bun:test";
import { formatDate, formatRelativeTime } from "../lib/conversations/format";

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);

describe("formatRelativeTime", () => {
  test("reports a fresh timestamp as 'just now'", () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("just now");
  });

  test("reports minutes", () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5m ago");
  });

  test("reports hours", () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
  });

  test("reports days", () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe("2d ago");
  });

  test("falls back to an absolute date after a week", () => {
    expect(formatRelativeTime(NOW - 30 * 86_400_000, NOW)).toContain("2026");
  });

  test("treats a clock skew into the future as 'just now'", () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe("just now");
  });
});

describe("formatDate", () => {
  test("formats in UTC so the server and the browser agree", () => {
    expect(formatDate(Date.UTC(2026, 10, 15, 23, 30))).toBe("Nov 15, 2026");
  });
});
