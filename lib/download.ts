"use client";

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
 * Clone an SVG with the `xmlns` and `xmlns:xlink` declarations so it renders
 * correctly when opened outside the page that produced it (other tabs, image
 * viewers, slide decks). Mermaid doesn't always emit these by default.
 */
function cloneStandaloneSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  return clone;
}

/**
 * Read the intrinsic width and height of a rendered SVG.
 * Prefers the `viewBox` (works even when the SVG is hidden) and falls back
 * to the live `clientWidth`/`clientHeight`.
 */
export function getSvgDimensions(svg: SVGSVGElement) {
  const viewBox = svg.viewBox.baseVal;
  const width =
    viewBox && viewBox.width > 0 ? viewBox.width : svg.clientWidth || 0;
  const height =
    viewBox && viewBox.height > 0 ? viewBox.height : svg.clientHeight || 0;
  return { width, height };
}

/**
 * Serialize the SVG to a UTF-8 XML document and trigger a download.
 *
 * The cloned SVG is forced to have explicit `width`/`height` attributes
 * (sourced from the viewBox) so consumers that don't auto-size render at
 * a sensible default.
 */
export function downloadSvg(svg: SVGSVGElement, filename = "diagram.svg") {
  const clone = cloneStandaloneSvg(svg);
  const { width, height } = getSvgDimensions(svg);
  if (width > 0 && height > 0) {
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
  }
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${source}`], {
    type: "image/svg+xml;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

/**
 * Rasterize the SVG to a PNG via an offscreen `<canvas>` and trigger a
 * download. `scale` multiplies the intrinsic dimensions (default 2× for
 * retina-density screens). Returns silently when the SVG has no measurable
 * dimensions (e.g. before the first render).
 */
export async function downloadPng(
  svg: SVGSVGElement,
  filename = "diagram.png",
  scale = 2,
) {
  const { width, height } = getSvgDimensions(svg);
  if (width <= 0 || height <= 0) return;

  const clone = cloneStandaloneSvg(svg);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const svgBlob = new Blob(
    [new XMLSerializer().serializeToString(clone)],
    { type: "image/svg+xml;charset=utf-8" },
  );
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to rasterize SVG"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("PNG encoding failed");
    triggerDownload(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
