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
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  Github,
  Home,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Moon,
  Send,
  Share2,
  Sun,
  Zap,
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
import { NeoStyleSwitcher } from "~/components/styles/neo-brutalism/style-switcher";
import { styleHomeHref } from "~/components/styles/urls";
import { useConversation } from "~/hooks/use-conversation";
import { useSharedSource } from "~/hooks/use-shared-source";
import { useToast } from "~/hooks/use-toast";

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
        <h1 className="text-[15px] font-bold tracking-tight">
          Mermaid Studio
        </h1>
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

function StatPill({
  icon,
  label,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-700 bg-emerald-200 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100"
      : tone === "warn"
        ? "border-amber-700 bg-amber-200 text-amber-950 dark:border-amber-300 dark:bg-amber-900/40 dark:text-amber-100"
        : "border-black bg-[hsl(var(--neo-subtle-muted))] text-black dark:border-[#1a0d30] dark:text-[hsl(var(--neo-ink))]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border-2 px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] uppercase shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#0d0a19]",
        toneClass,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

export default function NeoBrutalismEditorPage({
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
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!copyMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!copyMenuRef.current?.contains(event.target as Node)) {
        setCopyMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [copyMenuOpen]);

  const handleCopy = async (mode: "themed" | "raw") => {
    const text =
      mode === "themed"
        ? `${buildMermaidInitDirective(isDark)}\n${source.trim()}\n`
        : source;
    await navigator.clipboard.writeText(text);
    setCopied(mode);
    setCopyMenuOpen(false);
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
    // Update the address bar first — even if the clipboard write fails,
    // the recipient can copy the URL from the omnibox.
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
    <main className="neo-page flex max-sm:h-auto min-h-screen flex-col sm:h-screen">
      {/* Header */}
      {/* Below sm the control cluster is taller than the logo, so the header
          stacks instead of leaving the logo stranded mid-column. */}
      <header className="neo-panel-thin m-3 mb-0 flex flex-col items-stretch gap-2 rounded-lg px-4 py-2.5 sm:m-4 sm:mb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
        <Logo />
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          <StatPill
            icon={
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  deferredSource ? "bg-emerald-700" : "bg-zinc-500",
                )}
              />
            }
            label={deferredSource ? "rendered" : "empty"}
            tone={deferredSource ? "ok" : "default"}
          />
          <StatPill
            icon={<span className="opacity-80">≡</span>}
            label={`${stats.lines} ln`}
          />
          <StatPill
            icon={<span className="opacity-80">·</span>}
            label={`${stats.chars} ch`}
          />
          {modelInfo && (
            <StatPill
              icon={<Zap size={10} strokeWidth={2.75} />}
              label={`${modelInfo.provider} · ${modelInfo.model}`}
            />
          )}
          <div className="neo-button-muted inline-flex items-center overflow-hidden rounded-md">
            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={!renderedSvgRef.current}
              aria-label="Download SVG"
              title="Download as SVG (vector, theme baked in)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={12} strokeWidth={2.75} />
              SVG
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!renderedSvgRef.current}
              aria-label="Download PNG"
              title="Download as PNG (raster, 2× for retina)"
              className="inline-flex items-center gap-1.5 border-l-2 border-black px-2.5 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1a0d30]"
            >
              <ImageIcon size={12} strokeWidth={2.75} />
              PNG
            </button>
          </div>
          <div className="neo-button-muted inline-flex items-center overflow-hidden rounded-md">
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label="Share a link to this diagram"
              title="Copies a shareable URL to the clipboard"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold"
            >
              <Share2 size={12} strokeWidth={2.75} />
              Share
            </button>
          </div>
          <a
            href={styleHomeHref(styleId)}
            aria-label="Back to saved diagrams"
            title="Back to saved diagrams"
            className="neo-button-muted inline-flex h-10 w-10 items-center justify-center rounded-md transition-all"
          >
            <Home size={16} strokeWidth={2.5} />
          </a>
          <a
            href="https://github.com/suisj1999/mermaid-studio"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="neo-button-muted inline-flex h-10 w-10 items-center justify-center rounded-md transition-all"
          >
            <Github size={16} strokeWidth={2.5} />
          </a>
          <NeoStyleSwitcher
            styleId={styleId}
            target="editor"
            conversationId={conversationId}
          />
          <ThemeToggle />
        </div>
      </header>

      {/* Workspace: below sm the two panes stack (preview above the editor);
          from sm up the editor floats over the preview and can be collapsed. */}
      <div className="relative flex flex-1 min-h-0 flex-col gap-3 overflow-hidden p-3 pt-3 max-sm:overflow-visible sm:gap-0 sm:p-4 sm:pt-4">
        {/* Preview canvas - shrinks to make room for the editor when expanded on sm+ */}
        <div
          className={cn(
            "neo-panel relative max-sm:h-[45vh] max-sm:flex-none overflow-hidden rounded-lg transition-[left] duration-300 ease-out sm:absolute sm:top-4 sm:right-4 sm:bottom-4",
            panelOpen ? "sm:left-[calc(28rem+1rem)]" : "sm:left-4",
          )}
        >
          <Diagram
            chart={deferredSource}
            renderedSvgRef={renderedSvgRef}
            onSelectLine={handleSelectLine}
            fillHeight
            containerClassName="h-full"
          />
        </div>

        {/* Floating editor panel */}
        <aside
          id="editor-panel"
          aria-label="Editor"
          className={cn(
            "neo-panel relative z-20 flex max-sm:block max-sm:h-auto max-sm:flex-none max-sm:overflow-visible flex-col overflow-hidden rounded-lg transition-transform duration-300 ease-out sm:absolute sm:top-4 sm:bottom-4 sm:left-4 sm:w-[28rem]",
            !panelOpen && "sm:-translate-x-[calc(100%+2rem)]",
          )}
        >
          {/* Filename bar */}
          <div className="flex items-center justify-between border-b-[3px] border-black px-4 py-2.5 dark:border-[#1a0d30]">
            <div className="flex min-w-0 items-center gap-2">
              <FileCode2
                size={14}
                strokeWidth={2.5}
                className="shrink-0 text-black dark:text-[hsl(var(--neo-ink))]"
              />
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Untitled diagram"
                aria-label="Diagram title"
                className="min-w-0 flex-1 border-b-2 border-transparent bg-transparent font-mono text-[13px] font-bold tracking-tight text-black outline-none placeholder:text-[hsl(var(--neo-muted))] focus:border-black dark:text-[hsl(var(--neo-ink))] dark:focus:border-[hsl(var(--neo-ink))]"
              />
            </div>
            <div className="relative" ref={copyMenuRef}>
              <div className="neo-button-muted inline-flex items-center overflow-hidden rounded-md">
                <button
                  type="button"
                  onClick={() => void handleCopy("raw")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold"
                  aria-label="Copy Mermaid source"
                  title="Copies the raw Mermaid source to the clipboard."
                >
                  {copied === "raw" ? (
                    <>
                      <Check size={12} strokeWidth={2.75} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} strokeWidth={2.5} />
                      Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCopyMenuOpen((open) => !open)}
                  className="border-l-2 border-black px-1.5 py-1.5 dark:border-[#1a0d30]"
                  aria-label="More copy options"
                  aria-haspopup="menu"
                  aria-expanded={copyMenuOpen}
                >
                  <ChevronDown
                    size={12}
                    strokeWidth={2.75}
                    className={cn(
                      "transition-transform",
                      copyMenuOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>
              {copyMenuOpen && (
                <div
                  role="menu"
                  className="neo-panel absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleCopy("raw")}
                    className="flex w-full flex-col gap-0.5 border-b-[2px] border-black px-3 py-2 text-left text-xs transition-colors hover:bg-black/5 dark:border-[#1a0d30]"
                  >
                    <span className="font-bold text-black dark:text-[hsl(var(--neo-ink))]">
                      Code only
                    </span>
                    <span className="text-[10px] text-[hsl(var(--neo-muted))] dark:text-[hsl(var(--neo-muted))]">
                      Raw Mermaid, no theme
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleCopy("themed")}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs transition-colors hover:bg-black/5"
                  >
                    <span className="font-bold text-black dark:text-[hsl(var(--neo-ink))]">
                      With studio theme
                    </span>
                    <span className="text-[10px] text-[hsl(var(--neo-muted))] dark:text-[hsl(var(--neo-muted))]">
                      {"Includes %%{init}%% directive"}
                    </span>
                  </button>
                </div>
              )}
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
            className="flex-1 max-sm:h-64"
          />

          {/* Conversation */}
          <div className="shrink-0 border-t-[3px] border-black p-4 dark:border-[#1a0d30]">
            <div className="mb-2.5 flex items-center gap-2">
              <MessageSquare
                size={14}
                strokeWidth={2.5}
                className="text-black dark:text-[hsl(var(--neo-ink))]"
              />
              <span className="text-[10px] font-bold tracking-[0.16em] text-[hsl(var(--neo-soft-text))] uppercase">
                Refine the diagram
              </span>
            </div>
            <div className="neo-panel-thin rounded-md p-3">
              {messages.length > 0 && (
                <div className="neo-panel-thin mb-2.5 max-h-40 overflow-y-auto rounded-md">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="border-b-2 border-black/10 px-2.5 py-2 last:border-b-0 dark:border-white/10"
                    >
                      <span className="text-[9px] font-bold tracking-[0.16em] text-[hsl(var(--neo-muted))] uppercase">
                        {message.role === "user" ? "You" : "Assistant"}
                      </span>
                      <p className="mt-0.5 text-[12px] leading-snug text-black dark:text-[hsl(var(--neo-ink))]">
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
                className="neo-input w-full resize-none rounded-md px-3 py-2 text-[13px] font-medium outline-none placeholder:text-[hsl(var(--neo-muted))] disabled:opacity-60"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold tracking-[0.1em] text-[hsl(var(--neo-muted))] uppercase">
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
                  className="neo-button inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-[1px_1px_0_0_#000]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2
                        size={13}
                        strokeWidth={2.75}
                        className="animate-spin"
                      />
                      Generating
                    </>
                  ) : (
                    <>
                      <Send size={13} strokeWidth={2.75} />
                      Send
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[hsl(var(--neo-muted))]">
                Your description is sent to the configured LLM provider to
                generate the diagram. Don&apos;t paste anything sensitive.
              </p>
              {error && (
                <div
                  role="alert"
                  className="neo-stamp mt-2.5 flex items-start gap-2 rounded-md border-2 border-red-700 bg-red-100 px-3 py-2 text-[11px] text-red-950 shadow-[2px_2px_0_0_#000]"
                >
                  <span className="font-bold uppercase tracking-wider">
                    Error
                  </span>
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Toggle button - always visible */}
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-label={panelOpen ? "Collapse editor" : "Expand editor"}
          aria-expanded={panelOpen}
          aria-controls="editor-panel"
          className={cn(
            "neo-button absolute top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md transition-[left] duration-300 ease-out sm:inline-flex",
            panelOpen ? "sm:left-[calc(28rem+1rem)]" : "left-3 sm:left-4",
          )}
        >
          {panelOpen ? (
            <ChevronLeft size={16} strokeWidth={2.75} />
          ) : (
            <ChevronRight size={16} strokeWidth={2.75} />
          )}
        </button>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="surface-stamp fixed right-4 bottom-4 z-50 max-w-sm rounded-md px-4 py-2.5 text-[12px] font-bold tracking-tight shadow-[3px_3px_0_0_#000] dark:shadow-[3px_3px_0_0_#0d0a19]"
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
