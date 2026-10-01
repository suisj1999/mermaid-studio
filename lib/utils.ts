import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with conflict resolution.
 *
 * Combines `clsx` (conditional joining: arrays, objects, falsy values)
 * with `twMerge` (deduplicates conflicting utilities so the last one wins,
 * e.g. `cn("p-2", condition && "p-4")`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
