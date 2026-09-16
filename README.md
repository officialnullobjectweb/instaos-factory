# Instagram Factory OS

The internal operating system for running three Instagram brands from one dashboard:
**Midnight Ritual**, **Studio Noir** and **The Daily Grind**.

## The niche & experiment programme

Three main niches → **nine sub-niches** (three each, chosen for pain points or proven
demand), each with profiled audiences and **two design variants (A/B)**:

- *Geography*: Oceans & Chokepoints · Cities & Systems · Geography of Money
- *Psychology*: Attention & Focus · Money Psychology · Social Instincts
- *Branding*: Founder Positioning · Personal Brand Systems · Brand Culture & History

Each variant is a full design (palette, typography, footer, content angle) with a
stated thesis about its audience. Generate posts tagged with sub-niche/variant/audience,
publish both, paste the real Insights numbers into **Experiments**, and the winner is
promoted — the ledger persists in `data/experiments.json`. The factory then serves the
formats demand has proven.

## Design Studio

A complete in-house carousel design engine (no Canva, no external services):

- **Render**: slides are pure SVG (1080×1350) — deterministic, server-rendered, no browser
- **Export**: PNG (resvg with self-hosted fonts), PDF (one page per slide), ZIP of slides
- **Templates**: three editorial systems — Geography (cartographic), Psychology
  (calm editorial), Branding (typographic) — each with typography, spacing, palette,
  footer branding and slide numbering
- **Editor**: visual controls for colours, fonts, sizes, margins, footer; reusable
  presets saved to `data/design-templates.json`
- **Preview**: desktop, Instagram feed framing, and a 7-slide grid
- **Quality**: 45-word slide limit, auto-fit typography (shrink-to-fit with a visible
  scale badge), safe margins, and a live WCAG contrast checker — failures block export
- **Assets**: a local vector library (world map from TopoJSON, icons, illustrations,
  patterns, flag abstractions) — nothing is fetched at render time

The repository covers **Phase 1 — the foundation** (routing, design system, navigation,
state architecture, reusable components, dashboard), **Phase 2 — the content queue**
(the seven-state post lifecycle, a Notion-style queue, a full review drawer, version
history with diffs, and a file-backed repository with API routes) and **Phase 3 — the
AI generation engine** (a three-provider fallback chain, the eight-step pipeline,
prompt library with Zod-validated output, JSON repair, and a full request/response
audit log).

Nothing is published to Instagram yet; the pieces that would call those services state
that plainly instead of faking success.

---

## AI generation engine

The engine is real, not a simulation: it calls Gemini (primary), falls back to Groq,
then OpenRouter, each with exponential backoff, `Retry-After` handling and JSON repair
(deterministic first, then one model-backed repair pass). Every request and response is
stored in `data/ai-logs.json` and readable on the dashboard and in Settings → AI engine.

With **no API keys configured**, an offline provider (`AI_ENABLE_LOCAL_PROVIDER=true`,
already set in `.env.local`) sits last in the chain and satisfies the same schemas, so
the entire pipeline — topic → research → verify → carousel → caption → hashtags → alt
text → quality → queue insert — runs end to end and is testable without credentials.
A hosted key always wins over it.

```bash
cp .env.example .env.local   # then paste GEMINI_API_KEY (or rely on the offline engine)
```

Generation is triggered from **Generate post** in the command bar (⌘⏎), the sidebar
button, the dashboard quick action, or the command palette. The finished post lands in
the queue as `pending_review` immediately.

---

## Stack

