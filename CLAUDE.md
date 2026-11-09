# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mermaid Studio — a Next.js 15 (app router) + React 19 + TypeScript app for editing Mermaid diagrams or generating them from a plain-language description via an LLM. UI is selectable per visit via `?ui-style=<id>` (default: `neo-brutalism`; `newspaper` is the second style). Light/dark themed, pan/zoom interactive preview.

## Commands

```bash
bun install          # (bun.lock present, project uses bun)
bun run dev          # next dev
bun run build        # next build
bun run start        # next start
bun run typecheck    # tsc --noEmit (strict mode)
bun run test         # bun test (built-in runner; tests live in ./test/*.test.ts)
```

`bun run typecheck` + `bun run build` + `bun run test` are the standard pre-commit checks; UI changes need a manual browser check against `bun run dev`. Note: `bun run lint` is currently interactive (`next lint` prompts to set up ESLint) — don't depend on it.

## Environment

Configure one LLM provider in `.env.local` (see `.env.example`):
- `ANTHROPIC_COMPATIBLE_*` — preferred; any Anthropic-Messages-API endpoint (incl. relays like `api.minimax.cn/anthropic`).
- `OPENAI_COMPATIBLE_*` — fallback. Defaults to OpenRouter + `anthropic/claude-3.5-haiku`.

`server/generate/config.ts:readLlmConfig()` picks the provider; route returns 502 if neither key is set.

`NEXT_PUBLIC_SITE_URL` is the public origin (e.g. `https://example.com`). It feeds the canonical link, Open Graph URLs, `robots.txt` and `sitemap.xml`; unset it locally and the app falls back to `http://localhost:3000`. Set it in any deployed environment.

## Path alias

`~/*` resolves to project root (configured in `tsconfig.json`). Use `~/components/...`, `~/lib/...`, `~/hooks/...`, `~/server/...` — not relative `../../..` chains.

## Architecture

```
app/
  page.tsx                       # Thin router: reads ?ui-style= and delegates to <StyleRouter />
  layout.tsx                     # ThemeProvider + metadata (canonical/OG/Twitter/JSON-LD)
  robots.ts                      # robots.txt — allows /, disallows /api/, points at the sitemap
  sitemap.ts                     # sitemap.xml — one entry for /
  icon.svg                       # Favicon (Next.js file convention)
  api/generate/route.ts          # POST /api/generate — thin wrapper, maxDuration 60s
  globals.css                    # Tailwind v4 + dark variant + base reset only. No per-style CSS.

components/
  diagram.tsx                    # Controlled Mermaid renderer; mounts viewport hook, sanitizes output
  diagram-toolbar.tsx            # Floating zoom controls; carries [data-diagram-toolbar] so gestures skip it
  diagram-helpers.ts             # Pure helpers: view clamping, SVG dimensions, wheel/pinch math

  styles/                        # Multi-style UI — each style is a code-isolated Page + theme.css
    registry.ts                  #   StyleId, STYLE_METADATA, isKnownStyleId, STYLES (next/dynamic, lazy)
    router.tsx                   #   Client component: reads uiStyle prop, picks a Page, falls back on unknown
    neo-brutalism/
      Page.tsx                   #   The original UI (was app/page.tsx before the refactor)
      theme.css                  #   --neo-* tokens + .neo-* utilities + .surface-* aliases
    newspaper/
      Page.tsx                   #   Editorial layout: serif masthead, hairline borders, terracotta accent
      theme.css                  #   --paper-* tokens + .surface-* aliases

hooks/
  use-mermaid-viewport.ts        # Pan/zoom lifecycle: fit, animation, ResizeObserver, key handlers
  use-diagram-pointer-gestures.ts # Touch/mouse drag + two-pointer pinch; ignores clicks on toolbar
  use-diagram-wheel-gestures.ts  # Wheel + Safari `gesturestart/change/end`; trackpad detection
  use-effect-event.ts            # Polyfill for React 19's experimental useEffectEvent (stable ref)

lib/
  utils.ts                       # cn() = clsx + tailwind-merge
  site.ts                        # siteUrl / siteName / siteDescription — canonical origin + metadata copy
  download.ts                    # SVG/PNG export (see "Export pipeline" below)
  mermaid/config.ts              # buildMermaidConfig(), getMermaidThemeVariables(), DOMPurify options
  mermaid/security.ts            # sanitizeMermaidSourceForRender() + enforceSafeMermaidLinks()

server/generate/
  generate.ts                    # Orchestrator: dispatches to Anthropic- or OpenAI-compatible client
  config.ts                      # readLlmConfig() from env
  prompts.ts                     # SYSTEM_PROMPT (output rules, palette, few-shot examples)
  format.ts                      # toTaggedMessage / extractTaggedSection for tagged LLM input
  constants.ts                   # MAX_OUTPUT_TOKENS=8000, MAX_GENERATE_ATTEMPTS=1, model defaults
server/rate-limit.ts             # Per-client fixed-window limiter for /api/generate (10 req/min)
```

## URL-based style selection

