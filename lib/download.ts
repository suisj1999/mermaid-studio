"use client";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

// Pixels per diagram unit for raster export. Two is a retina-density base; the
// scale in the routine is the ceiling and may be capped lower by the canvas
// size limits below.
const PNG_EXPORT_SCALE = 2;
// Browsers silently truncate canvases larger than this on a side.
const MAX_PNG_EXPORT_DIMENSION = 16_000;
// A 120M-pixel canvas is ~480 MB of RGBA; a bigger one is halved until it fits.
const MAX_PNG_EXPORT_PIXELS = 120_000_000;
// iPhone and iPad Safari refuse (or silently blank) canvases over 16.7M pixels.
const MAX_MOBILE_WEBKIT_PIXELS = 16_000_000;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Whether the current browser is iOS/iPadOS Safari or Safari on a Mac with
 * touch input. Both impose a ~16M-pixel canvas ceiling far below the desktop
 * browsers' budget, so the raster scale must be capped independently there.
 */
function isMobileWebKit() {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

/**
 * Pixels per diagram unit: `PNG_EXPORT_SCALE` for ordinary diagrams, never
 * over `MAX_PNG_EXPORT_DIMENSION` per side or the device's canvas budget.
 * The page's zoom never enters into it either.
 */
function getPngExportScale(
  width: number,
  height: number,
  maxPixels = isMobileWebKit()
    ? MAX_MOBILE_WEBKIT_PIXELS
    : MAX_PNG_EXPORT_PIXELS,
) {
  return Math.min(
    PNG_EXPORT_SCALE,
    MAX_PNG_EXPORT_DIMENSION / width,
    MAX_PNG_EXPORT_DIMENSION / height,
    Math.sqrt(maxPixels / (width * height)),
  );
}

/**
 * Read the intrinsic dimensions of a rendered SVG. Prefers the `viewBox`
 * (works even when the SVG is hidden) and falls back to the live `getBBox()`
 * so a Mermaid output that loses its viewBox still produces a sensible export.
 */
export function getSvgDimensions(svg: SVGSVGElement) {
  const viewBox = svg.viewBox.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  const bbox = svg.getBBox();
  return { width: bbox.width, height: bbox.height };
}

/**
 * Clone the SVG with its own xmlns, viewBox, and explicit pixel size. Strips
 * inline `width`/`height`/`max-width`/`transform` first — those reflect the
 * host page's layout and would otherwise shrink the rasterized output below
 * the chosen scale. `scale = 1` keeps the SVG at intrinsic size.
 */
function standaloneSvg(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale: number,
) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  for (const property of ["width", "height", "max-width", "transform"]) {
    clone.style.removeProperty(property);
  }
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", XLINK_NS);
  clone.setAttribute("width", String(Math.ceil(width * scale)));
  clone.setAttribute("height", String(Math.ceil(height * scale)));
  return clone;
}

/**
 * Insert a viewBox-sized `<rect>` filled with `color` as the first child of
 * `svg` so it sits behind every other element. No-op when the SVG has no
 * usable viewBox (would otherwise produce a 0×0 invisible rect).
 */
function applyBackgroundToSvg(svg: SVGSVGElement, color: string) {
  const viewBox = svg.viewBox.baseVal;
  if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) return;
  const rect = svg.ownerDocument.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(viewBox.x));
  rect.setAttribute("y", String(viewBox.y));
  rect.setAttribute("width", String(viewBox.width));
  rect.setAttribute("height", String(viewBox.height));
  rect.setAttribute("fill", color);
  svg.insertBefore(rect, svg.firstChild);
}

/**
 * Options accepted by `downloadSvg` and `downloadPng`.
 */
export interface DownloadOptions {
  /**
   * Color baked into the export as the background.
   *
   * Mermaid's `<rect class="background">` only covers the diagram's content
   * area — the viewBox padding is transparent. Without this, dark-mode PNGs
   * show white in viewers that composite transparent pixels over white, and
   * exported SVGs render against whatever bg the consumer's app uses.
   */
  backgroundColor?: string;
}

/**
 * Serialize the SVG to a UTF-8 XML document and trigger a download.
 *
 * The clone is stripped of inline `width`/`height`/`max-width`/`transform`
 * styles (those reflect the host page's layout) and given explicit pixel
 * dimensions matching its viewBox. When `options.backgroundColor` is set, a
 * viewBox-sized `<rect>` is prepended so the file carries its own background.
 */
export function downloadSvg(
  svg: SVGSVGElement,
  filename = "diagram.svg",
  options?: DownloadOptions,
) {
  const { width, height } = getSvgDimensions(svg);
  if (width <= 0 || height <= 0) return;
  const clone = standaloneSvg(svg, width, height, 1);
  if (options?.backgroundColor) {
    applyBackgroundToSvg(clone, options.backgroundColor);
  }
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${source}`], {
    type: "image/svg+xml;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

/**
 * Rasterize the SVG to a PNG via an offscreen `<canvas>` and trigger a
 * download. Returns silently when the SVG has no measurable dimensions
 * (e.g. before the first render).
 *
 * The scale starts at `PNG_EXPORT_SCALE` and is capped by the browser's
 * canvas-size limits; if the canvas still cannot be encoded the scale is
 * halved until it does (then the error is surfaced).
 *
 * When `options.backgroundColor` is set, the canvas is filled with it before
 * the SVG is drawn so transparent viewBox padding composites against the
 * theme color instead of (white) viewer defaults.
 */
export async function downloadPng(
  svg: SVGSVGElement,
  filename = "diagram.png",
  options?: DownloadOptions,
): Promise<void> {
  const { width, height } = getSvgDimensions(svg);
  if (width <= 0 || height <= 0) return;
  let scale = getPngExportScale(width, height);
  if (!Number.isFinite(scale) || scale <= 0) return;

  for (;;) {
    const clone = standaloneSvg(svg, width, height, scale);
    const svgBlob = new Blob(
      [new XMLSerializer().serializeToString(clone)],
      { type: "image/svg+xml;charset=utf-8" },
    );
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to decode diagram SVG"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      ctx.fillStyle = options?.backgroundColor ?? "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("PNG encoding failed");
      triggerDownload(blob, filename);
      return;
    } catch (error) {
      if (scale / 2 < 1) throw error;
      scale /= 2;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}