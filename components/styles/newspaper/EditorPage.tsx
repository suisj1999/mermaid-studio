"use client";

import "./theme.css";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Download,
  FileCode2,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Moon,
  Send,
  Share2,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import Diagram from "~/components/diagram";
import { CodeEditor } from "~/components/code-editor";
import { downloadPng, downloadSvg } from "~/lib/download";
import { locateTextareaLine } from "~/lib/editor/locate-line";
import {
  buildMermaidInitDirective,
  getMermaidThemeVariables,
} from "~/lib/mermaid/config";
import { formatShareUrl } from "~/lib/share/encode";
import { cn } from "~/lib/utils";
import { type EditorPageProps } from "~/components/styles/registry";
import { NewspaperStyleSwitcher } from "~/components/styles/newspaper/style-switcher";
import { styleHomeHref } from "~/components/styles/urls";
import { useConversation } from "~/hooks/use-conversation";
import { useSharedSource } from "~/hooks/use-shared-source";
import { useToast } from "~/hooks/use-toast";

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

function StatusLine({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.18em] text-[hsl(var(--paper-muted))] uppercase">
      {children}
    </span>
  );
}

export default function NewspaperEditorPage({
  styleId,
  conversation,
  autoSaveIntervalMs,
}: EditorPageProps) {
  const {
    conversationId,
    title,
    setTitle,
    source,
    setSource,
    applySource,
    messages,
    modelInfo,
    sendMessage,
    isGenerating,
    error,
    saveState,
  } = useConversation({ initial: conversation, autoSaveIntervalMs });

  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState<"themed" | "raw" | null>(null);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renderedSvgRef = useRef<SVGSVGElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const deferredSource = useDeferredValue(source);

  const stats = useMemo(() => {
    const lines = source.split("\n").length;
    const chars = source.length;
    return { lines, chars };
  }, [source]);

  const { toast, showToast } = useToast();
  useSharedSource(applySource);

  const handleCopy = async (mode: "themed" | "raw") => {
    const text =
      mode === "themed"
        ? `${buildMermaidInitDirective(isDark)}\n${source.trim()}\n`
        : source;
    await navigator.clipboard.writeText(text);
    setCopied(mode);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDownloadSvg = () => {
    const svg = renderedSvgRef.current;
    if (!svg) return;
    downloadSvg(svg, "diagram.svg", {
      backgroundColor: getMermaidThemeVariables(isDark).background,
    });
  };

  const handleDownloadPng = () => {
    const svg = renderedSvgRef.current;
    if (!svg) return;
    void downloadPng(svg, "diagram.png", {
      backgroundColor: getMermaidThemeVariables(isDark).background,
    });
  };

  const handleSelectLine = (line: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    locateTextareaLine(textarea, source, line, setCurrentLine);
  };

  const handleShare = async () => {
    const baseUrl = `${window.location.origin}/editor`;
    const url = formatShareUrl(baseUrl, styleId, {
      v: 1,
      s: source,
      t: isDark ? "dark" : "light",
    });
    history.replaceState(null, "", url);
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = false;
    }
    showToast(
      copied
        ? { message: "Link copied to clipboard", tone: "ok" }
        : {
            message: url.length > 80 ? `${url.slice(0, 77)}…` : url,
            tone: "ok",
          },
    );
  };

  const handleSend = async () => {
    if (!prompt.trim() || isGenerating) return;
    const sent = prompt;
    setPrompt("");
    await sendMessage(sent);
  };

  return (
    <main className="flex max-md:h-auto min-h-screen flex-col bg-[hsl(var(--paper-bg))] font-serif text-[hsl(var(--paper-ink))] md:h-screen">
      {/* Masthead */}
      <header className="border-b border-[hsl(var(--paper-rule))]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-[hsl(var(--paper-ink))] sm:text-3xl">
              Mermaid Studio
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <NewspaperStyleSwitcher
              styleId={styleId}
              target="editor"
              conversationId={conversationId}
            />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--paper-rule))] px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusLine>Editorial · Vol. I · No. 1</StatusLine>
            <StatusLine>{stats.lines} ln · {stats.chars} ch</StatusLine>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusLine>{deferredSource ? "rendered" : "empty"}</StatusLine>
            {modelInfo && (
              <StatusLine>
                {modelInfo.provider} · {modelInfo.model}
              </StatusLine>
            )}
            <div className="flex items-center gap-1">
              <a
                href={styleHomeHref(styleId)}
                aria-label="Back to saved diagrams"
                className="inline-flex h-6 w-6 items-center justify-center text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))]"
              >
                ←
              </a>
              <button
                type="button"
                onClick={handleDownloadSvg}
                disabled={!renderedSvgRef.current}
                aria-label="Download SVG"
                className="inline-flex h-6 w-6 items-center justify-center text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))] disabled:opacity-30"
              >
                <Download size={13} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={!renderedSvgRef.current}
                aria-label="Download PNG"
                className="inline-flex h-6 w-6 items-center justify-center text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))] disabled:opacity-30"
              >
                <ImageIcon size={13} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                aria-label="Share a link to this diagram"
                title="Copies a shareable URL to the clipboard"
                className="inline-flex h-6 w-6 items-center justify-center text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))]"
              >
                <Share2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Workspace: 2-column editorial layout */}
      <div className="relative flex-1 overflow-hidden max-md:overflow-visible">
        <div className="flex h-full max-md:h-auto max-md:flex-col max-md:overflow-visible border-l border-r border-b border-[hsl(var(--paper-rule))]">
          {/* Editor column */}
          <aside
            id="editor-panel"
            aria-label="Editor"
            className={cn(
              "flex shrink-0 flex-col overflow-hidden border-r border-[hsl(var(--paper-rule))] bg-[hsl(var(--paper-panel))] transition-[width,height] duration-300 ease-out",
              // Below md the panes stack, so the editor collapses by height
              // there and by width from md up. Only one height utility is
              // emitted per state: same-variant Tailwind order is not
              // guaranteed to put `h-0` after `h-1/2`.
              panelOpen
                ? "w-[min(28rem,100%)] max-md:w-full max-md:h-auto"
                : "w-0 border-r-0 max-md:h-0",
            )}
          >
            {/* Filename bar */}
            <div className="flex items-center justify-between border-b border-[hsl(var(--paper-rule))] px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2 text-[hsl(var(--paper-muted))]">
                <FileCode2 size={12} strokeWidth={1.5} className="shrink-0" />
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Untitled diagram"
                  aria-label="Diagram title"
                  className="min-w-0 flex-1 border-b border-transparent bg-transparent font-mono text-[12px] tracking-tight text-[hsl(var(--paper-ink))] outline-none placeholder:text-[hsl(var(--paper-faint))] focus:border-[hsl(var(--paper-rule-strong))]"
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] tracking-[0.22em] uppercase">
                <button
                  type="button"
                  onClick={() => void handleCopy("raw")}
                  aria-label="Copy raw Mermaid source"
                  className={cn(
                    "inline-flex min-h-6 items-center justify-center transition-colors",
                    copied === "raw"
                      ? "font-serif text-[12px] italic text-[hsl(var(--paper-accent))]"
                      : "text-[hsl(var(--paper-muted))] hover:text-[hsl(var(--paper-ink))]",
                  )}
                >
                  {copied === "raw" ? "Copied" : "Code"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy("themed")}
                  aria-label="Copy Mermaid source with studio theme"
                  className={cn(
                    "inline-flex min-h-6 items-center justify-center transition-colors",
                    copied === "themed"
                      ? "font-serif text-[12px] italic text-[hsl(var(--paper-accent))]"
                      : "text-[hsl(var(--paper-muted))] hover:text-[hsl(var(--paper-ink))]",
                  )}
                >
                  {copied === "themed" ? "Copied" : "Themed"}
                </button>
              </div>
            </div>

            {/* Editor */}
            <CodeEditor
              ref={textareaRef}
              value={source}
              onChange={setSource}
              currentLine={currentLine}
              onCursorLineChange={setCurrentLine}
              placeholder="Start writing Mermaid..."
              ariaLabel="Mermaid source"
              className="flex-1 max-md:h-56 max-md:flex-none"
            />

            {/* Conversation */}
            <div className="shrink-0 border-t border-[hsl(var(--paper-rule))] p-4">
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare
                  size={12}
                  strokeWidth={1.5}
                  className="text-[hsl(var(--paper-accent))]"
                />
                <span className="font-serif text-[13px] italic text-[hsl(var(--paper-ink))]">
                  Refine the diagram
                </span>
              </div>
              {messages.length > 0 && (
                <div className="mb-2.5 max-h-40 overflow-y-auto border border-[hsl(var(--paper-rule))]">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="border-b border-[hsl(var(--paper-rule))] px-3 py-2 last:border-b-0"
                    >
                      <span className="font-mono text-[9px] tracking-[0.18em] text-[hsl(var(--paper-muted))] uppercase">
                        {message.role === "user" ? "You" : "Assistant"}
                      </span>
                      <p className="mt-0.5 font-sans text-[12px] leading-snug text-[hsl(var(--paper-ink))]">
                        {message.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="e.g. user login flow with OAuth and retry"
                aria-label="Describe the change to apply to the diagram"
                rows={2}
                disabled={isGenerating}
                className="w-full resize-none border border-[hsl(var(--paper-rule))] bg-[hsl(var(--paper-bg))] px-3 py-2 font-sans text-[13px] text-[hsl(var(--paper-ink))] outline-none placeholder:text-[hsl(var(--paper-faint))] focus:border-[hsl(var(--paper-rule-strong))] disabled:opacity-60"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.16em] text-[hsl(var(--paper-muted))] uppercase">
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "dirty"
                      ? "Unsaved"
                      : saveState === "error"
                        ? "Save failed"
                        : saveState === "saved"
                          ? "Saved"
                          : "⌘ + Enter to send"}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!prompt.trim() || isGenerating}
                  className="inline-flex items-center gap-1.5 border border-[hsl(var(--paper-accent))] bg-transparent px-3.5 py-1 font-sans text-[11px] tracking-[0.14em] text-[hsl(var(--paper-accent))] uppercase transition-colors hover:bg-[hsl(var(--paper-accent))] hover:text-[hsl(var(--paper-bg))] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGenerating ? (
                    <>
                      <Loader2
                        size={11}
                        strokeWidth={1.75}
                        className="animate-spin"
                      />
                      Generating
                    </>
                  ) : (
                    <>
                      <Send size={11} strokeWidth={1.75} />
                      Send
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[hsl(var(--paper-muted))]">
                Your description is sent to the configured LLM provider to
                generate the diagram. Don&apos;t paste anything sensitive.
              </p>
              {error && (
                <div
                  role="alert"
                  className="surface-stamp mt-3 flex items-start gap-2 px-3 py-2 text-[11px]"
                >
                  <span className="font-serif text-[10px] tracking-[0.18em] text-[hsl(var(--paper-accent))] uppercase">
                    Error
                  </span>
                  <span className="flex-1">{error}</span>
                </div>
              )}
            </div>
          </aside>

          {/* Preview column */}
          <section
            aria-label="Diagram preview"
            className={cn(
              "flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--paper-bg))]",
              panelOpen ? "max-md:h-[45vh] max-md:flex-none" : "max-md:h-[70vh] max-md:flex-none",
            )}
          >
            <div className="flex items-center justify-between border-b border-[hsl(var(--paper-rule))] px-4 py-2">
              <span className="font-serif text-[12px] italic text-[hsl(var(--paper-muted))]">
                The Diagram
              </span>
              <span className="font-mono text-[10px] tracking-[0.16em] text-[hsl(var(--paper-muted))] uppercase">
                {deferredSource ? "live" : "—"}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <Diagram
                chart={deferredSource}
                renderedSvgRef={renderedSvgRef}
                onSelectLine={handleSelectLine}
                fillHeight
                containerClassName="h-full"
              />
            </div>
          </section>
        </div>

        {/* Editor collapse toggle */}
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-label={panelOpen ? "Collapse editor" : "Expand editor"}
          aria-expanded={panelOpen}
          aria-controls="editor-panel"
          className="absolute top-1/2 left-1 z-30 inline-flex min-h-6 min-w-6 -translate-y-1/2 items-center justify-center px-2 py-2 text-[14px] tracking-[0.22em] uppercase text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))] md:left-2 max-md:top-auto max-md:bottom-2 max-md:left-2 max-md:translate-y-0"
        >
          {panelOpen ? "<" : ">"}
        </button>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="surface-stamp fixed right-4 bottom-4 z-50 max-w-sm px-4 py-2.5 font-serif text-[12px] italic"
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
