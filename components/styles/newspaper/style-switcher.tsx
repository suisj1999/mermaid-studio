"use client";

import { useRouter } from "next/navigation";

import { STYLE_METADATA, type StyleId } from "~/components/styles/registry";
import {
  navigateToHomeStyle,
  navigateToStyle,
} from "~/components/styles/switcher";
import { cn } from "~/lib/utils";

export interface NewspaperStyleSwitcherProps {
  styleId: StyleId;
  /**
   * Where a style change should land: the home page's list of saved
   * diagrams, or the editor. The editor keeps the open conversation.
   */
  target: "home" | "editor";
  conversationId?: string | null;
}

/**
 * The newspaper style list in the masthead.
 */
export function NewspaperStyleSwitcher({
  styleId,
  target,
  conversationId,
}: NewspaperStyleSwitcherProps) {
  const router = useRouter();

  return (
    <nav
      aria-label="UI style"
      className="flex items-center gap-3 text-[10px] tracking-[0.22em] uppercase"
    >
      {STYLE_METADATA.map((style) => {
        const isActive = style.id === styleId;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => {
              if (target === "home") {
                navigateToHomeStyle(router, style.id);
              } else {
                navigateToStyle(router, style.id, conversationId);
              }
            }}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex min-h-6 items-center py-1 transition-colors",
              isActive
                ? "font-serif text-[12px] italic text-[hsl(var(--paper-accent))]"
                : "text-[hsl(var(--paper-muted))] hover:text-[hsl(var(--paper-ink))]",
            )}
          >
            {style.name}
          </button>
        );
      })}
    </nav>
  );
}
