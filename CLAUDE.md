# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mermaid Studio — a Next.js 15 (app router) + React 19 + TypeScript app for editing Mermaid diagrams or generating them from a plain-language description via an LLM. Neo-brutalist UI, light/dark themed, pan/zoom interactive preview.

## Commands

```bash
bun install          # (bun.lock present, project uses bun)
bun run dev          # next dev
bun run build        # next build
bun run start        # next start
bun run lint         # next lint (Next's ESLint config)
bun run typecheck    # tsc --noEmit (strict mode, no test runner configured)
```

There is no test runner — verification is `lint` + `typecheck` + manual browser check against `bun run dev`.

## Environment

Configure one LLM provider in `.env.local` (see `.env.example`):
- `ANTHROPIC_COMPATIBLE_*` — preferred; any Anthropic-Messages-API endpoint (incl. relays like `api.minimax.cn/anthropic`).
- `OPENAI_COMPATIBLE_*` — fallback. Defaults to OpenRouter + `anthropic/claude-3.5-haiku`.

`server/generate/config.ts:readLlmConfig()` picks the provider; route returns 502 if neither key is set.

## Path alias

`~/*` resolves to project root (configured in `tsconfig.json`). Use `~/components/...`, `~/lib/...`, `~/hooks/...`, `~/server/...` — not relative `../../..` chains.

## Architecture

```
app/
  page.tsx                       # Single-page UI: header + editor aside + preview canvas
  layout.tsx                     # ThemeProvider (next-themes, class attribute, system default)
  api/generate/route.ts          # POST /api/generate — thin wrapper, maxDuration 60s
  globals.css                    # Tailwind v4 + neo-brutalist custom utilities (--neo-* tokens)

components/
  diagram.tsx                    # Controlled Mermaid renderer; mounts viewport hook, sanitizes output
  diagram-toolbar.tsx            # Floating zoom controls; carries [data-diagram-toolbar] so gestures skip it
  diagram-helpers.ts             # Pure helpers: view clamping, SVG dimensions, wheel/pinch math

hooks/
  use-mermaid-viewport.ts        # Pan/zoom lifecycle: fit, animation, ResizeObserver, key handlers
  use-diagram-pointer-gestures.ts # Touch/mouse drag + two-pointer pinch; ignores clicks on toolbar
  use-diagram-wheel-gestures.ts  # Wheel + Safari `gesturestart/change/end`; trackpad detection
  use-effect-event.ts            # Polyfill for React 19's experimental useEffectEvent (stable ref)

lib/
  utils.ts                       # cn() = clsx + tailwind-merge
  download.ts                    # SVG/PNG export (SVG: serialize; PNG: canvas rasterize at 2×)
  mermaid/config.ts              # buildMermaidConfig(), getMermaidThemeVariables(), DOMPurify options
  mermaid/security.ts            # sanitizeMermaidSourceForRender() + enforceSafeMermaidLinks()

server/generate/
  generate.ts                    # Orchestrator: dispatches to Anthropic- or OpenAI-compatible client
  config.ts                      # readLlmConfig() from env
  prompts.ts                     # SYSTEM_PROMPT (output rules, palette, few-shot examples)
  format.ts                      # toTaggedMessage / extractTaggedSection for tagged LLM input
  constants.ts                   # MAX_OUTPUT_TOKENS=8000, MAX_GENERATE_ATTEMPTS=1, model defaults
```

### Render pipeline (`components/diagram.tsx`)

1. Source flows through `sanitizeMermaidSourceForRender` (rejoins wrapped `classDef`/`style` lines, drops non-https `click` directives, strips BOM/zero-width chars).
2. A hidden, in-DOM render target is appended (`createHiddenRenderTarget`) — Mermaid requires a measured container.
3. `mermaid.render()` runs inside `withDomNodesSerializingSafely` which patches `Element.prototype.toJSON` so DOM nodes inside `<foreignObject>` don't blow up JSON serialization. Reference-counted for nested calls.
4. Output SVG passes through `DOMPurify.sanitize(svg, MERMAID_SVG_SANITIZE_OPTIONS)`, then `enforceSafeMermaidLinks` re-enforces an https-only href allowlist (DOMPurify can't infer semantics of Mermaid's `click` directive).
5. `useMermaidViewport` measures the SVG, computes a fit-scale, and wires pointer/wheel/keyboard handlers. Toolbar renders a `data-diagram-toolbar` element so gestures skip it.

### Hydration guard

`components/diagram.tsx:31` calls `mermaid.initialize({ startOnLoad: false })` at module load time. Without this, Mermaid's `window.addEventListener("load", ...)` auto-render fires during React hydration and causes a mismatch. Don't remove.

### Pan/zoom model

`ViewState` (`diagram-helpers.ts`) holds `{ fitScale, scale, x, y, width, height }`. `applyViewState` writes a `translate3d(...) scale(...)` transform on the inner diagram div with `transform-origin: 0 0`. Zoom limits are `fitScale * 0.6` (min) and `Math.max(fitScale * 12, 3)` (max). `fitDiagram(animate, whole)` chooses between `fitScale` (whole=true, full container fit) and `getReadableScale` (whole=false, zooms in further while keeping ≥12 px text on labels). Animation uses cubic-ease-out over 160 ms unless `prefers-reduced-motion: reduce`.

### Theming

Light/dark theme variables are in `lib/mermaid/config.ts` (separate palettes). `buildMermaidInitDirective(isDark)` produces a `%%{init: ...}%%` payload used by the "With studio theme" copy option so exported source renders the same in any Mermaid renderer. `app/layout.tsx` uses `next-themes` with `attribute="class"` and `suppressHydrationWarning` on `<html>` — keep both when changing the theme wiring.

### Styling conventions

Neo-brutalist look is built on Tailwind v4 with custom utilities (`.neo-panel`, `.neo-button`, `.neo-input`, `.neo-stamp`, `.neo-button-muted`, `.neo-panel-thin`) defined in `app/globals.css`. Dark mode uses class-based selectors against the `dark` class from `next-themes`. Use `cn()` for conditional class merging — never template-literal class strings with conditional `&&`.

## Things to be careful about

- `server/generate/generate.ts` is server-only — never import from a `"use client"` file.
- `lib/mermaid/security.ts` `enforceSafeMermaidLinks` uses `window.location.origin`; it's only safe to call in the browser (Diagram component calls it post-mount).
- `useEffectEvent` polyfill returns a stable callback — wrap values used inside effects that you don't want to retrigger on prop changes (see `use-mermaid-viewport.ts` for `reportRenderComplete`).
- `MAX_GENERATE_ATTEMPTS = 1` (server/generate/constants.ts) — bumping requires structured-feedback retry logic that doesn't exist yet.
- DOMPurify options in `MERMAID_SVG_SANITIZE_OPTIONS` allow `svgFilters` + `html` profiles (Mermaid's inline-styled labels need them) and forbid `<script>`. URL safety is enforced separately.
