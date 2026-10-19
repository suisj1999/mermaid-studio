"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { useTheme } from "next-themes";

import { DiagramToolbar } from "~/components/diagram-toolbar";
import {
  createHiddenRenderTarget,
  withDomNodesSerializingSafely,
  ZOOM_STEP,
} from "~/components/diagram-helpers";
import {
  buildMermaidConfig,
  MERMAID_SVG_SANITIZE_OPTIONS,
} from "~/lib/mermaid/config";
import {
  enforceSafeMermaidLinks,
  sanitizeMermaidSourceForRender,
} from "~/lib/mermaid/security";
import { useMermaidViewport } from "~/hooks/use-mermaid-viewport";
import { useEffectEvent } from "~/hooks/use-effect-event";
import {
  buildSourceIndex,
  matchKnownId,
} from "~/lib/mermaid/source-index";
import { cn } from "~/lib/utils";

// Mermaid attaches a `window.addEventListener("load", ...)` at import time
// that auto-renders any `.mermaid` element. Disabling it synchronously, before
// the `load` event can fire, keeps React's hydration in charge of the `.mermaid`
// div until the controlled render in useEffect runs. Without this guard, mermaid
// mutates the DOM during hydration and React reports a mismatch.
if (typeof window !== "undefined") {
  mermaid.initialize({ startOnLoad: false });
}

interface DiagramProps {
  /** Mermaid source to render. Empty / whitespace / comment-only input is treated as "nothing to render" (cleared preview, no toast). */
  chart: string;
  /** When true, attaches the pan/zoom interaction layer + toolbar. Defaults to true. */
  zoomingEnabled?: boolean;
  /** Called once per unique render error with the underlying Mermaid error message. */
  onRenderError?: (message: string) => void;
  /** Called once per successful render, after the SVG has been laid out and fitted. */
  onRenderComplete?: () => void;
  /**
   * Called when the user clicks a node / edge in the rendered SVG with the
   * 1-indexed source line that defines it. Wiring is opt-in — hosts that
   * don't pass this callback render a non-interactive preview.
   */
  onSelectLine?: (line: number) => void;
  /** Class merged into the outer wrapper. */
  containerClassName?: string;
  /** Class merged into the inner SVG-bearing element. */
  diagramClassName?: string;
  /** Optional CSS background color overriding the theme's default. */
  backgroundColor?: string;
  /** When `zoomingEnabled` is false, scale the diagram to fit without an interaction layer. */
  fitToContainer?: boolean;
  /** Forwarded ref exposing the rendered SVG, used by the host's download buttons. */
  renderedSvgRef?: RefObject<SVGSVGElement | null>;
  /** Fill the parent height instead of the default `70vh` cap. */
  fillHeight?: boolean;
}

const INTERACTIVE_FIT_PADDING = 24;
const PREVIEW_FIT_PADDING = 16;
const INTERACTIVE_VIEWER_PROPS = {
  "aria-label": "Interactive diagram viewer",
  role: "region",
  tabIndex: 0,
};

// After sanitization, the source may be empty (cleared textarea) or only
// contain a `%%{init}%%` directive / `%%` comments — Mermaid's parser throws
// `UnknownDiagramError` on empty input. Treat those as "nothing to render"
// rather than an error.
function hasRenderableContent(source: string): boolean {
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("%%")) return true;
  }
  return false;
}

// First word of a diagram must be one of these for Mermaid to recognize it.
// Anything else (e.g. a stray prose sentence typed into the editor) is treated
// as "no diagram" — we clear the preview instead of letting Mermaid throw
// `UnknownDiagramError` into the console.
const MERMAID_TYPE_STARTERS = [
  "graph",
  "flowchart",
  "sequencediagram",
  "classdiagram",
  "statediagram",
  "statediagram-v2",
  "erdiagram",
  "journey",
  "gantt",
  "pie",
  "quadrantchart",
  "requirementdiagram",
  "gitgraph",
  "mindmap",
  "timeline",
  "zenuml",
  "sankey",
  "xychart",
  "block",
  "packet",
  "kanban",
  "architecture",
  "radar",
  "c4context",
  "c4container",
  "c4component",
  "c4dynamic",
  "c4deployment",
] as const;