- `/?ui-style=neo-brutalism` (default at `/`) → neo-brutalism UI
- `/?ui-style=newspaper` → newspaper UI
- Anything else (including `garbage`) → silently falls back to neo-brutalism. Never 404.

Implementation: `app/page.tsx` is async, awaits `searchParams["ui-style"]` (Next 15 promise-based searchParams, kebab-case key) and passes it as the `uiStyle` prop to `<StyleRouter />`. The router uses `isKnownStyleId()` to validate, then renders the matching Page from `STYLES`. `STYLES` is built with `next/dynamic` (code-split per style, **not** `{ ssr: false }`) so only the selected style's CSS and JS load, while the page itself still server-renders for crawlers.

Each style's `Page.tsx` renders its own `StyleSwitcher` (the masthead link bar). The switcher `router.replace(...)`s to the target URL — never pushes, so the back button doesn't accumulate style swaps.

## Surface-class contract

The shared components (`<Diagram />`, `<DiagramToolbar />`, the pan/zoom layer) must work in **every** style without knowing about any specific style. The contract: shared code references neutral class names; each style's `theme.css` provides them.

| Class | Used by | Visuals defined in |
|---|---|---|
| `.surface-stamp` | `<Diagram />` error banner | each style's `theme.css` |
| `.surface-button-muted` | `<DiagramToolbar />` zoom/fit buttons | each style's `theme.css` |
| `.surface-interactive-layer` | `<Diagram />` pan/zoom layer (border + bg) | each style's `theme.css` |

`neo-brutalism/theme.css` defines these with neo visuals (thick border, offset shadow); `newspaper/theme.css` defines them with paper visuals (hairline + transparent or terracotta left rule). When adding a new style, **register it in `STYLES` first** (lazy load) and provide all three surface classes in its `theme.css`, otherwise the shared components will render unstyled in that style.

Shared components must not hard-code colours, borders or hover/active states — those come from the style's `.surface-*` rules. A Tailwind colour utility on a shared component silently overrides the themed value (utilities beat `@layer components`), which is how the toolbar once ended up with ~1.3:1 contrast in newspaper dark mode.

## Layout engine

`lib/mermaid/config.ts` pins `layout: "dagre"`. Mermaid's `"elk"` layout lazy-loads `elkjs` as a separate chunk (~423 KB gzipped) that the browser downloads on first render; dagre ships inside the main bundle. Measured on a production build: 793 KB of JS transferred with elk vs 366 KB with dagre. Switch back only if a diagram type needs ELK's routing — and re-measure the transfer cost when you do.

## Responsive layout

Below the `sm`/`md` breakpoint each style switches from a fixed-viewport app shell (`h-screen`, panes side by side) to a scrolling document: `h-auto` on `<main>`, `overflow-visible` on the workspace, a fixed-height preview (`45vh`), and an explicitly sized code editor (`h-64` / `h-56`) so the generator card stays reachable. Two rules learned the hard way:

- A flex child with `flex-1` and no definite height collapses to 0 px inside an auto-height column — the code editor needs an explicit height on mobile.
- The editor panel must not be `overflow-hidden` with content taller than the panel, or the Generate button is clipped and unreachable.

## SEO / metadata

`app/layout.tsx` owns the metadata (title template, description, canonical, Open Graph, Twitter, robots directives) and injects a `WebApplication` JSON-LD block. `app/robots.ts` and `app/sitemap.ts` are Next.js file conventions; `app/icon.svg` is the favicon. The canonical origin comes from `NEXT_PUBLIC_SITE_URL` (see `lib/site.ts`) and falls back to `http://localhost:3000` — set it in production or the canonical, OG and sitemap URLs will point at localhost.

## API abuse control

`POST /api/generate` spends money per call, so `server/rate-limit.ts` applies a per-client fixed window (10 requests/minute) before the request is parsed. The limiter is in-process: on serverless each instance keeps its own counters, so treat it as friction rather than a quota.

## Render pipeline (`components/diagram.tsx`)

1. Source flows through `sanitizeMermaidSourceForRender` (rejoins wrapped `classDef`/`style` lines, drops non-https `click` directives, strips BOM/zero-width chars).
2. The source is pre-validated against `looksLikeMermaidDiagram` — if the first non-directive, non-comment word isn't a known Mermaid type starter (`graph`, `flowchart`, `sequencediagram`, …), the render is skipped and the preview is cleared. Avoids `UnknownDiagramError` console noise for prose input.
3. A hidden, in-DOM render target is appended (`createHiddenRenderTarget`) — Mermaid requires a measured container.
4. `mermaid.render()` runs inside `withDomNodesSerializingSafely` which patches `Element.prototype.toJSON` so DOM nodes inside `<foreignObject>` don't blow up JSON serialization. Reference-counted for nested calls.
5. Output SVG passes through `DOMPurify.sanitize(svg, MERMAID_SVG_SANITIZE_OPTIONS)`, then `enforceSafeMermaidLinks` re-enforces an https-only href allowlist (DOMPurify can't infer semantics of Mermaid's `click` directive).
6. `useMermaidViewport` measures the SVG, computes a fit-scale, and wires pointer/wheel/keyboard handlers. Toolbar renders a `data-diagram-toolbar` element so gestures skip it.

