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
  Moon,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import Diagram from "~/components/diagram";
import { CodeEditor } from "~/components/code-editor";
import { downloadPng, downloadSvg } from "~/lib/download";
import {
  buildMermaidInitDirective,
  getMermaidThemeVariables,
} from "~/lib/mermaid/config";
import { cn } from "~/lib/utils";
import {
  DEFAULT_STYLE_ID,
  STYLE_METADATA,
  isKnownStyleId,
  type StyleId,
} from "~/components/styles/registry";

const DEFAULT_SOURCE = `graph TD
  A[User] --> B{Authenticated?}
  B -->|yes| C[Dashboard]
  B -->|no| D[Login Page]
  D --> E[OAuth Provider]
  E --> B`;

function useCurrentStyle(): StyleId {
  const params = useSearchParams();
  const raw = params.get("ui-style");
  return isKnownStyleId(raw) ? raw : DEFAULT_STYLE_ID;
}

function navigateToStyle(router: ReturnType<typeof useRouter>, id: StyleId) {
  const target = id === DEFAULT_STYLE_ID ? "/" : `/?ui-style=${id}`;
  router.replace(target);
}

function StyleSwitcher() {
  const router = useRouter();
  const current = useCurrentStyle();

  return (
    <nav
      aria-label="UI style"
      className="flex items-center gap-3 text-[10px] tracking-[0.22em] uppercase"
    >
      {STYLE_METADATA.map((style) => {
        const isActive = style.id === current;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => navigateToStyle(router, style.id)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "transition-colors",
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

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))]"
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

export default function NewspaperPage() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<{
    provider: string;
    model: string;
  } | null>(null);
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
    const lines = source.split("\n");
    let start = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      start += lines[i].length + 1;
    }
    const lineLength = lines[line - 1]?.length ?? 0;
    textarea.setSelectionRange(start, start + lineLength);
    const lineHeight =
      parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    textarea.scrollTop = Math.max(0, (line - 3) * lineHeight);
    setCurrentLine(line);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (data.error) throw new Error(data.error);
      if (data.mermaid) {
        setSource(data.mermaid);
      }
      if (data.provider && data.model) {
        setModelInfo({ provider: data.provider, model: data.model });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex h-screen flex-col font-serif">
      {/* Masthead */}
      <header className="border-b border-[hsl(var(--paper-rule))]">
        <div className="flex items-baseline justify-between gap-6 px-6 pt-5 pb-3">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-3xl font-medium tracking-tight text-[hsl(var(--paper-ink))]">
              Mermaid Studio
            </h1>
          </div>
          <div className="flex items-center gap-5">
            <StyleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--paper-rule))] px-6 py-2">
          <div className="flex items-center gap-4">
            <StatusLine>Editorial · Vol. I · No. 1</StatusLine>
            <StatusLine>{stats.lines} ln · {stats.chars} ch</StatusLine>
          </div>
          <div className="flex items-center gap-4">
            <StatusLine>{deferredSource ? "rendered" : "empty"}</StatusLine>
            {modelInfo && (
              <StatusLine>
                {modelInfo.provider} · {modelInfo.model}
              </StatusLine>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDownloadSvg}
                disabled={!renderedSvgRef.current}
                aria-label="Download SVG"
                className="text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))] disabled:opacity-30"
              >
                <Download size={13} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={!renderedSvgRef.current}
                aria-label="Download PNG"
                className="text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))] disabled:opacity-30"
              >
                <ImageIcon size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Workspace: 2-column editorial layout */}
      <div className="relative flex-1 overflow-hidden">
        <div className="flex h-full overflow-hidden border-l border-r border-b border-[hsl(var(--paper-rule))]">
          {/* Editor column */}
          <aside
            id="editor-panel"
            aria-label="Editor"
            className={cn(
              "flex w-[min(28rem,100%)] shrink-0 flex-col overflow-hidden border-r border-[hsl(var(--paper-rule))] bg-[hsl(var(--paper-panel))] transition-[width] duration-300 ease-out",
              !panelOpen && "w-0 border-r-0",
            )}
          >
            {/* Filename bar */}
            <div className="flex items-center justify-between border-b border-[hsl(var(--paper-rule))] px-4 py-2.5">
              <div className="flex items-center gap-2 text-[hsl(var(--paper-muted))]">
                <FileCode2 size={12} strokeWidth={1.5} />
                <span className="font-mono text-[12px] tracking-tight">
                  diagram.mmd
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] tracking-[0.22em] uppercase">
                <button
                  type="button"
                  onClick={() => void handleCopy("raw")}
                  aria-label="Copy raw Mermaid source"
                  className={cn(
                    "transition-colors",
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
                    "transition-colors",
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
              className="flex-1"
            />

            {/* Generator */}
            <div className="border-t border-[hsl(var(--paper-rule))] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Wand2 size={12} strokeWidth={1.5} className="text-[hsl(var(--paper-accent))]" />
                <span className="font-serif text-[13px] italic text-[hsl(var(--paper-ink))]">
                  Generate from description
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder="e.g. user login flow with OAuth and retry"
                rows={2}
                disabled={isGenerating}
                className="w-full resize-none border border-[hsl(var(--paper-rule))] bg-[hsl(var(--paper-bg))] px-3 py-2 font-sans text-[13px] text-[hsl(var(--paper-ink))] outline-none placeholder:text-[hsl(var(--paper-faint))] focus:border-[hsl(var(--paper-rule-strong))] disabled:opacity-60"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.16em] text-[hsl(var(--paper-muted))] uppercase">
                  ⌘ + Enter to send
                </span>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
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
                      <Sparkles size={11} strokeWidth={1.75} />
                      Generate
                    </>
                  )}
                </button>
              </div>
              {error && (
                <div className="surface-stamp mt-3 flex items-start gap-2 px-3 py-2 text-[11px]">
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
            className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--paper-bg))]"
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
          className="absolute top-1/2 left-1 z-30 -translate-y-1/2 px-2 py-2 text-[14px] tracking-[0.22em] uppercase text-[hsl(var(--paper-muted))] transition-colors hover:text-[hsl(var(--paper-ink))] md:left-2"
        >
          {panelOpen ? "<" : ">"}
        </button>
      </div>
    </main>
  );
}
