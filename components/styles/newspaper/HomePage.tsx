"use client";

import "./theme.css";

import { useEffect, useState } from "react";
import { Loader2, Moon, Plus, Sun, Trash2, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";

import type { HomePageProps } from "~/components/styles/registry";
import { NewspaperStyleSwitcher } from "~/components/styles/newspaper/style-switcher";
import { styleEditorHref } from "~/components/styles/urls";
import { formatRelativeTime } from "~/lib/conversations/format";
import { cn } from "~/lib/utils";
import { useConversationList } from "~/hooks/use-conversation-list";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex min-h-6 min-w-6 items-center justify-center text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))]"
    >
      {mounted && isDark ? (
        <Sun size={14} strokeWidth={1.5} />
      ) : (
        <Moon size={14} strokeWidth={1.5} />
      )}
    </button>
  );
}

export default function NewspaperHomePage({
  styleId,
  conversations,
}: HomePageProps) {
  const {
    items,
    deletingId,
    pendingDeleteId,
    error,
    notice,
    requestDelete,
    confirmDelete,
  } = useConversationList(conversations);

  return (
    <main className="flex min-h-screen flex-col bg-[hsl(var(--paper-bg))] font-serif text-[hsl(var(--paper-ink))]">
      <header className="border-b border-[hsl(var(--paper-rule))]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-[hsl(var(--paper-ink))] sm:text-3xl">
            Mermaid Studio
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <NewspaperStyleSwitcher styleId={styleId} target="home" />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--paper-rule))] px-4 py-2 sm:px-6">
          <span className="font-mono text-[10px] tracking-[0.18em] text-[hsl(var(--paper-muted))] uppercase">
            Saved diagrams
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] text-[hsl(var(--paper-muted))] uppercase">
            {items.length} {items.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-xl font-serif text-[14px] leading-relaxed text-[hsl(var(--paper-muted))]">
            Every diagram you generate is filed here. Open one to keep refining
            it — the conversation remembers where you left off.
          </p>
          <a
            href={styleEditorHref(styleId)}
            className="inline-flex items-center gap-1.5 border border-[hsl(var(--paper-accent))] bg-transparent px-4 py-1.5 font-sans text-[11px] tracking-[0.14em] text-[hsl(var(--paper-accent))] uppercase transition-colors hover:bg-[hsl(var(--paper-accent))] hover:text-[hsl(var(--paper-bg))]"
          >
            <Plus size={12} strokeWidth={1.75} />
            New diagram
          </a>
        </div>

        {notice && (
          <p
            role="status"
            aria-live="polite"
            className="font-mono text-[10px] tracking-[0.16em] text-[hsl(var(--paper-muted))] uppercase"
          >
            {notice}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="surface-stamp flex items-center gap-2 px-3 py-2 text-[11px]"
          >
            <span className="font-serif text-[10px] tracking-[0.18em] text-[hsl(var(--paper-accent))] uppercase">
              Error
            </span>
            <span>{error}</span>
          </div>
        )}

        {items.length === 0 ? (
          <div className="border border-[hsl(var(--paper-rule))] bg-[hsl(var(--paper-panel))] px-6 py-14 text-center">
            <h2 className="font-serif text-[18px] italic text-[hsl(var(--paper-ink))]">
              Nothing has been filed yet.
            </h2>
            <p className="mx-auto mt-2 max-w-sm font-sans text-[12px] leading-relaxed text-[hsl(var(--paper-muted))]">
              Describe a diagram in plain language and it is filed here
              automatically, ready to refine in a follow-up conversation.
            </p>
            <a
              href={styleEditorHref(styleId)}
              className="mt-4 inline-flex items-center gap-1.5 border border-[hsl(var(--paper-accent))] bg-transparent px-4 py-1.5 font-sans text-[11px] tracking-[0.14em] text-[hsl(var(--paper-accent))] uppercase transition-colors hover:bg-[hsl(var(--paper-accent))] hover:text-[hsl(var(--paper-bg))]"
            >
              <Plus size={12} strokeWidth={1.75} />
              New diagram
            </a>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((conversation) => (
              <article
                key={conversation.id}
                className="flex flex-col gap-3 border border-[hsl(var(--paper-rule))] bg-[hsl(var(--paper-card))] p-4 transition-colors hover:border-[hsl(var(--paper-rule-strong))]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-[16px] leading-tight text-[hsl(var(--paper-ink))]">
                    <a
                      href={styleEditorHref(styleId, conversation.id)}
                      className="transition-colors hover:text-[hsl(var(--paper-accent))]"
                    >
                      {conversation.title || "Untitled"}
                    </a>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const label = conversation.title || "Untitled";
                      if (pendingDeleteId === conversation.id) {
                        void confirmDelete(conversation.id, label);
                      } else {
                        requestDelete(conversation.id, label);
                      }
                    }}
                    disabled={deletingId === conversation.id}
                    aria-label={
                      pendingDeleteId === conversation.id
                        ? `Confirm delete ${conversation.title || "Untitled"}`
                        : `Delete ${conversation.title || "Untitled"}`
                    }
                    title={
                      pendingDeleteId === conversation.id
                        ? "Click again to delete for good"
                        : "Delete this diagram"
                    }
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center",
                      "text-[hsl(var(--paper-muted))] transition-colors",
                      "hover:text-[hsl(var(--paper-accent))] disabled:opacity-40",
                      pendingDeleteId === conversation.id &&
                        "text-[hsl(var(--paper-accent))]",
                    )}
                  >
                    {deletingId === conversation.id ? (
                      <Loader2
                        size={12}
                        strokeWidth={1.75}
                        className="animate-spin"
                      />
                    ) : pendingDeleteId === conversation.id ? (
                      <TriangleAlert size={12} strokeWidth={1.75} />
                    ) : (
                      <Trash2 size={12} strokeWidth={1.75} />
                    )}
                  </button>
                </div>

                <p className="font-mono text-[11px] leading-relaxed break-words text-[hsl(var(--paper-muted))] line-clamp-3">
                  {conversation.sourcePreview || "No source yet."}
                </p>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-[hsl(var(--paper-rule))] pt-3">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-[hsl(var(--paper-muted))] uppercase">
                    <time
                      dateTime={new Date(conversation.updatedAt).toISOString()}
                      suppressHydrationWarning
                    >
                      {formatRelativeTime(conversation.updatedAt)}
                    </time>
                    {` · ${conversation.messageCount} msg`}
                  </span>
                  <a
                    href={styleEditorHref(styleId, conversation.id)}
                    className="font-sans text-[11px] tracking-[0.14em] text-[hsl(var(--paper-accent))] uppercase transition-colors hover:text-[hsl(var(--paper-ink))]"
                  >
                    Open →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