| Concern      | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| Framework    | Next.js 15 (App Router, Turbopack)                            |
| UI           | React 19, TypeScript (strict)                                 |
| Styling      | Tailwind CSS v4 with `@theme` design tokens                   |
| Primitives   | shadcn/ui-style components on Radix UI                        |
| Motion       | Framer Motion (150–250 ms fades, slides and scales only)      |
| Icons        | Lucide (plus a hand-drawn Instagram glyph — see `components/icons.tsx`) |
| State        | React Context for shell layout + Zustand for posts/UI/notifications |
| Search       | cmdk                                                          |
| Toasts       | Sonner                                                        |
| Persistence  | `data/posts.json` behind a repository + Route Handlers        |
| Fonts        | Inter + Geist Mono via `next/font`                            |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (all routes prerender as static)
npm run lint     # eslint
npx tsc --noEmit # typecheck
```

## Routes

| Route        | Purpose                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `/`          | Dashboard: metrics, review queue, activity, automation, calendar, health |
| `/queue`     | Content queue: table/card views, filters, review drawer, version history |
| `/templates` | Template library with per-brand previews                                |
| `/schedule`  | Approval-gated publishing: calendar/timeline/list, queue, audit log     |
| `/analytics` | Reach/engagement trends, brand comparison, per-post detail, learning    |
| `/studio`    | Design engine: carousel editor, alignment, quality gate, PNG/PDF/ZIP    |
| `/experiments` | A/B design variants per sub-niche, scored from real Insights numbers  |
| `/settings`  | Workspace, brands, AI engine, Instagram accounts, automation and team   |

## Folder structure

```
src/
  app/               routes only — (workspace) group holds the shell layout
  components/
    ui/              design-system primitives (button, card, dialog, sheet, …)
    layout/          shell: sidebar, topbar, page header, section, loading
    content/         content-card, metric-card, calendar-card, status badge, …
    data/            filter bar, filter select, pagination, search input
    command/         command palette (⌘K)
    notifications/   notification bell
    feedback/        empty state, shortcut reference
    icons.tsx        brand glyphs lucide no longer ships
  features/          one folder per product surface (dashboard, queue, …)
  design/            the carousel design engine (shared by client and server)
    compose.ts       text-block geometry — the single source of layout truth
    fit.ts           greedy line wrap + shrink-to-fit against that geometry
    templates.ts     the three template systems (geography/psychology/branding)
    quality.ts       word limits, safe-area and WCAG contrast rules
    server/          renderer (SVG → raster), exports (PNG/PDF/ZIP), assets
  lib/               pure helpers: format, metrics, calendar, motion, status
    storage/         the persistence layer (see below)
    security/        token encryption, guards, rate limiting
    repositories/    the only modules that persist or read domain state
    posts/           domain logic: generator, query model, version diffs
    insights/        analytics + self-learning engine
    scheduling/      approval rules, schedule validation, retry policy
    instagram/       Graph API client, metadata cleaner, publish bridge
    api/             typed clients for every API surface
  hooks/             reusable client hooks (autosave, queue shortcuts, posts, …)
  providers/         app shell providers (tooltips, sidebar, keyboard shortcuts)
  store/             Zustand stores (posts, UI overlays, notifications)
  types/             domain model + shared UI types
  data/              typed mock data, anchored to a fixed timestamp
  middleware.ts      CSRF protection + security headers on every request
  styles/            globals.css — design tokens, base layer, utilities
data/
  posts.json            30 generated posts with slides, sources, logs, versions
  schedule.json          publishing slots, attempts and retry state
  audit.json            every approval, rejection, edit and publish event
  instagram-accounts.json  pages + access tokens (server-side only)
  instagram-history.json   publish history: media id, permalink, timestamp
  design-templates.json    saved design presets
  experiments.json         A/B variant decisions per audience
  insights.json            analytics rollup + per-post records (empty until real sync)
  learning.json            learned topic weights + recommendation history
  ai-logs.json             every provider request and response
scripts/
  autopilot.mjs        local autonomy: server supervisor + tick/batch/learning scheduler
  build-fonts.mjs      woff2 → TTF for the server renderer (npm prebuild/predev)
  scheduler-tick.mjs   stands in for the GitHub Actions cron locally
  learning-run.mjs     cron entry point for the weekly learning run
