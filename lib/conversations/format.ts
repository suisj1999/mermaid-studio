/**
 * Presentation helpers for the conversation list.
 *
 * Pure and dependency-free so they can be exercised without a DOM.
 */

/**
 * A short, human-readable age of a timestamp: "just now", "12m ago",
 * "3h ago", "5d ago", or an absolute date once it is more than a week old.
 *
 * The result depends on the current time, so render it inside an element
 * with `suppressHydrationWarning` — the server and the browser can disagree
 * by a minute across a hydration boundary.
 */
export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  const elapsed = now - timestamp;
  if (elapsed < 0) return "just now";

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(timestamp);
}

/**
 * An absolute date in UTC, so the server and the browser always agree.
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
