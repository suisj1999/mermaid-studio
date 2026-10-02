"use client";

import { Minus, Plus, ScanSearch } from "lucide-react";

interface DiagramToolbarProps {
  /** Current zoom label to display, e.g. "100%". */
  formattedZoom: string;
  /** When false, disables every button until the diagram is laid out. */
  isPanZoomReady: boolean;
  /** Fit the diagram to the container, respecting readable font size. */
  onFit: () => void;
  /** Zoom in by one `ZOOM_STEP`. */
  onZoomIn: () => void;
  /** Zoom out by one `ZOOM_STEP`. */
  onZoomOut: () => void;
}

/**
 * Floating zoom toolbar (zoom out / label / zoom in + fit-to-screen) for the
 * interactive diagram. The host component owns the viewport state and the
 * actual fit/zoom logic; this component just renders buttons with the
 * right `data-diagram-toolbar` attribute so the parent can skip gesture
 * detection on clicks inside it.
 */
export function DiagramToolbar({
  formattedZoom,
  isPanZoomReady,
  onFit,
  onZoomIn,
  onZoomOut,
}: DiagramToolbarProps) {
  return (
    <div
      data-diagram-toolbar
      className="pointer-events-none absolute top-4 right-4 z-10 flex items-center gap-2"
    >
      <div className="surface-button-muted pointer-events-auto inline-flex items-center overflow-hidden rounded-md">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!isPanZoomReady}
          className="flex h-9 w-9 items-center justify-center text-black transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-black/5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#0d0a19]"
          onClick={onZoomOut}
        >
          <Minus size={15} strokeWidth={2.75} />
        </button>
        <div className="min-w-14 border-x-2 border-black px-2.5 text-center text-[10px] font-bold tracking-[0.16em] text-black uppercase dark:border-[#1a0d30] dark:text-[#0d0a19]">
          {formattedZoom}
        </div>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!isPanZoomReady}
          className="flex h-9 w-9 items-center justify-center text-black transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-black/5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#0d0a19]"
          onClick={onZoomIn}
        >
          <Plus size={15} strokeWidth={2.75} />
        </button>
      </div>
      <button
        type="button"
        disabled={!isPanZoomReady}
        className="surface-button-muted pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[10px] font-bold tracking-[0.16em] text-black uppercase active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#0d0a19]"
        onClick={onFit}
      >
        <ScanSearch size={14} strokeWidth={2.75} />
        Fit
      </button>
    </div>
  );
}