```

Rules of thumb: routes stay thin and delegate to `features/`; anything reused by two
features moves into `components/`; decision logic that has no React dependency lives in
`lib/` so it stays testable.

## Architecture at a glance

```
                        ┌───────────────────────────────────────┐
                        │              Next.js app              │
                        │  Server Components first; client      │
                        │  islands only where interaction needs │
                        └──────────────┬────────────────────────┘
                                       │ typed clients (src/lib/api)
                        ┌──────────────▼────────────────────────┐
                        │            API routes (thin)          │
                        │  middleware: CSRF + security headers   │
                        │  per-route guards: cron/webhook auth   │
                        │  rate limit: generate + publish        │
                        └──┬──────────┬──────────┬──────────────┘
                           │          │          │
             ┌─────────────▼──┐  ┌────▼───────┐ ┌▼──────────────────┐
             │ AI manager     │  │ Scheduling │ │ Publish pipeline   │
             │ Gemini → Groq  │  │ rules +    │ │ Graph API client,  │
             │ → OpenRouter   │  │ retry      │ │ media render,      │
             │ → offline      │  │ policy     │ │ metadata cleaner   │
             └───────┬────────┘  └────┬───────┘ └─────────┬─────────┘
                     │                │                   │
             ┌───────▼────────────────▼───────────────────▼─────────┐
             │                    repositories                       │
             │  posts · schedule · audit · accounts · history ·      │
             │  insights · learning · experiments · templates ·      │
             │  ai-logs                                              │
             └──────────────────────────┬────────────────────────────┘
                                        │ one document layer
                        ┌───────────────▼────────────────┐
                        │      storage driver (swap)      │
                        │  file: data/*.json  (local dev) │
                        │  redis: Upstash REST (vercel)   │
                        └─────────────────────────────────┘
```

Every arrow is one direction: routes → domain modules → repositories → storage. The
domain modules never know which driver is active; the storage layer never knows the
domain. Swapping file for Redis changed zero call sites.

### The storage layer (`src/lib/storage/`)

One interface, two drivers, one document layer:

- **`types.ts`** — the `StorageDriver` contract: `get/set/delete/keys`, values are
  versioned envelopes so optimistic concurrency is possible on any backend.
- **`file-driver.ts`** — resolves a writable directory (repo `data/` locally, `TMPDIR`
  if unwritable), atomic write-then-rename, mtime-cached reads.
- **`redis-driver.ts`** — Upstash REST via the official SDK, same contract.
- **`document.ts`** — the JSON-document semantics all twelve repositories used to
duplicate (~60 lines each): module-level cache, promise-chained writes, mtime checks,
seed-fallback for first boot, and a rule that an existing-but-unparseable document is
never silently replaced by its seed.

Domain code only ever calls `doc.get()` / `doc.mutate()`, so adding a driver later
(Postgres, D1) touches one file. And the repositories are dumb on purpose — everything
resembling business logic (approval transitions, retry policy, publish idempotency)
lives in `lib/scheduling`, `lib/instagram` or the route, where it can be read without
knowing how JSON is serialised.

## Design system

Premium monochrome, defined once in `src/styles/globals.css` and consumed as Tailwind
utilities (`bg-canvas`, `text-ink-2`, `border-line`, `shadow-card`, …).

| Token             | Value     | Utility          |
| ----------------- | --------- | ---------------- |
| Background        | `#FAFAF8` | `bg-canvas`      |
| Surface           | `#FFFFFF` | `bg-surface`     |
| Surface secondary | `#F4F4F2` | `bg-surface-2`   |
| Border            | `#E8E8E5` | `border-line`    |
| Primary text      | `#111111` | `text-ink`       |
| Secondary text    | `#6B6B68` | `text-ink-2`     |
| Accent            | `#111111` | `bg-ink`         |
| Success           | `#1F7A4D` | `text-success`   |
| Warning           | `#B7791F` | `text-warning`   |
| Danger            | `#B42318` | `text-danger`    |

No gradients, no glassmorphism, no decorative colour. Radius scale is 18–24 px for
surfaces and pills for controls. Content is aligned to a 1440 px container
(`shell-container`). Spacing follows the 8-point system. Semantic colours are reserved for
state, never for decoration.

## State architecture

- **React Context** (`providers/sidebar-provider.tsx`) — shell layout state: collapsed
  sidebar and mobile sheet. It is only consumed inside the workspace tree, so a store
  would be overkill.
- **Zustand** — `store/posts-store.ts` (the queue: posts, filters, sort, selection,
  view mode, pagination and every mutation with optimistic rollback),
  `store/ui-store.ts` (command palette, shortcut dialog, density) and
  `store/notification-store.ts` (bell feed).
- Selectors stay primitive and derived values are memoised in `hooks/`, so `useSyncExternalStore`
  snapshots never churn.
- The topbar brand scope and the queue's brand filter are the **same value** — one source
  of truth keeps dashboard, queue and calendar in agreement (`hooks/use-scope.ts`).

## Content queue

The queue is the product's centre of gravity, so it is the one surface with a real
data path rather than in-memory mock state.

```
data/posts.json  ←  lib/repositories/posts-repository.ts  ←  app/api/posts/*
                                ↑                                        ↑
                    (temp file + atomic rename,              lib/api/posts-client.ts
                     serialised writes, versioning)                   ↑
                                                        store/posts-store.ts (optimistic)
                                                                      ↑
                                                  features/queue/** components
```

- **Lifecycle** — `draft → pending_review → approved → scheduled → published`, plus the
  two terminal states a real pipeline needs: `failed` (retryable publish error) and
  `rejected` (a human decision, carrying the reviewer's note).
- **Repository, not components** — nothing in `src/components` or `src/features` opens the
  JSON file. Writes are serialised through a promise queue and land via a temp file +
  rename, so a crash mid-write cannot corrupt the dataset.
- **Versions** — every edit that settles, regeneration and restore appends a full snapshot
  (`Version 2`, `Version 3`, …). The history panel diffs any two with a word-level
  longest-common-subsequence algorithm (`lib/diff.ts`).
- **Autosave** — inline fields write drafts on a 700 ms debounce and cut a version when
  the edit settles, so a long sentence is one version rather than twenty.
- **Views** — a Notion-style table (editable titles, sortable headers, per-row status
  control, hover decisions) and a card view with a slide-through cover; both share one
  filter set: search, status, brand, category, content type, date range and quality score.
- **Keyboard** — `A` approve, `R` reject (both open the same confirmation the mouse uses),
  `J`/`K` move the focused row, `↵` opens the drawer, `Esc` closes it. Shortcuts are
  ignored while typing.

## Keyboard & accessibility

| Shortcut      | Action                                        |
| ------------- | --------------------------------------------- |
| `⌘K` / `Ctrl+K` | Command search (pages, brands, content, actions) |
| `⌘B` / `Ctrl+B` | Collapse/expand the sidebar                   |
| `/`           | Focus the page search field                   |
| `G` then `D/Q/T/S/A/,` | Jump to Dashboard, Queue, Templates, Schedule, Analytics, Settings |
| `?`           | Shortcut reference                            |
| `Esc`         | Close the topmost overlay                     |
| `A` / `R`     | Approve / reject the focused post (queue only) |
| `J` / `K`     | Move the focused row (queue only)             |

Skip link, visible focus rings, `aria-current` on navigation, `aria-keyshortcuts` on
shortcut-bearing controls, labelled charts with screen-reader tables, and reduced-motion
support are all in place.

## Performance notes

- Route pages are server components; only interactive surfaces are client components.
- All six routes prerender as static content in the production build.
- Fonts are self-hosted by `next/font`; brand marks go through `next/image` with SVG
  handling and CDN patterns pre-configured for Instagram media.
- `optimizePackageImports` trims `lucide-react`, `framer-motion` and `date-fns`.
- Lists animate with staggered variants instead of per-item effects.

## Data: real state, no demo dataset

There is no bundled demo data. The queue, schedule, audit log and analytics start
**empty** and fill only with what the factory actually does: generate, review, schedule,
publish. `data/posts.json` is real mutable state — approving, editing, regenerating,
duplicating, restoring a version and deleting all persist through the API (locally in
`data/*.json`, in production in Upstash Redis; the seed fixtures in `data/` are all
empty arrays and exist only so a fresh store boots to a defined empty state).

The dashboard's activity trail is derived from the audit log (`GET /api/activity`),
notifications are derived from real queue state (`GET /api/notifications`), and system
health is measured from the live storage probe and the AI request log
(`GET /api/system/health`) — nothing on the dashboard is a static row.

The one deliberate static is `src/data/time.ts`: relative labels like "2h ago" render
against the live clock on the client. Analytics timestamps come from real records.
The learning engine starts with no opinion — press **Run analysis now** on `/analytics`
or let the Sunday run fill `learning.json` once there are published results to learn
from.

## Publishing

No post reaches Instagram without a human approval. The chain is:

1. `pending_review` — the post cannot be scheduled at all; the API refuses it.
2. **Approve** (`A`, or the button) — the approval dialog asks for a posting time
   and the Instagram page, then writes a slot to `data/schedule.json`.
3. **Publish** — `.github/workflows/scheduler.yml` runs `scripts/scheduler-tick.mjs`
   every 15 minutes, which calls `POST /api/schedule/process`. Anything due is rendered,
   cleaned and published through the official Graph API.
4. **Failure** — retried up to 3 times, 15 minutes apart, with the API's own error
   message stored on the attempt. `retriesRemaining` and the next attempt time are
   visible in the publishing queue.

**Instagram Graph API** (`src/lib/instagram/`) — containers → poll → publish → permalink,
for carousels, single images and reels. Expired tokens flip the account to
`token_expired` and stop the publish rather than failing obscurely; rate limits and
upload failures are classified so the retry policy can act on them. Duplicate prevention
checks history and post status *before* any upload, so a re-run or a double click cannot
post the same carousel twice. Slide PNGs are stripped of EXIF/XMP/text chunks and served
from `/api/instagram/media/{postId}/{slide}` — the URL Instagram's crawler actually
fetches, so what leaves the server is what was cleaned.

**Telegram** — a new `pending_review` post sends a message with Approve / Reject /
Open dashboard buttons. Actions run the *same* decision code as the dashboard, so the two
surfaces cannot disagree. `POST /api/telegram/callback` approves and rejects real
content, so it verifies `TELEGRAM_WEBHOOK_SECRET` and refuses every request with `503`
while that secret is unset — never open by default. Without `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_CHAT_ID` the notification step records a skip and nothing else changes.

**Audit log** — approvals, rejections, edits, scheduling, publishes and failures are all
appended to `data/audit.json` with actor and timestamp, and are readable in
Schedule → Audit.

## Design studio

Slides are SVG at 1080×1350 rendered by one pure function on the server; PNG (resvg),
PDF (pdf-lib) and ZIP (JSZip) all rasterise the *same* string the editor previews, so
approval and export cannot diverge.

`src/design/compose.ts` owns every position. Kicker, headline, body and stat form one
block with a computed baseline for each line, anchored top/middle/bottom inside the space
left under the motif band — which is why artwork and copy can no longer collide. Line
breaking lives in exactly one function (`wrapLines`), used by the composer, the fit engine
and the quality report, so all three agree on a line count.

Per-slide **Align** controls (`slide.adjust`): a 3×3 anchor grid, arrow-key and button
nudges, a type scale, and a motif scale that resizes the band it reserves. The panel
reports the composed block height against the space it has, so "does this fit?" is a
number rather than a judgement. Bounds are shared constants — the editor cannot offer a
value the engine would reject.

**The quality gate runs on the server, not just in the UI.** `POST /api/design/render`
returns `422` with the offending slides when the deck breaks a rule (45-word cap,
safe-area overflow, WCAG contrast), so a broken file cannot be exported at all. `force:
true` is the deliberate, auditable escape hatch.

## Analytics & self-learning

Every figure on `/analytics` is derived from two tables in `data/insights.json` — a
daily rollup per brand and per-post records with per-slide figures. Nothing on the page
is stored pre-computed, so the metric cards, the charts, the brand table and the
per-post drawer cannot disagree with each other. **The warehouse fills from the real
Insights sync, not a fixture** — until an Instagram account is connected and its media
insights synced, analytics renders its empty state honestly.
things that vary. Each brand publishes a fixed number of times per slot, with topics
rotating on the calendar, so all nine sub-niches get an equal number of attempts. That is
not decoration: when post volume was left to chance, volume alone swung week-over-week
reach by ±15% and the engine's rankings were reading its own noise budget.

**Learning engine** (`src/lib/insights/learning.ts`) runs every Sunday 06:00 UTC via
`.github/workflows/learning.yml` → `scripts/learning-run.mjs` → `POST /api/learning/run`,
writing `data/learning.json`. A manual run in the UI goes through the same endpoint, so a
scheduled analysis and a button press cannot produce different weights.

It emits topic weights, hook and window performance, seven recommendation cards with
per-card evidence and confidence, and next week's plan. **The weights are wired into
generation**: the topic prompt receives the learned multipliers, the preferred and
underperforming subjects, and is told to set `topicKey` to the slug it chose — which is
recorded as a `sub:` tag on the post, closing the loop from results back to prompts.

Two ranking decisions are worth knowing:

- **Windows rank on reach, not on `compositeScore`.** That composite is ~500× more
  sensitive to a relative change in engagement rate than to one in reach, so importing
  it here let a 0.02-point engagement difference between two 24-post windows outrank a
  10% reach difference — and the "best posting time" it announced was noise. A window is
a volume question; engagement rate adjusts the reach it earns.
- **Impressions live on the rollup**, so reach and impressions on the same card row
  describe one scope. Summing impressions from the window's posts on read made them a
  smaller number sitting beside a larger one, which reads as a contradiction.

## Running on autopilot (local Mac)

`scripts/autopilot.mjs` + the launchd agent `com.kamal.factory` keep the factory running
without anyone watching it. The agent is installed in
`~/Library/LaunchAgents/` and starts at login, restarts on crash (KeepAlive), and
survives reboots:

```bash
launchctl load   ~/Library/LaunchAgents/com.kamal.factory.plist   # start
launchctl unload ~/Library/LaunchAgents/com.kamal.factory.plist   # stop
```

What it does, on a loop:

- **Supervises** one production server on `http://localhost:3780` (`next start` over the
  current build; `npm run build` first after pulling changes)
- **Publish tick** every 15 minutes → `/api/schedule/process` (due schedule entries →
  Instagram Graph API)
- **Daily generation batch** at 07:00 local — one post per brand, landing in the queue
  as `pending_review`
- **Weekly learning run** once per ISO week on/after Sunday 06:30 UTC

Logs live in `logs/autopilot.out.log` and `logs/autopilot.err.log` (git-ignored); the
dedupe state for "did today's batch / this week's analysis run" is `logs/autopilot-state.json`.
Because state is in Upstash Redis, this server and a Vercel deployment share the same
queue — if you run both, keep only **one** 15-minute ticker (the autopilot or GitHub
Actions), or the two will race the same due entries.

## Deploying to Vercel (free tier)

Everything needed is in place: `vercel.json`, validated env configuration, a
serverless-safe storage layer and authenticated cron endpoints. The one hard
constraint that shaped this section: **Vercel's filesystem is read-only** (except an
ephemeral `/tmp` that instances don't share), so state must live in a real database.

### Why the pieces are shaped the way they are

One build detail worth knowing: the PNG renderer (resvg) cannot parse woff2, so
`npm run build` first converts the fonts to TTF via `scripts/build-fonts.mjs` (wired as
`prebuild`). On Vercel this runs automatically — no action needed, the converted files
are git-ignored and regenerated per build.

| Concern | Locally | On Vercel |
| --- | --- | --- |
| Persistent state (`data/*.json` semantics) | File driver, same files | **Upstash Redis** (free tier is enough) via the Redis driver |
| Publish tick (every 15 min) | `npm run scheduler:tick` | **GitHub Actions** (`scheduler.yml`) — Vercel cron on Hobby runs at most once per day, too coarse for a 15-minute queue |
| Weekly learning run (Sunday 06:00 UTC) | `POST /api/learning/run` | **Vercel Cron** (`vercel.json`) — once a week fits the Hobby limit |
| Slide PNGs | Rendered and cached | Rendered on demand by `/api/instagram/media/[postId]/[slide]` — no writable media dir |
| Instagram tokens | Encrypted at rest (AES-256-GCM) | Same, key from `TOKEN_ENCRYPTION_KEY` |
| CSRF / security headers | `src/middleware.ts` | Same (Edge middleware) |

If Upstash is not configured on a Vercel deployment the app **refuses to start writes**
with an actionable error rather than silently dropping them; `GET /api/health` reports
which store is live.

### Step by step

1. **Create the database** — [upstash.com](https://upstash.com) → Create database →
   Regional (pick the same region as your Vercel function) → Free. Copy the **REST URL**
   and **REST token** from the console (the REST API, not the Redis port).

2. **Push to GitHub** and import the repo at [vercel.com/new](https://vercel.com/new).
   Framework preset: Next.js. Everything else defaults.

3. **Set environment variables** (Project → Settings → Environment Variables). Minimum
   for a working deployment:

   ```
   UPSTASH_REDIS_REST_URL=     # from step 1
   UPSTASH_REDIS_REST_TOKEN=   # from step 1
   SCHEDULER_SECRET=           # any long random string; GitHub Actions will send it
   CRON_SECRET=                # another long random string; Vercel cron sends it
   GEMINI_API_KEY=             # optional — without it generation needs AI_ENABLE_LOCAL_PROVIDER=1 (dev only)
   ```

   Recommended additions, all documented in `.env.example`: `TOKEN_ENCRYPTION_KEY`
   (required before connecting an Instagram account), `APP_BASE_URL` if you attach a
   custom domain, `STORAGE_PREFIX` to share one Redis database across deploys, and the
   Telegram trio if you want review notifications.

4. **Verify** — open `https://your-app.vercel.app/api/health`. It returns status,
   which storage driver is active and which integrations are configured (never secret
   values). Then run the 15-minute publisher: `npm run scheduler:tick --` against your
   URL should return `200` from `/api/schedule/process`.

5. **Wire the scheduler tick** — the repo already contains
   `.github/workflows/scheduler.yml`. Add repository secrets
   `SCHEDULER_URL` (your `https://your-app.vercel.app`) and `SCHEDULER_SECRET`, and it
   starts driving the publish queue every 15 minutes.

6. **The weekly learning run needs no wiring** — `vercel.json` registers the Sunday
   cron; Vercel injects `CRON_SECRET` as a Bearer header automatically.

### Free-tier limits worth knowing

- **Vercel Hobby**: 1 cron job (used for the weekly learning run), 100 GB-hrs of
  function time — the app is server-render-on-demand, nowhere near the cap for a
  single-operator tool.
- **Upstash free**: 10k commands/day. The document layer caches reads in memory per
  instance, so a dashboard session costs a handful of commands, not hundreds.
- **GitHub Actions**: 2,000 minutes/month free for private repos; the tick uses ~1 min
  per run at 96 runs/day ≈ 3,000 min — if you hit that, run the tick from a second
  free GitHub account's runner or upgrade Actions. Public repos are unlimited.

### Production behaviour changes to expect

- The offline AI provider is **off by default in production** — generating without a
  real provider key returns an honest error instead of fixture copy (`AI_ENABLE_LOCAL_PROVIDER=1`
  re-enables it deliberately).
- `SCHEDULER_SECRET` / `CRON_SECRET` / `TELEGRAM_WEBHOOK_SECRET` become **required** —
  the guarded endpoints refuse to run unauthenticated in production rather than staying
  open as they silently would in dev.
- JSON document writes are serialised per key and version-checked against Redis `WATCH`,
  so two serverless instances cannot clobber each other's read-modify-write.

## Next phase

Real Insights sync via the Graph API's media insights endpoints, replacing the seeded
`data/insights.json` so the learning engine weights live numbers rather than a fixture.
Also a post → design-document link, so a queue post carries its own carousel layout
instead of the template default when it is rendered for publishing.
