# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mermaid Studio — a Next.js 15 (app router) + React 19 + TypeScript app for editing Mermaid diagrams or generating them from a plain-language description via an LLM. Generated diagrams are persisted as **conversations** in SQLite and listed on a home page. UI is selectable per visit via `?ui-style=<id>` (default: `neo-brutalism`; `newspaper` is the second style). Light/dark themed, pan/zoom interactive preview.

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

Persistence settings (see "Conversations & persistence" below):

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_PATH` | `./data/mermaid-studio.db` | SQLite file. Point it at a persistent volume in production. |
| `AUTOSAVE_INTERVAL_MS` | `2000` | Debounce for the title/source auto-save. `0` disables it; values below 500 are clamped to 500. |
| `DEFAULT_OWNER_ID` | `default` | Owner every conversation belongs to. The app is single-user today. |

## Path alias

`~/*` resolves to project root (configured in `tsconfig.json`). Use `~/components/...`, `~/lib/...`, `~/hooks/...`, `~/server/...` — not relative `../../..` chains.

## Architecture

```
app/
  page.tsx                       # HOME — lists saved conversations; reads the DB directly (server component)
  editor/page.tsx                # EDITOR — ?c=<id> opens a saved conversation; ?ui-style picks the style
  layout.tsx                     # ThemeProvider + metadata (canonical/OG/Twitter/JSON-LD)
  robots.ts                      # robots.txt — allows /, disallows /api/, points at the sitemap
  sitemap.ts                     # sitemap.xml — entries for / and /editor
  icon.svg                       # Favicon (Next.js file convention)
  api/chat/route.ts              # POST /api/chat — multi-turn generate + persist + title (nodejs runtime)
  api/conversations/route.ts     # POST /api/conversations — create (used by auto-save)
  api/conversations/[id]/route.ts # PATCH (auto-save) + DELETE
  api/generate/route.ts          # POST /api/generate — legacy one-shot path, kept working but unused
  globals.css                    # Tailwind v4 + dark variant + base reset only. No per-style CSS.

components/
  diagram.tsx                    # Controlled Mermaid renderer; mounts viewport hook, sanitizes output
  diagram-toolbar.tsx            # Floating zoom controls; carries [data-diagram-toolbar] so gestures skip it
  diagram-helpers.ts             # Pure helpers: view clamping, SVG dimensions, wheel/pinch math

  styles/                        # Multi-style UI — each style is a code-isolated folder
    ids.ts                       #   StyleId, DEFAULT_STYLE_ID, STYLE_METADATA, isKnownStyleId (pure)
    urls.ts                      #   styleEditorHref() / styleHomeHref() (pure)
    registry.ts                  #   STYLE_PAGES: { home, editor } per style, lazy via next/dynamic
    router.tsx                   #   Client component: resolves ?ui-style=, picks the page, falls back on unknown
    neo-brutalism/
      HomePage.tsx               #   Card list of saved conversations
      EditorPage.tsx             #   The original editor UI (was app/page.tsx before the refactor)
      style-switcher.tsx         #   Dropdown; target="home" | "editor"
      theme.css                  #   --neo-* tokens + .neo-* utilities + .surface-* aliases
    newspaper/
      HomePage.tsx               #   Card list, editorial layout
      EditorPage.tsx             #   Editorial editor: serif masthead, hairline borders, terracotta accent
      style-switcher.tsx         #   Inline nav; target="home" | "editor"
      theme.css                  #   --paper-* tokens + .surface-* aliases

hooks/
  use-conversation.ts            # Conversation state: chat, title, source, save orchestration
  use-conversation-list.ts       # Home-page list state + delete
  use-autosave.ts                # Generic debounced save with flush-on-hide
  use-shared-source.ts           # Applies a #s= share hash to the editor on mount
  use-mermaid-viewport.ts        # Pan/zoom lifecycle: fit, animation, ResizeObserver, key handlers
  use-diagram-pointer-gestures.ts # Touch/mouse drag + two-pointer pinch; ignores clicks on toolbar
  use-diagram-wheel-gestures.ts  # Wheel + Safari `gesturestart/change/end`; trackpad detection
  use-effect-event.ts            # Polyfill for React 19's experimental useEffectEvent (stable ref)

lib/
  utils.ts                       # cn() = clsx + tailwind-merge
  site.ts                        # siteUrl / siteName / siteDescription — canonical origin + metadata copy
  download.ts                    # SVG/PNG export (see "Export pipeline" below)
  mermaid/config.ts              # buildMermaidConfig(), getMermaidThemeVariables(), DOMPurify options
  mermaid/default-source.ts      # The diagram a fresh editor starts with
  mermaid/security.ts            # sanitizeMermaidSourceForRender() + enforceSafeMermaidLinks()
  conversations/types.ts         # DTOs shared by client and server
  conversations/messages.ts      # buildLlmHistory() / normalizeLlmMessages() (pure)
  conversations/title.ts         # sanitizeTitle() / deriveFallbackTitle() (pure)
  conversations/format.ts        # formatRelativeTime() / formatDate() (pure)

server/
  config/settings.ts             # defaultOwnerId() / autosaveIntervalMs()
  db/client.ts                   # Lazy node:sqlite singleton (globalThis) — never opened at module scope
  db/schema.ts                   # PRAGMA user_version migrations (idempotent)
  db/conversations.ts            # Owner-scoped repository
  generate/generate.ts           # generateMermaidDiagram(prompt, history)
  generate/llm.ts                # callLlm() — Anthropic- and OpenAI-compatible wire formats
  generate/title.ts              # TITLE_SYSTEM_PROMPT + generateTitle()
  generate/config.ts             # readLlmConfig() from env
  generate/prompts.ts            # SYSTEM_PROMPT (output rules, palette, editing rules, few-shots)
  generate/format.ts             # toTaggedMessage / extractTaggedSection for tagged LLM input
  generate/constants.ts          # MAX_OUTPUT_TOKENS=8000, MAX_GENERATE_ATTEMPTS=1, model defaults
  rate-limit.ts                  # Per-client fixed-window limiter with a per-bucket ceiling
```

## Conversations & persistence

A saved diagram is a **conversation**: a transcript plus exactly one copy of the current Mermaid source.

- The **source lives in one place** — `conversations.source`. The `messages` table holds the transcript (user prompts + a one-line assistant acknowledgement), never a second copy of the diagram.
- The **title is generated once** and then frozen. `setGeneratedTitle` writes `WHERE title = '' AND title_edited = 0`, so a manual rename that lands while the title request is still in flight wins.
- **Both the title and the source are manually editable.** A manual title write sets `title_edited = 1`, which permanently stops the server from replacing it.
- The **server owns the transcript**: a chat message is written by the same request that generates the diagram, so the two can never disagree. The client only persists what a human edits.
- **Auto-save** is a trailing debounce (`hooks/use-autosave.ts`), not an interval — every change restarts the timer. A pending write is flushed when the tab is hidden or the component unmounts (`fetch(..., { keepalive: true })`).
- `applySource` (share hash) and `markPersisted` (server already stored the diagram) tell the autosave hook that a change must **not** be written back.

### SQLite driver

`node:sqlite`'s `DatabaseSync`. Two consequences:

- **Bun does not implement `node:sqlite`.** `bun run dev|build|start` still works because `node_modules/.bin/next` has a `#!/usr/bin/env node` shebang and Bun honours it for bin resolution — Next runs under Node. `bun run --bun dev` (or a `bunfig.toml` with `[run] bun = true`) breaks the DB.
- **`bun test` runs under Bun**, so no test may import `server/db/*`. Tests cover the pure modules only (`lib/conversations/*`, `components/styles/urls.ts`).

The database file defaults to `./data/mermaid-studio.db` (`/data/` is gitignored). It lives on the local filesystem: on an ephemeral/serverless deployment the data does not persist.

## URL-based style selection

- `/` → home page (the list of saved conversations)
- `/editor` → the editor; `?c=<conversationId>` opens a saved conversation
- `?ui-style=neo-brutalism` (the default, omitted from the URL) or `?ui-style=newspaper`
- Anything else (including `garbage`) → silently falls back to neo-brutalism. Never 404.

Implementation: `app/page.tsx` and `app/editor/page.tsx` are async server components that await `searchParams` (Next 15 promise-based searchParams, kebab-case key) and pass `uiStyle` to `<HomeStyleRouter />` / `<StyleRouter />`. The router uses `isKnownStyleId()` to validate, then renders the matching page from `STYLE_PAGES`. `STYLE_PAGES` is built with `next/dynamic` (code-split per style, **not** `{ ssr: false }`) so only the selected style's CSS and JS load, while the page itself still server-renders for crawlers.

Each style's page renders its own style switcher. The switcher `router.replace(...)`s to the target URL — never pushes, so the back button doesn't accumulate style swaps. The editor's switcher keeps `?c=` when it moves between styles.

The shared link is `${origin}/editor#s=…` — the conversation id must never leak into a shared link.

## Surface-class contract

The shared components (`<Diagram />`, `<DiagramToolbar />`, the pan/zoom layer) must work in **every** style without knowing about any specific style. The contract: shared code references neutral class names; each style's `theme.css` provides them.

| Class | Used by | Visuals defined in |
|---|---|---|
| `.surface-stamp` | `<Diagram />` error banner | each style's `theme.css` |
| `.surface-button-muted` | `<DiagramToolbar />` zoom/fit buttons | each style's `theme.css` |
| `.surface-interactive-layer` | `<Diagram />` pan/zoom layer (border + bg) | each style's `theme.css` |

`neo-brutalism/theme.css` defines these with neo visuals (thick border, offset shadow); `newspaper/theme.css` defines them with paper visuals (hairline + transparent or terracotta left rule). When adding a new style, **register it in `STYLE_PAGES` first** (lazy load) and provide all three surface classes in its `theme.css`, otherwise the shared components will render unstyled in that style.

Page-level markup is **not** part of the contract. The home page, the editor and the chat panel are per-style and theme themselves with raw tokens (`bg-[hsl(var(--paper-panel))]`, `border-[hsl(var(--paper-rule))]`, `shadow-[3px_3px_0_0_#000]`). Only genuinely cross-style components use `.surface-*`.

Shared components must not hard-code colours, borders or hover/active states — those come from the style's `.surface-*` rules. A Tailwind colour utility on a shared component silently overrides the themed value (utilities beat `@layer components`), which is how the toolbar once ended up with ~1.3:1 contrast in newspaper dark mode.

## Code editor layers

`<CodeEditor />` paints in three layers: the gutter (line numbers), the overlay (a tokenized `<pre>` that paints the glyphs) and the textarea (transparent text, so only the caret is interactive). **The caret layer and the paint layer must lay text out identically** — same font, same wrapping, same tab stops — or the caret drifts away from the glyph and Backspace deletes somewhere the user isn't pointing at.

The properties that must match: `font-family`, `font-size`, `line-height`, `white-space`, `tab-size` and the left padding. Two traps:

- **An unlayered rule beats every `@layer`.** A `textarea, input { font-family: inherit }` left outside `@layer base` in `app/globals.css` silently overrode the themes' `@layer components` font, so the textarea fell back to the sans-serif app font while the overlay stayed monospace.
- **The textarea soft-wraps by default.** `white-space: pre-wrap` (plus `wrap="off"`) makes it disagree with the overlay's `white-space: pre`; every wrapped line shifts the caret a row away from its glyph.

Verify by measuring, not by inspection: mirror the textarea's computed styles into a hidden div, then compare the caret's x/y with the overlay's glyph rect for the same character offset. They should be identical (dx = dy = 0), including when the editor is scrolled horizontally and at the bottom of the vertical range.

## Layout engine

`lib/mermaid/config.ts` pins `layout: "dagre"`. Mermaid's `"elk"` layout lazy-loads `elkjs` as a separate chunk (~423 KB gzipped) that the browser downloads on first render; dagre ships inside the main bundle. Measured on a production build: 793 KB of JS transferred with elk vs 366 KB with dagre. Switch back only if a diagram type needs ELK's routing — and re-measure the transfer cost when you do.

## Responsive layout

Below the `sm`/`md` breakpoint each style switches from a fixed-viewport app shell (`h-screen`, panes side by side) to a scrolling document: `h-auto` on `<main>`, `overflow-visible` on the workspace, a fixed-height preview (`45vh`), and an explicitly sized code editor (`h-64` / `h-56`) so the generator card stays reachable. Two rules learned the hard way:

- A flex child with `flex-1` and no definite height collapses to 0 px inside an auto-height column — the code editor needs an explicit height on mobile.
- The editor panel must not be `overflow-hidden` with content taller than the panel, or the Send button is clipped and unreachable.

## SEO / metadata

`app/layout.tsx` owns the metadata (title template, description, canonical, Open Graph, Twitter, robots directives) and injects a `WebApplication` JSON-LD block. `app/robots.ts` and `app/sitemap.ts` are Next.js file conventions; `app/icon.svg` is the favicon. The canonical origin comes from `NEXT_PUBLIC_SITE_URL` (see `lib/site.ts`) and falls back to `http://localhost:3000` — set it in production or the canonical, OG and sitemap URLs will point at localhost. The home page is the canonical root (`/`); `app/editor/page.tsx` declares its own `alternates.canonical = "/editor"` so the `?c=` variants collapse onto one URL.

## API abuse control

`server/rate-limit.ts` applies a per-client fixed window before the request is parsed. The ceiling is per bucket, so one endpoint's traffic cannot starve another's:

| Bucket | Ceiling | Why |
|---|---|---|
| `chat:<client>` | 10/min | Generation spends money per call. |
| `generate:<client>` | 10/min | The legacy one-shot path. |
| `conversations:create:` | 30/min | One call per new conversation. |
| `conversations:autosave:` | 120/min | Auto-save fires on every edit — a 2 s interval would blow a 10/min ceiling. |
| `conversations:delete:` | 30/min | Rare but destructive. |

The limiter is in-process: on serverless each instance keeps its own counters, so treat it as friction rather than a quota. The stored ceiling is remembered per key, so a bucket's limit cannot be raised mid-window.

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

- Each style folder is **self-contained**: its `theme.css` is imported at the top of its `HomePage.tsx` / `EditorPage.tsx`, and its CSS variables + utility classes don't leak into other styles.
- Tailwind v4 with `@custom-variant dark (&:where(.dark, .dark *));` (in `app/globals.css`).
- Use `cn()` for conditional class merging — never template-literal class strings with conditional `&&`.
- **Every colour token is an HSL triplet** (`--paper-ink: 0 0% 10%`), never a hex value: the tokens are consumed as `hsl(var(--token))`, and a hex value makes that expression invalid at computed-value time, so the property silently falls back to the inherited colour.
- **The page background belongs to the page, not to `<body>`.** A `body { background }` rule in a style's `theme.css` leaks into the next style after a client-side navigation (the previous stylesheet stays in the document). Each style paints its own root element instead: `.neo-page` in `neo-brutalism/theme.css`, `bg-[hsl(var(--paper-bg))]` on `<main>` in newspaper.

## Things to be careful about

- `server/generate/generate.ts` is server-only — never import from a `"use client"` file.
- Deleting a conversation is a **two-step, in-page confirmation** (`hooks/use-conversation-list.ts`): the first click arms the button, the second one deletes, and the arming lapses after 5 s. Never `window.confirm()` — it blocks the page, cannot be themed, and renders with OS chrome in dark mode.
- `lib/mermaid/security.ts` `enforceSafeMermaidLinks` uses `window.location.origin`; it's only safe to call in the browser (Diagram component calls it post-mount).
- `useEffectEvent` polyfill returns a stable callback — wrap values used inside effects that you don't want to retrigger on prop changes (see `use-mermaid-viewport.ts` for `reportRenderComplete`).
- `MAX_GENERATE_ATTEMPTS = 1` (server/generate/constants.ts) — bumping requires structured-feedback retry logic that doesn't exist yet.
- DOMPurify options in `MERMAID_SVG_SANITIZE_OPTIONS` allow `svgFilters` + `html` profiles (Mermaid's inline-styled labels need them) and forbid `<script>`. URL safety is enforced separately.
- `next/dynamic` is used in `components/styles/registry.ts` to lazy-load each style's home and editor pages. Don't import a style's page statically anywhere outside the registry — it would bundle both styles into the initial JS.
- `downloadPng`'s default fallback is `"white"` for `backgroundColor`. Both `EditorPage.tsx`s always pass `getMermaidThemeVariables(isDark).background`, so this fallback is dormant. Don't remove the explicit option passing when writing a third style.
- `next.config.js` sets a CSP plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS on every route. Inline scripts/styles are unavoidable (Mermaid's inline-styled labels, `next-themes`' bootstrap script); `'unsafe-eval'` is added in dev only. If you add a third-party script, it must be same-origin or explicitly allow-listed.
- `bun run build` and `bun run dev` share `.next/`. Never build while the dev server is running — it replaces the dev server's chunks and the app then 500s with missing-module errors that look like a code bug. Stop the server (including its `next-server` child) first.
- **Never open the database at module scope.** `next build` imports route modules while collecting page data, which would create a stray database file at build time. `server/db/client.ts` opens the file lazily inside `getDb()`; after a build, `ls data/` must show no database file.
- `server/db/*` is server-only. Importing it from a `"use client"` file pulls `node:sqlite` into the browser bundle and breaks the build.
- The auto-save hook compares a **key**, not the payload. `saveKeyFor()` deliberately excludes an untouched title (the server owns it until a human edits it) — changing that key shape desynchronises the hook's notion of "what is persisted".