## Hydration guard

`components/diagram.tsx` calls `mermaid.initialize({ startOnLoad: false })` at module load time. Without this, Mermaid's `window.addEventListener("load", ...)` auto-render fires during React hydration and causes a mismatch. Don't remove.

## Pan/zoom model

`ViewState` (`diagram-helpers.ts`) holds `{ fitScale, scale, x, y, width, height }`. `applyViewState` writes a `translate3d(...) scale(...)` transform on the inner diagram div with `transform-origin: 0 0`. Zoom limits are `fitScale * 0.6` (min) and `Math.max(fitScale * 12, 3)` (max). `fitDiagram(animate, whole)` chooses between `fitScale` (whole=true, full container fit) and `getReadableScale` (whole=false, zooms in further while keeping ≥12 px text on labels). Animation uses cubic-ease-out over 160 ms unless `prefers-reduced-motion: reduce`.

## Export pipeline (`lib/download.ts`)

`downloadSvg` and `downloadPng` consume the SVG already mounted in the DOM via `renderedSvgRef`. Both go through `standaloneSvg()` which `cloneNode(true)`s the SVG to preserve its embedded `<style>` block, class attributes, inline styles, Mermaid's id-scoped selectors, and `<defs>` filters, then strips the root element's inline `width`/`height`/`max-width`/`transform` (those reflect host-page layout). `downloadPng` additionally:

- Picks scale via `getPngExportScale` (`MIN(2, 16_000/width, 16_000/height, √(maxPixels/area))`) with `maxPixels` capped at 120 M on desktop, 16 M on iOS/iPadOS WebKit.
- Bakes `options.backgroundColor` (passed as `getMermaidThemeVariables(isDark).background`) into the canvas via `ctx.fillRect` so viewBox-padding pixels don't composite as transparent in viewers.
- Falls back to halving `scale` if `<img>.onerror` or `canvas.toBlob` returns null; final failure rejects the Promise.
- Uses `Math.floor` (not `ceil`) for both SVG attrs and canvas size — `exportPixelSize` unifies both so `drawImage` doesn't blur the last row/column.

Both functions bail early (`return`) on `width <= 0 || height <= 0` and on a non-finite scale, so calling them with an unrendered or 0-size SVG is a no-op rather than an error toast.

## Theming

Light/dark theme variables are in `lib/mermaid/config.ts` (separate palettes). `buildMermaidInitDirective(isDark)` produces a `%%{init: ...}%%` payload used by the "Themed" copy option so exported source renders the same in any Mermaid renderer. `app/layout.tsx` uses `next-themes` with `attribute="class"` and `suppressHydrationWarning` on `<html>` — keep both when changing the theme wiring.

## Styling conventions

- Each style folder is **self-contained**: its `theme.css` is imported at the top of its `Page.tsx`, and its CSS variables + utility classes don't leak into other styles.
- Tailwind v4 with `@custom-variant dark (&:where(.dark, .dark *));` (in `app/globals.css`).
- Use `cn()` for conditional class merging — never template-literal class strings with conditional `&&`.

## Things to be careful about

- `server/generate/generate.ts` is server-only — never import from a `"use client"` file.
- `lib/mermaid/security.ts` `enforceSafeMermaidLinks` uses `window.location.origin`; it's only safe to call in the browser (Diagram component calls it post-mount).
- `useEffectEvent` polyfill returns a stable callback — wrap values used inside effects that you don't want to retrigger on prop changes (see `use-mermaid-viewport.ts` for `reportRenderComplete`).
- `MAX_GENERATE_ATTEMPTS = 1` (server/generate/constants.ts) — bumping requires structured-feedback retry logic that doesn't exist yet.
- DOMPurify options in `MERMAID_SVG_SANITIZE_OPTIONS` allow `svgFilters` + `html` profiles (Mermaid's inline-styled labels need them) and forbid `<script>`. URL safety is enforced separately.
- `next/dynamic` is used in `components/styles/registry.ts` to lazy-load each style's Page. Don't import a style's Page statically anywhere outside the registry — it would bundle both styles into the initial JS.
- `downloadPng`'s default fallback is `"white"` for `backgroundColor`. Both `Page.tsx`s always pass `getMermaidThemeVariables(isDark).background`, so this fallback is dormant. Don't remove the explicit option passing when writing a third style.
- `next.config.js` sets a CSP plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS on every route. Inline scripts/styles are unavoidable (Mermaid's inline-styled labels, `next-themes`' bootstrap script); `'unsafe-eval'` is added in dev only. If you add a third-party script, it must be same-origin or explicitly allow-listed.
- `bun run build` and `bun run dev` share `.next/`. Never build while the dev server is running — it replaces the dev server's chunks and the app then 500s with missing-module errors that look like a code bug. Stop the server (including its `next-server` child) first.