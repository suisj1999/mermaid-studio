"use client";

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { tokenize } from "~/lib/mermaid/highlight";
import { cn } from "~/lib/utils";

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** 1-indexed source line to mark as the preview's current selection. Pass
   * `null` to clear the highlight. */
  currentLine?: number | null;
  /**
   * Called whenever the textarea's caret / selection moves to a different
   * line. Lets the host mirror the editor's cursor into its own state so
   * the current-line highlight follows user interaction inside the editor,
   * not just preview clicks.
   */
  onCursorLineChange?: (line: number) => void;
  className?: string;
  placeholder?: string;
}

// Padding-top + line-height must match `.surface-editor-overlay` (and the
// `.surface-editor-textarea`) in each theme.css. The current-line marker
// uses the same offsets so it lines up with the corresponding row.
const LINE_HEIGHT_PX = 24;
const PADDING_TOP_PX = 16;

/**
 * Three-layer Mermaid editor:
 *   - gutter: line numbers (`<ol>`, `pointer-events: none`)
 *   - overlay: tokenized `<pre>` behind the textarea (`pointer-events: none`)
 *   - textarea: transparent text on top so only the caret is interactive
 *
 * Scroll is mirrored from the textarea to the overlay + gutter via a direct
 * DOM listener (no React state, so scrolling does not re-render anything).
 * The forwarded ref exposes the textarea element so the host's existing
 * `handleSelectLine` math (selection range + scrollTop) continues to work
 * unchanged — the gutter only affects visual padding, not line metrics.
 */
export const CodeEditor = forwardRef<HTMLTextAreaElement, CodeEditorProps>(
  function CodeEditor(
    {
      value,
      onChange,
      currentLine,
      onCursorLineChange,
      className,
      placeholder,
    },
    ref,
  ) {
    const overlayRef = useRef<HTMLPreElement>(null);
    const gutterRef = useRef<HTMLOListElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const valueRef = useRef(value);
    const callbackRef = useRef(onCursorLineChange);
    const imeComposingRef = useRef(false);

    const setTextareaRef = (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    };

    // Mirror latest value / callback into refs so the document-level
    // selectionchange listener doesn't re-bind on every keystroke.
    useEffect(() => {
      valueRef.current = value;
    }, [value]);
    useEffect(() => {
      callbackRef.current = onCursorLineChange;
    });

    useEffect(() => {
      const ta = internalRef.current;
      if (!ta) return;
      const sync = () => {
        if (overlayRef.current) {
          overlayRef.current.scrollTop = ta.scrollTop;
          overlayRef.current.scrollLeft = ta.scrollLeft;
        }
        if (gutterRef.current) {
          gutterRef.current.scrollTop = ta.scrollTop;
        }
        // The current-line marker lives in the editor root (sibling of the
        // textarea), so it would stay anchored in screen space while the
        // text scrolls underneath. Translate it by the inverse of
        // scrollTop so it stays visually aligned with the line it
        // highlights.
        const marker = markerRef.current;
        if (marker) {
          marker.style.transform = `translateY(${-ta.scrollTop}px)`;
        }
      };
      ta.addEventListener("scroll", sync, { passive: true });
      return () => ta.removeEventListener("scroll", sync);
    }, []);

    // Pin the marker's transform to the textarea's current scrollTop
    // whenever currentLine changes. Preview click sets scrollTop
    // programmatically (via handleSelectLine), which doesn't fire the
    // scroll event, so the sync above misses it.
    useLayoutEffect(() => {
      const ta = internalRef.current;
      const marker = markerRef.current;
      if (!ta || !marker) return;
      marker.style.transform = `translateY(${-ta.scrollTop}px)`;
    }, [currentLine]);

    // Drive `onCursorLineChange` from the textarea's caret / selection.
    // `selectionchange` is the only event that fires for every kind of
    // selection movement (click, drag, shift+arrow, arrow keys alone,
    // touch), so we bind it once on `document` and filter to when the
    // textarea is the active element — that drops programmatic moves done
    // by `setSelectionRange` (e.g. preview click) and avoids a feedback
    // loop. IME composition is skipped to prevent caret flicker while the
    // user is mid-composition.
    useEffect(() => {
      const handler = () => {
        const ta = internalRef.current;
        const cb = callbackRef.current;
        if (!ta || !cb) return;
        if (document.activeElement !== ta) return;
        if (imeComposingRef.current) return;
        const offset = ta.selectionStart ?? 0;
        const line = valueRef.current.substring(0, offset).split("\n").length;
        cb(line);
      };
      document.addEventListener("selectionchange", handler);
      return () => document.removeEventListener("selectionchange", handler);
    }, []);

    const lineNumbers = useMemo(() => {
      const count = value.split("\n").length;
      const arr: number[] = new Array(count);
      for (let i = 0; i < count; i++) arr[i] = i + 1;
      return arr;
    }, [value]);

    const tokens = useMemo(() => tokenize(value), [value]);

    const currentLineTop =
      typeof currentLine === "number" && currentLine >= 1
        ? PADDING_TOP_PX + (currentLine - 1) * LINE_HEIGHT_PX
        : null;

    return (
      <div
        className={cn(
          "surface-editor relative flex-1 overflow-hidden",
          className,
        )}
      >
        <ol ref={gutterRef} className="surface-editor-gutter" aria-hidden>
          {lineNumbers.map((n) => (
            <li key={n} data-active={n === currentLine ? "" : undefined}>
              {n}
            </li>
          ))}
        </ol>
        <pre ref={overlayRef} className="surface-editor-overlay" aria-hidden>
          {tokens.map((tok, i) => (
            <span key={i} className={`surface-syntax-${tok.type}`}>
              {tok.text}
            </span>
          ))}
        </pre>
        {currentLineTop !== null && (
          <div
            ref={markerRef}
            className="surface-editor-current-line"
            style={{
              top: `${currentLineTop}px`,
              height: `${LINE_HEIGHT_PX}px`,
            }}
            aria-hidden
          />
        )}
        <textarea
          ref={setTextareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => {
            imeComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            imeComposingRef.current = false;
          }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={placeholder}
          style={{ tabSize: 2 }}
          className="surface-editor-textarea"
        />
      </div>
    );
  },
);