function looksLikeMermaidDiagram(source: string): boolean {
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("%%")) continue;
    const firstWord = line.split(/\s+/, 1)[0]?.toLowerCase();
    if (!firstWord) return false;
    return (MERMAID_TYPE_STARTERS as readonly string[]).includes(firstWord);
  }
  return false;
}

/**
 * Controlled Mermaid renderer.
 *
 * Re-renders whenever `chart`, theme, or `backgroundColor` changes; sanitizes
 * the resulting SVG (DOMPurify + a post-pass URL allowlist); and (optionally)
 * drives a pan/zoom interaction layer through `useMermaidViewport`.
 *
 * Module-load note: also installs `mermaid.initialize({ startOnLoad: false })`
 * synchronously so Mermaid's auto-render at the `window.load` event can't
 * race React hydration.
 */
const Diagram = ({
  chart,
  zoomingEnabled = true,
  onRenderError,
  onRenderComplete,
  onSelectLine,
  containerClassName,
  diagramClassName,
  backgroundColor,
  fitToContainer = false,
  renderedSvgRef,
  fillHeight = false,
}: DiagramProps) => {
  const reportedRenderErrorRef = useRef<string | null>(null);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const fitPadding = zoomingEnabled
    ? INTERACTIVE_FIT_PADDING
    : fitToContainer
      ? PREVIEW_FIT_PADDING
      : 0;
  const {
    containerRef,
    diagramRef,
    disconnectResizeObserver,
    fitDiagram,
    formattedZoom,
    handleClickCapture,
    handleDragStart,
    handleKeyDown,
    handleLostPointerCapture,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    interactionLayerRef,
    isPanZoomReady,
    prepareForRender,
    stepZoom,
  } = useMermaidViewport({
    fitPadding,
    fitToContainer,
    onRenderComplete,
    renderVersion,
    zoomingEnabled,
  });

  const reportRenderError = useEffectEvent((message: string) => {
    onRenderError?.(message);
  });

  // Stable wrapper so the click-listener effect doesn't re-subscribe every
  // time the host re-renders (the host passes a fresh closure each time).
  const hasSelectLine = onSelectLine !== undefined;
  const selectLine = useEffectEvent((line: number) => {
    onSelectLine?.(line);
  });

  useEffect(() => {
    let cancelled = false;

    const baseConfig = buildMermaidConfig({ isDark, backgroundColor });

    const renderDiagram = async () => {
      const mermaidElement = diagramRef.current;
      if (!(mermaidElement instanceof HTMLDivElement)) return;

      setRenderMessage(null);
      prepareForRender();
      mermaid.initialize(baseConfig);
      mermaidElement.removeAttribute("data-processed");
      const renderTarget = createHiddenRenderTarget(
        Math.round(
          mermaidElement.getBoundingClientRect().width ||
            containerRef.current?.getBoundingClientRect().width ||
            window.innerWidth,
        ),
      );

      try {
        const renderId = `mermaid-${Math.random().toString(36).slice(2)}`;
        const safeChart = sanitizeMermaidSourceForRender(chart);
        if (
          !hasRenderableContent(safeChart) ||
          !looksLikeMermaidDiagram(safeChart)
        ) {
          if (cancelled) return;
          mermaidElement.textContent = "";
          if (renderedSvgRef) renderedSvgRef.current = null;
          return;
        }
        const { svg, bindFunctions } = await withDomNodesSerializingSafely(() =>
          mermaid.render(renderId, safeChart, renderTarget),
        );
        if (cancelled) return;

        mermaidElement.textContent = "";
        mermaidElement.innerHTML = DOMPurify.sanitize(
          svg,
          MERMAID_SVG_SANITIZE_OPTIONS,
        );
        enforceSafeMermaidLinks(mermaidElement);
        bindFunctions?.(mermaidElement);
        if (renderedSvgRef) {
          renderedSvgRef.current = mermaidElement.querySelector("svg");
        }
        setRenderVersion((currentVersion) => currentVersion + 1);
      } catch (error) {
        if (cancelled) return;
        console.error("Mermaid render failed:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Mermaid render error.";
        if (renderedSvgRef) {
          renderedSvgRef.current = null;
        }
        setRenderMessage(`Mermaid render failed: ${message}`);
        const reportKey = `${chart}::${message}`;
        if (reportedRenderErrorRef.current !== reportKey) {
          reportedRenderErrorRef.current = reportKey;
          reportRenderError(message);
        }
      } finally {
        renderTarget.remove();
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
      disconnectResizeObserver();
    };
  }, [
    backgroundColor,
    chart,
    containerRef,
    diagramRef,
    disconnectResizeObserver,
    isDark,
    prepareForRender,
    renderedSvgRef,
  ]);

  useEffect(() => {
    if (!hasSelectLine) return;
    const svg = diagramRef.current?.querySelector("svg");
    if (!svg) return;

    // Index the *raw* source, not the sanitized one. The editor shows the
    // user's own text, so line numbers have to line up with that text.
    // Sanitizing first would drop `%%{init}` blocks, unsafe `click`
    // directives and rejoin wrapped `classDef` lines — every one of those
    // shifts the line numbering and sends the click to the wrong row.
    const index = buildSourceIndex(chart);
    if (index.length === 0) return;
    const knownIds = new Set(index.map((entry) => entry.id));

    const handleClick = (event: MouseEvent) => {
      let target = event.target as Element | null;
      while (target && target !== svg) {
        const id = target.getAttribute?.("id");
        if (id) {
          const matchedId = matchKnownId(id, knownIds);
          if (matchedId) {
            const entry = index.find((entry) => entry.id === matchedId);
            if (entry) {
              selectLine(entry.line);
              return;
            }
          }
        }
        target = target.parentElement;
      }
    };

    svg.addEventListener("click", handleClick);
    for (const part of svg.querySelectorAll("[id]")) {
      const id = part.getAttribute("id");
      if (id && matchKnownId(id, knownIds)) {
        (part as SVGElement).style.cursor = "pointer";
      }
    }
    return () => {
      svg.removeEventListener("click", handleClick);
    };
  }, [chart, diagramRef, hasSelectLine, renderVersion, selectLine]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full p-4",
        zoomingEnabled &&
          !fillHeight &&
          "h-[70vh] max-h-[52rem] min-h-[22rem]",
        fillHeight && "h-full",
        containerClassName,
      )}
    >
      {renderMessage && (
        <div className="surface-stamp mb-3 rounded-md border-2 border-amber-700 bg-amber-100 px-3 py-2 text-[12px] text-amber-950">
          {renderMessage}
        </div>
      )}
      <div
        ref={interactionLayerRef}
        {...(zoomingEnabled ? INTERACTIVE_VIEWER_PROPS : {})}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative h-full",
          zoomingEnabled
            ? "touch-none"
            : "touch-pan-x touch-pan-y touch-pinch-zoom",
          (zoomingEnabled || fitToContainer) && "overflow-hidden",
          zoomingEnabled &&
            "surface-interactive-layer cursor-grab rounded-md select-none data-[dragging=true]:cursor-grabbing [&_*]:select-none",
        )}
        onClickCapture={handleClickCapture}
        onDragStart={handleDragStart}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {zoomingEnabled && (
          <DiagramToolbar
            formattedZoom={formattedZoom}
            isPanZoomReady={isPanZoomReady}
            onFit={() => fitDiagram(true, true)}
            onZoomIn={() => stepZoom(ZOOM_STEP)}
            onZoomOut={() => stepZoom(1 / ZOOM_STEP)}
          />
        )}
        <div
          ref={diagramRef}
          className={cn(
            "mermaid text-foreground [&_svg]:mx-auto [&_svg]:block [&_svg]:max-w-full [&_svg]:overflow-visible",
            !isPanZoomReady && "invisible",
            zoomingEnabled && "[&_svg]:h-auto [&_svg]:w-auto",
            !zoomingEnabled && "[&_svg]:h-auto",
            diagramClassName,
          )}
        />
      </div>
    </div>
  );
};

export default Diagram;
