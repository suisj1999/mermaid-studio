/**
 * Currently-applied view transform for the diagram.
 *
 * `scale` is the absolute zoom factor and `fitScale` is the scale at which
 * the diagram exactly fits the container — used to compute the "100%"
 * label and the zoom min/max bounds.
 */
export type ViewState = {
  fitScale: number;
  height: number;
  scale: number;
  width: number;
  x: number;
  y: number;
};

/** Pointer position in client (viewport) coordinates. */
export type PointerCoordinates = {
  x: number;
  y: number;
};

/**
 * Snapshot of view + pointer state at the start of a pinch gesture, used to
 * derive per-frame deltas (distance ratio → scale, midpoint shift → pan).
 */
export type PinchState = {
  startDistance: number;
  startView: ViewState;
  startX: number;
  startY: number;
};

const MOUSE_WHEEL_ZOOM_SPEED = 0.0015;
const TRACKPAD_PINCH_ZOOM_SPEED = 0.01;

interface ActiveDomSerializationPatch {
  depth: number;
  elementPrototype: typeof Element.prototype;
}

let activeDomSerializationPatch: ActiveDomSerializationPatch | null = null;

function serializeDomElement(this: Element) {
  return {
    tagName: this.tagName,
    id: this.id || undefined,
    className: typeof this.className === "string" ? this.className : undefined,
  };
}

function installDomSerializationPatch() {
  if (typeof window === "undefined") return () => {};

  const elementPrototype = window.Element?.prototype;
  if (!elementPrototype) return () => {};

  if (activeDomSerializationPatch?.elementPrototype === elementPrototype) {
    activeDomSerializationPatch.depth += 1;
    return () => {
      if (!activeDomSerializationPatch) return;
      activeDomSerializationPatch.depth -= 1;
      if (activeDomSerializationPatch.depth === 0) {
        delete (
          activeDomSerializationPatch.elementPrototype as typeof Element.prototype & {
            toJSON?: typeof serializeDomElement;
          }
        ).toJSON;
        activeDomSerializationPatch = null;
      }
    };
  }

  if ("toJSON" in elementPrototype) return () => {};

  Object.defineProperty(elementPrototype, "toJSON", {
    configurable: true,
    value: serializeDomElement,
  });
  activeDomSerializationPatch = {
    depth: 1,
    elementPrototype,
  };

  return () => {
    if (!activeDomSerializationPatch) return;
    activeDomSerializationPatch.depth -= 1;
    if (activeDomSerializationPatch.depth === 0) {
      delete (
        activeDomSerializationPatch.elementPrototype as typeof Element.prototype & {
          toJSON?: typeof serializeDomElement;
        }
      ).toJSON;
      activeDomSerializationPatch = null;
    }
  };
}

/**
 * Run `operation` with a temporary `Element.prototype.toJSON` patch so DOM
 * nodes serialize to a JSON-safe stub instead of throwing
 * "Converting circular structure to JSON".
 *
 * Mermaid serializes the rendered SVG to a string it then embeds in its
 * result; any DOM node attached to an element referenced from that graph
 * (e.g. inside a `<foreignObject>`) would otherwise blow up the call.
 *
 * Reference-counted so nested calls don't uninstall the patch mid-flight.
 */
export async function withDomNodesSerializingSafely<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const restoreDomSerialization = installDomSerializationPatch();
  try {
    return await operation();
  } finally {
    restoreDomSerialization();
  }
}

/**
 * Append a hidden, in-DOM container for Mermaid to render into.
 *
 * Mermaid measures layout based on the render target's width, so a detached
 * node would crash; the container is hidden off-screen with `visibility:
 * hidden` and removed by the caller after `mermaid.render()` resolves.
 *
 * `width` is clamped to ≥1 px so a 0-width container (e.g. before layout)
 * doesn't trip Mermaid's intrinsic-size math.
 */
export function createHiddenRenderTarget(width: number) {
  const renderTarget = document.createElement("div");
  renderTarget.setAttribute("aria-hidden", "true");
  renderTarget.style.position = "absolute";
  renderTarget.style.visibility = "hidden";
  renderTarget.style.pointerEvents = "none";
  renderTarget.style.overflow = "hidden";
  renderTarget.style.left = "0";
  renderTarget.style.top = "0";
  renderTarget.style.zIndex = "-1";
  renderTarget.style.width = `${Math.max(width, 1)}px`;
  document.body.append(renderTarget);
  return renderTarget;
}

