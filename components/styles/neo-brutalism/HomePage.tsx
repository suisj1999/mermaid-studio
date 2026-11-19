"use client";

import "./theme.css";

import { useEffect, useState } from "react";
import { Loader2, Moon, Plus, Sun, Trash2, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";

import type { HomePageProps } from "~/components/styles/registry";
import { NeoStyleSwitcher } from "~/components/styles/neo-brutalism/style-switcher";
import { styleEditorHref } from "~/components/styles/urls";
import { formatRelativeTime } from "~/lib/conversations/format";
import { cn } from "~/lib/utils";
import { useConversationList } from "~/hooks/use-conversation-list";

function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-md border-[2px] border-black bg-[hsl(var(--neo-button))] text-black shadow-[3px_3px_0_0_#000] dark:border-[#1a0d30] dark:shadow-[3px_3px_0_0_#0d0a19]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="M7 14l3-3 3 3 5-6" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <h1 className="text-[15px] font-bold tracking-tight">Mermaid Studio</h1>
      </div>
    </div>
  );
}

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
      className="neo-button-muted inline-flex h-10 w-10 items-center justify-center rounded-md transition-all"
    >
      {mounted ? (
        isDark ? (
          <Sun size={16} strokeWidth={2.5} />
        ) : (
          <Moon size={16} strokeWidth={2.5} />
        )
      ) : (
        <Sun size={16} strokeWidth={2.5} className="opacity-0" />
      )}
    </button>
  );
}

export default function NeoBrutalismHomePage({
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
    <main className="neo-page flex min-h-screen flex-col">
      <header className="neo-panel-thin m-3 mb-0 flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 sm:m-4 sm:mb-0 sm:px-5">
        <Logo />
        <div className="flex items-center gap-2">
          <NeoStyleSwitcher styleId={styleId} target="home" />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-3 pt-6 sm:p-4 sm:pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-black uppercase dark:text-[hsl(var(--neo-ink))]">
              Saved diagrams
            </h2>
            <p className="mt-1.5 text-[12px] text-[hsl(var(--neo-muted))]">
              {items.length === 0
                ? "Every diagram you generate is kept here."
                : `${items.length} ${items.length === 1 ? "diagram" : "diagrams"} saved.`}
            </p>
            {notice && (
              <p
                role="status"
                aria-live="polite"
                className="mt-1.5 text-[11px] font-bold tracking-[0.12em] text-[hsl(var(--neo-muted))] uppercase"
              >
                {notice}
              </p>
            )}
          </div>
          <a
            href={styleEditorHref(styleId)}
            className="neo-button inline-flex items-center gap-2 rounded-md px-4 py-2 text-[12px] font-bold tracking-[0.1em] uppercase"
          >
            <Plus size={14} strokeWidth={2.75} />
            New diagram
          </a>
        </div>

        {error && (
          <div
            role="alert"
            className="neo-stamp flex items-center gap-2 rounded-md px-3 py-2 text-[11px]"
          >
            <span className="font-bold uppercase tracking-wider">Error</span>
            <span>{error}</span>
          </div>
        )}

        {items.length === 0 ? (
          <div className="neo-panel flex flex-col items-center gap-3 rounded-lg px-6 py-14 text-center">
            <h3 className="text-[14px] font-bold tracking-tight text-black uppercase dark:text-[hsl(var(--neo-ink))]">
              Nothing here yet
            </h3>
            <p className="max-w-sm text-[12px] text-[hsl(var(--neo-muted))]">
              Describe a diagram in plain language and it is saved here
              automatically, ready to refine in a follow-up conversation.
            </p>
            <a
              href={styleEditorHref(styleId)}
              className="neo-button mt-1 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[12px] font-bold tracking-[0.1em] uppercase"
            >
              <Plus size={14} strokeWidth={2.75} />
              New diagram
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((conversation) => (
              <article
                key={conversation.id}
                className="neo-panel flex flex-col gap-3 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] leading-tight font-bold tracking-tight text-black uppercase dark:text-[hsl(var(--neo-ink))]">
                    <a
                      href={styleEditorHref(styleId, conversation.id)}
                      className="transition-colors hover:text-[hsl(var(--neo-link))]"
                    >
                      {conversation.title || "Untitled"}
                    </a>
                  </h3>
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
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      pendingDeleteId === conversation.id
                        ? "neo-stamp px-0"
                        : "neo-button-muted",
                    )}
                  >
                    {deletingId === conversation.id ? (
                      <Loader2
                        size={13}
                        strokeWidth={2.75}
                        className="animate-spin"
                      />
                    ) : pendingDeleteId === conversation.id ? (
                      <TriangleAlert size={13} strokeWidth={2.75} />
                    ) : (
                      <Trash2 size={13} strokeWidth={2.75} />
                    )}
                  </button>
                </div>

                <p className="font-mono text-[11px] leading-relaxed break-words text-[hsl(var(--neo-muted))] line-clamp-3">
                  {conversation.sourcePreview || "No source yet."}
                </p>

                <div className="mt-auto flex items-center justify-between gap-3 border-t-2 border-black pt-3 dark:border-[#1a0d30]">
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-[hsl(var(--neo-muted))] uppercase">
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
                    className={cn(
                      "neo-button inline-flex items-center rounded-md px-3 py-1.5",
                      "text-[11px] font-bold tracking-[0.1em] uppercase",
                    )}
                  >
                    Open
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
