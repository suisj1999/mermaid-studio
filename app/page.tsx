"use client";

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
  ExternalLink,
  FileCode2,
  Github,
  Image as ImageIcon,
  Loader2,
  Moon,
  Sparkles,
  Sun,
  Wand2,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import Diagram from "~/components/diagram";
import { downloadPng, downloadSvg } from "~/lib/download";
import { buildMermaidInitDirective } from "~/lib/mermaid/config";
import { cn } from "~/lib/utils";

const DEFAULT_SOURCE = `graph TD
  A[User] --> B{Authenticated?}
  B -->|yes| C[Dashboard]
  B -->|no| D[Login Page]
  D --> E[OAuth Provider]
  E --> B`;

type Example = {
  label: string;
  category: string;
  source: string;
};

const EXAMPLES: Example[] = [
  {
    label: "User login flow",
    category: "flow",
    source: `graph TD
  U[User] --> L[Login Page]
  L --> V{Validate}
  V -->|ok| D[Dashboard]
  V -->|fail| R[Retry]
  R --> V`,
  },
  {
    label: "Microservices + queue",
    category: "architecture",
    source: `graph LR
  G[API Gateway] --> O[Order Service]
  O --> Q[Message Queue]
  Q --> P[Payment Service]
  Q --> I[Inventory Service]`,
  },
  {
    label: "TCP handshake",
    category: "sequence",
    source: `sequenceDiagram
  participant C as Client
  participant S as Server
  C->>S: SYN
  S-->>C: SYN-ACK
  C->>S: ACK`,
  },
  {
    label: "Order class hierarchy",
    category: "class",
    source: `classDiagram
  class Order {
    +id: string
    +total: number
    +pay() bool
  }
  class OnlineOrder
  class InStoreOrder
  Order <|-- OnlineOrder
  Order <|-- InStoreOrder`,
  },
  {
    label: "State machine",
    category: "state",
    source: `stateDiagram-v2
  [*] --> Draft
  Draft --> Review: submit
  Review --> Approved
  Review --> Draft: request changes
  Approved --> [*]`,
  },
  {
    label: "ER: blog schema",
    category: "er",
    source: `erDiagram
  USER ||--o{ POST : writes
  POST ||--o{ COMMENT : has
  USER ||--o{ COMMENT : writes`,
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
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
        <span className="text-[15px] font-bold tracking-tight">
          Mermaid Studio
        </span>
        <span className="text-[10px] font-semibold tracking-[0.16em] text-[hsl(var(--neo-soft-text))] uppercase">
          describe · generate · render
        </span>
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
      aria-label="Toggle theme"
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

function ExampleCard({
  example,
  onSelect,
  active,
}: {
  example: Example;
  onSelect: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "neo-chip group inline-flex items-center justify-between rounded-md px-3 py-1.5 text-left text-[12px]",
        active && "translate-x-[-1px] translate-y-[-1px] shadow-[3px_3px_0_0_#000]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-black">{example.label}</span>
        <span className="rounded-sm border border-black/30 bg-black/10 px-1 text-[9px] font-bold tracking-wider text-black uppercase">
          {example.category}
        </span>
      </div>
      <ChevronRight
        size={12}
        strokeWidth={2.75}
        className="transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

export default function Page() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<{
    provider: string;
    model: string;
  } | null>(null);
  const [copied, setCopied] = useState<"themed" | "raw" | null>(null);
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

  const handleSelectExample = (example: Example) => {
    setSource(example.source);
    setActiveExample(example.label);
  };

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
    downloadSvg(svg, "diagram.svg");
  };

  const handleDownloadPng = () => {
    const svg = renderedSvgRef.current;
    if (!svg) return;
    void downloadPng(svg, "diagram.png");
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
        setActiveExample(null);
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
    <main className="flex h-screen flex-col">
      {/* Header */}
      <header className="neo-panel-thin m-3 mb-0 flex items-center justify-between rounded-lg px-4 py-2.5 sm:m-4 sm:mb-0 sm:px-5">
        <Logo />
        <div className="flex items-center gap-2">
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
          <a
            href="https://mermaid.js.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="neo-button-muted hidden h-10 items-center gap-1.5 rounded-md px-3 text-xs font-semibold sm:inline-flex"
          >
            Mermaid docs
            <ExternalLink size={12} strokeWidth={2.5} />
          </a>
          <a
            href="https://github.com/ahmedkhaleel2004/gitdiagram"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="neo-button-muted inline-flex h-10 w-10 items-center justify-center rounded-md transition-all"
          >
            <Github size={16} strokeWidth={2.5} />
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* Workspace: preview fills, editor floats over it */}
      <div className="relative flex-1 min-h-0 overflow-hidden p-3 pt-3 sm:p-4 sm:pt-4">
        {/* Preview canvas - fills the entire workspace */}
        <div className="neo-panel absolute inset-3 overflow-hidden rounded-lg sm:inset-4">
          <Diagram
            chart={deferredSource}
            renderedSvgRef={renderedSvgRef}
            fillHeight
            containerClassName="h-full"
          />
        </div>

        {/* Floating editor panel */}
        <aside
          id="editor-panel"
          aria-label="Editor"
          className={cn(
            "neo-panel absolute top-3 bottom-3 left-3 z-20 flex w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg transition-transform duration-300 ease-out sm:top-4 sm:bottom-4 sm:left-4",
            !panelOpen && "-translate-x-[calc(100%+1.5rem)] sm:-translate-x-[calc(100%+2rem)]",
          )}
        >
          {/* Filename bar */}
          <div className="flex items-center justify-between border-b-[3px] border-black px-4 py-2.5 dark:border-[#1a0d30]">
            <div className="flex items-center gap-2">
              <FileCode2
                size={14}
                strokeWidth={2.5}
                className="text-black dark:text-[hsl(var(--neo-ink))]"
              />
              <span className="font-mono text-[13px] font-bold tracking-tight text-black dark:text-[hsl(var(--neo-ink))]">
                diagram.mmd
              </span>
              <StatPill
                icon={<span className="opacity-80">≡</span>}
                label={`${stats.lines} ln`}
              />
              <StatPill
                icon={<span className="opacity-80">·</span>}
                label={`${stats.chars} ch`}
              />
            </div>
            <div className="relative" ref={copyMenuRef}>
              <div className="neo-button-muted inline-flex items-center overflow-hidden rounded-md">
                <button
                  type="button"
                  onClick={() => void handleCopy("themed")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold"
                  aria-label="Copy source with studio theme"
                  title="Copies code with a %%{init}%% directive so the diagram keeps this studio's look in any Mermaid renderer."
                >
                  {copied === "themed" ? (
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
                    onClick={() => void handleCopy("themed")}
                    className="flex w-full flex-col gap-0.5 border-b-[2px] border-black px-3 py-2 text-left text-xs transition-colors hover:bg-black/5 dark:border-[#1a0d30]"
                  >
                    <span className="font-bold text-black dark:text-[hsl(var(--neo-ink))]">
                      With studio theme
                    </span>
                    <span className="text-[10px] text-[hsl(var(--neo-muted))] dark:text-[hsl(var(--neo-muted))]">
                      Includes %%{init}%% directive
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleCopy("raw")}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs transition-colors hover:bg-black/5"
                  >
                    <span className="font-bold text-black dark:text-[hsl(var(--neo-ink))]">
                      Code only
                    </span>
                    <span className="text-[10px] text-[hsl(var(--neo-muted))] dark:text-[hsl(var(--neo-muted))]">
                      Raw Mermaid, no theme
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="relative flex-1 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setActiveExample(null);
              }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="h-full w-full resize-none bg-[hsl(var(--neo-input-bg))] px-5 py-4 font-mono text-[13px] leading-6 text-black outline-none placeholder:text-[hsl(var(--neo-muted))] dark:bg-[hsl(var(--neo-input-bg))] dark:text-[hsl(var(--neo-ink))]"
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Examples strip */}
          <div className="border-t-[3px] border-black px-4 py-3 dark:border-[#1a0d30]">
            <div className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[hsl(var(--neo-soft-text))] uppercase">
              Try these examples
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <ExampleCard
                  key={example.label}
                  example={example}
                  active={activeExample === example.label}
                  onSelect={() => handleSelectExample(example)}
                />
              ))}
            </div>
          </div>

          {/* Generator card */}
          <div className="border-t-[3px] border-black p-4 dark:border-[#1a0d30]">
            <div className="mb-2.5 flex items-center gap-2">
              <Wand2
                size={14}
                strokeWidth={2.5}
                className="text-black dark:text-[hsl(var(--neo-ink))]"
              />
              <span className="text-[10px] font-bold tracking-[0.16em] text-[hsl(var(--neo-soft-text))] uppercase">
                Generate from description
              </span>
            </div>
            <div className="neo-panel-thin rounded-md p-3">
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
                className="neo-input w-full resize-none rounded-md px-3 py-2 text-[13px] font-medium outline-none placeholder:text-[hsl(var(--neo-muted))] disabled:opacity-60"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold tracking-[0.1em] text-[hsl(var(--neo-muted))] uppercase">
                  ⌘ + Enter to send
                </span>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
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
                      <Sparkles size={13} strokeWidth={2.75} />
                      Generate
                    </>
                  )}
                </button>
              </div>
              {error && (
                <div className="neo-stamp mt-2.5 flex items-start gap-2 rounded-md border-2 border-red-700 bg-red-100 px-3 py-2 text-[11px] text-red-950 shadow-[2px_2px_0_0_#000]">
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
            "neo-button absolute top-1/2 z-30 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md transition-[left] duration-300 ease-out",
            panelOpen
              ? "left-[calc(28rem+0.75rem)] sm:left-[calc(28rem+1rem)]"
              : "left-3 sm:left-4",
          )}
        >
          {panelOpen ? (
            <ChevronLeft size={16} strokeWidth={2.75} />
          ) : (
            <ChevronRight size={16} strokeWidth={2.75} />
          )}
        </button>
      </div>
    </main>
  );
}
