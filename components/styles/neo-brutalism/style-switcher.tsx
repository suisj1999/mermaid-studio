"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

import { STYLE_METADATA, type StyleId } from "~/components/styles/registry";
import {
  navigateToHomeStyle,
  navigateToStyle,
} from "~/components/styles/switcher";
import { cn } from "~/lib/utils";

export interface NeoStyleSwitcherProps {
  styleId: StyleId;
  /**
   * Where a style change should land: the home page's list of saved
   * diagrams, or the editor. The editor keeps the open conversation.
   */
  target: "home" | "editor";
  conversationId?: string | null;
}

/**
 * The neo-brutalism style dropdown.
 *
 * Switching style replaces the current URL rather than pushing a new
 * history entry, so the back button doesn't accumulate style swaps.
 */
export function NeoStyleSwitcher({
  styleId,
  target,
  conversationId,
}: NeoStyleSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Opening the menu moves focus into it, on the entry for the current style.
  useEffect(() => {
    if (!open) return;
    const current = STYLE_METADATA.findIndex((style) => style.id === styleId);
    itemRefs.current[current === -1 ? 0 : current]?.focus();
  }, [open, styleId]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current;
    const index = items.findIndex((item) => item === document.activeElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const navigate = (id: StyleId) => {
    if (target === "home") {
      navigateToHomeStyle(router, id);
    } else {
      navigateToStyle(router, id, conversationId);
    }
    setOpen(false);
  };

  const currentName =
    STYLE_METADATA.find((style) => style.id === styleId)?.name ?? "Style";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Change UI style, currently ${currentName}`}
        className="neo-button-muted inline-flex h-10 items-center gap-1.5 px-3 text-[10px] font-bold tracking-[0.14em] uppercase"
      >
        {currentName}
        <ChevronDown
          size={12}
          strokeWidth={2.75}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          role="menu"
          onKeyDown={onMenuKeyDown}
          className="neo-panel absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg"
        >
          {STYLE_METADATA.map((style, index) => (
            <button
              key={style.id}
              type="button"
              role="menuitem"
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              onClick={() => navigate(style.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                index < STYLE_METADATA.length - 1 &&
                  "border-b-[2px] border-black dark:border-[#1a0d30]",
              )}
            >
              <span className="flex items-center gap-2 font-bold text-black dark:text-[hsl(var(--neo-ink))]">
                {style.name}
                {style.id === styleId && (
                  <Check size={11} strokeWidth={2.75} />
                )}
              </span>
              <span className="text-[10px] text-[hsl(var(--neo-muted))] dark:text-[hsl(var(--neo-muted))]">
                {style.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