/**
 * Clamp a candidate view state so the diagram stays inside the container
 * with a small gutter (32–160 px depending on container size). Returns
 * centered coordinates when the diagram is smaller than the container,
 * so a small diagram is always visually centered rather than pinned to a
 * corner.
 */
export function clampViewState({
  nextScale,
  nextX,
  nextY,
  containerHeight,
  containerWidth,
  contentHeight,
  contentWidth,
}: {
  containerHeight: number;
  containerWidth: number;
  contentHeight: number;
  contentWidth: number;
  nextScale: number;
  nextX: number;
  nextY: number;
}) {
  const scaledWidth = contentWidth * nextScale;
  const scaledHeight = contentHeight * nextScale;
  const horizontalGutter = Math.max(32, Math.min(160, containerWidth * 0.12));
  const verticalGutter = Math.max(32, Math.min(160, containerHeight * 0.12));

  const x =
    scaledWidth <= containerWidth
      ? (containerWidth - scaledWidth) / 2
      : Math.max(
          containerWidth - scaledWidth - horizontalGutter,
          Math.min(horizontalGutter, nextX),
        );

  const y =
    scaledHeight <= containerHeight
      ? (containerHeight - scaledHeight) / 2
      : Math.max(
          containerHeight - scaledHeight - verticalGutter,
          Math.min(verticalGutter, nextY),
        );

  return { x, y };
}

/**
 * Read the intrinsic width/height of an SVG element.
 *
 * Prefers the `viewBox` (so off-screen or pre-layout SVGs report real
 * dimensions) and falls back to `getBBox()` for SVGs without a viewBox.
 * Result is clamped to ≥1 px so downstream scaling never divides by zero.
 */
export function getSvgDimensions(svgElement: SVGSVGElement) {
  const viewBox = svgElement.viewBox.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return {
      height: viewBox.height,
      width: viewBox.width,
    };
  }

  const bbox = svgElement.getBBox();
  return {
    height: Math.max(bbox.height, 1),
    width: Math.max(bbox.width, 1),
  };
}

export function getDistanceBetweenPointers(
  firstPointer: PointerCoordinates,
  secondPointer: PointerCoordinates,
) {
  return Math.hypot(
    secondPointer.x - firstPointer.x,
    secondPointer.y - firstPointer.y,
  );
}

export function getPointerMidpoint(
  firstPointer: PointerCoordinates,
  secondPointer: PointerCoordinates,
) {
  return {
    x: (firstPointer.x + secondPointer.x) / 2,
    y: (firstPointer.y + secondPointer.y) / 2,
  };
}

export function getTrackedPointerPair(
  pointers: Map<number, PointerCoordinates>,
) {
  const [firstPointer, secondPointer] = Array.from(pointers.values());
  if (!firstPointer || !secondPointer) return null;
  return [firstPointer, secondPointer] as const;
}

/**
 * Convert a WheelEvent's `deltaY` into a pixel-equivalent magnitude.
 * Line-mode wheels report 16 px/line, page-mode 120 px/page, pixel-mode
 * is already in pixels.
 */
export function normalizeWheelDelta(
  event: Pick<WheelEvent, "deltaMode" | "deltaY">,
) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * 120;
  }

  return event.deltaY;
}

/**
 * Compute the multiplicative zoom factor for a wheel event.
 *
 * Uses a slower "trackpad pinch" speed when Ctrl/Cmd is held (so a macOS
 * pinch reads as 1.5× per detent rather than 5×) and clamps the delta to
 * ±240 px so a fast scroll never jumps by more than ~e^0.36 ≈ 1.43×.
 */
export function getWheelZoomScaleFactor(
  event: Pick<WheelEvent, "ctrlKey" | "metaKey" | "deltaMode" | "deltaY">,
) {
  const zoomSpeed =
    event.ctrlKey || event.metaKey
      ? TRACKPAD_PINCH_ZOOM_SPEED
      : MOUSE_WHEEL_ZOOM_SPEED;

  const delta = Math.max(-240, Math.min(240, normalizeWheelDelta(event)));
  return Math.exp(-delta * zoomSpeed);
}

export function getPinchScaleFactor(
  startDistance: number,
  currentDistance: number,
) {
  if (startDistance <= 0 || currentDistance <= 0) return 1;
  return currentDistance / startDistance;
}

/**
 * Heuristic to detect trackpad pinch gestures arriving as wheel events:
 *
 * - pixel `deltaMode` (line/page is mouse wheel)
 * - no Ctrl/Cmd (those are always pinches on macOS, handled elsewhere)
 * - non-zero horizontal delta OR small vertical delta OR non-integer
 *   vertical delta (mouse wheels produce integer deltaY in line/page mode)
 *
 * Returns false for any event that fails these checks.
 */
export function isLikelyTrackpadGesture(
  event: Pick<
    WheelEvent,
    "ctrlKey" | "metaKey" | "deltaMode" | "deltaX" | "deltaY"
  >,
) {
  if (event.ctrlKey || event.metaKey) return false;
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return false;

  const absX = Math.abs(event.deltaX);
  const absY = Math.abs(event.deltaY);
  return absX > 0 || absY < 40 || !Number.isInteger(event.deltaY);
}

export const ZOOM_STEP = 1.5;
const MIN_READABLE_TEXT_PX = 12;
const DEFAULT_FONT_SIZE = 16;

/**
 * Min/max scale allowed relative to the current `fitScale`.
 *
 * Min is 60% of fit (zoom out below fit shows empty space), max is 12× fit
 * or 3× absolute (whichever is larger — tiny diagrams still zoom to 3×).
 */
export function getZoomLimits(fitScale: number) {
  return { min: fitScale * 0.6, max: Math.max(fitScale * 12, 3) };
}

/**
 * Read the dominant font size of a rendered Mermaid SVG by sampling node
 * labels and cluster labels and picking the median.
 *
 * Used to decide if `fitScale` would shrink text below readability before
 * we let the user zoom in further. Falls back to `DEFAULT_FONT_SIZE` when
 * the SVG has no measurable labels yet.
 */
export function getDiagramFontSize(svgElement: SVGSVGElement) {
  const sizes = Array.from(
    svgElement.querySelectorAll("g.node text, g.cluster-label text"),
    (element) => parseFloat(getComputedStyle(element).fontSize),
  )
    .filter((size) => Number.isFinite(size) && size > 0)
    .sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)] ?? DEFAULT_FONT_SIZE;
}

/**
 * Compute the smallest scale that keeps Mermaid's labels at least
 * `MIN_READABLE_TEXT_PX` (12 px) on screen.
 *
 * Returns `fitScale` unchanged when text already fits; otherwise the
 * smaller of (the readable scale, the zoom max).
 */
export function getReadableScale(fitScale: number, fontSize: number) {
  const readable = MIN_READABLE_TEXT_PX / fontSize;
  if (!(readable > fitScale)) return fitScale;
  return Math.min(readable, getZoomLimits(fitScale).max);
}

/**
 * Horizontal position (in SVG coordinate space) of the top-most rendered
 * node's center, or `null` when the SVG has no measured nodes yet.
 *
 * Used by the fit-to-readable logic to anchor the diagram near its entry
 * point when the readable scale crops the bottom.
 */
export function getTopNodeCenterX(svgElement: SVGSVGElement, width: number) {
  const svgRect = svgElement.getBoundingClientRect();
  if (!(svgRect.width > 0)) return null;
  let top: DOMRect | null = null;
  for (const node of svgElement.querySelectorAll("g.node")) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && (!top || rect.top < top.top)) top = rect;
  }
  if (!top) return null;
  return ((top.left + top.width / 2 - svgRect.left) / svgRect.width) * width;
}

/**
 * Pick a default scale for non-interactive diagrams: fit to the container
 * width, capped at 1.25× so very small diagrams aren't blown up beyond
 * readability. Returns 1 when either dimension is non-positive.
 */
export function getDefaultDiagramScale({
  containerWidth,
  contentWidth,
}: {
  containerWidth: number;
  contentWidth: number;
}) {
  if (contentWidth <= 0 || containerWidth <= 0) return 1;
  const scale = Math.min(containerWidth / contentWidth, 1.25);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
