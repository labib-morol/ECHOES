# Echoes — Complete Handoff Document

A single comprehensive reference for the Echoes project. This document is written so that another engineer (human or AI) can read it and have a complete picture of the product, the design system, every feature, every component, every behavior, every API surface, and every known deviation or follow-up. It supersedes nothing — `CLAUDE.md` is still the project bible — but it is the most complete description of *what currently ships*.

---

## 1. Identity

**Echoes** is an anonymous thought-streaming web app for ages 14–28. People release unfiltered thoughts onto a dark wall. There are no accounts, no identity, no follower counts. It is a release tool, not a social network.

Production URL: hosted on Vercel (free tier). Database + Realtime: Supabase. AI: Groq (`llama-3.1-8b-instant`).

### Core philosophy (do not violate)
- This is a release tool, not a social network. Never add anything that creates social comparison, follower counts, popularity signals, trending, or public reaction metrics.
- Aesthetic quality matters more than features. The wall is the heart.
- `key_hash` must never appear in any API response.
- Every wall query must filter `WHERE expires_at > NOW()`.
- `felt_count` is private to the key-holder. It is never shown publicly.
- Crisis content stays on the wall — it is not removed. A quiet helpline line is shown beneath it.
- Dark emotional venting is the entire point. Moderation only blocks spam, slurs, hate, threats. It never touches the dark.

---

## 2. Tech Stack

- **Next.js 14.2.35** (App Router, TypeScript) — `next.config.ts` is *not* supported in Next 14; use `next.config.mjs`.
- **React 18**
- **Tailwind CSS 3.4** — used for resets and a few utility classes; most styling is inline / via globals.css.
- **Framer Motion 12** — drives all animations (variants, layoutId, AnimatePresence, useAnimationControls).
- **Supabase JS 2.105** — Postgres + Realtime + RLS (anon key only on client; no service role anywhere).
- **Groq SDK 1.1** — server-side LLM for mood detection + moderation.
- **Upstash Ratelimit 2 + Redis 1.38** — sliding-window IP-based rate limits on POST endpoints.
- **html-to-image 1.x** — used by `lib/share.ts` to rasterize a styled DOM node into a PNG blob for the share-as-image feature.

### Fonts (loaded via `next/font/google`)
- **Playfair Display** — italic 400/700 — used for the wordmark, all thought text (cards + expanded), the empty-state line, the onboarding sentence, and the small under-wordmark tagline.
- **Syne** — 400/500/600 (also 300 used inline) — UI font: filter pills, mood tags, footer, toasts, buttons.
- A monospace stack (`ui-monospace, SF Mono, JetBrains Mono, Courier New, monospace`) is used inline for the unlock input + buttons and the time-relative tag inside cards.

---

## 3. Repository Structure

```
/app
  layout.tsx              fonts, global CSS, metadata, env-check on server
  page.tsx                main wall page (client) — owns most app state
  globals.css             dark base, grain overlay, scrollbar hiding,
                          mobile masonry, depth-tier filter, custom rules
  /api
    /thoughts/route.ts    GET wall + POST create
    /felt/route.ts        POST increment felt_count
    /key/route.ts         POST hash and look up own thought ids
    /health/route.ts      GET liveness + Supabase connectivity
/components
  Wall.tsx                absolute-positioned card container
                          (cinematic stagger via variants, x-clamp [2,78])
  ThoughtCard.tsx         individual card + layoutId expand-in-place
  ComposeModal.tsx        write + release flow, key-reveal screen
  AboutModal.tsx          "what is this" overlay (top-bar ? button)
  FilterBar.tsx           horizontal pill bar with search-pill toggle
  FractureLines.tsx       SVG hairline cracks on the wall background
  EmberParticles.tsx      slow rising specks of warmth
/lib
  supabase.ts             anon-key client (used by both server and client)
  groq.ts                 Groq client + detectMood + moderateContent
  ratelimit.ts            Upstash sliding-window limiters
  env.ts                  checkEnv() — server-side missing-var logger
  utils.ts                key gen, SHA-256, mood color, position assignment,
                          card width / typography / preview, time format
  share.ts                renderThoughtImage + shareOrDownload (html-to-image,
                          1080×1920 PNG, Web Share API + download fallback)
  types.ts                Thought interface
schema.sql                Postgres schema + RLS policies + indexes
prompts.md                historical build prompts
SETUP.md                  human setup steps
README.md                 next.js boilerplate readme
vercel.json               { "functions": { "app/api/**/*.ts": { "maxDuration": 10 } } }
next.config.mjs           security headers + images.unoptimized: false
.gitignore                node_modules, .next, .env, .env*.local, *.log, .vercel
.env.local                NOT committed; required keys listed in §4
HANDOFF.md                this file
CLAUDE.md                 project bible — read this before changing anything
```

---

## 4. Environment Variables

All five are required. The check is in `lib/env.ts` and runs server-side from `app/layout.tsx` on every request.

| Var | Where it's used | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server (lib/supabase.ts) | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server (lib/supabase.ts) | yes |
| `GROQ_API_KEY` | server only (lib/groq.ts) | **no** |
| `UPSTASH_REDIS_REST_URL` | server only (lib/ratelimit.ts) | **no** |
| `UPSTASH_REDIS_REST_TOKEN` | server only (lib/ratelimit.ts) | **no** |

Only the two `NEXT_PUBLIC_*` values are allowed to ship to the browser. If anything else is ever prefixed `NEXT_PUBLIC_`, treat it as a security bug.

---

## 5. Database Schema

`schema .sql` (yes, the filename has a literal space) creates a single `thoughts` table.

```sql
CREATE TABLE IF NOT EXISTS thoughts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content         TEXT NOT NULL CHECK (char_length(content) >= 3
                                       AND char_length(content) <= 280),
  mood            TEXT NOT NULL DEFAULT 'untagged',
  mood_color      TEXT NOT NULL DEFAULT '#888888',
  key_hash        TEXT NOT NULL,
  felt_count      INTEGER DEFAULT 0,
  is_crisis       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  position_x      FLOAT NOT NULL DEFAULT 50,
  position_y      FLOAT NOT NULL DEFAULT 50,
  rotation        FLOAT NOT NULL DEFAULT 0,
  opacity_level   FLOAT NOT NULL DEFAULT 1.0
);
```

### Row-level security
- `Public can read active thoughts` — `SELECT` allowed when `expires_at > NOW()`.
- `Anyone can post a thought` — `INSERT` allowed unconditionally (gated upstream by API rate-limit + Groq moderation).
- `Anyone can update felt_count` — `UPDATE` allowed (gated upstream by API rate-limit).

There are no `DELETE` or `SELECT key_hash` policies. RLS does not strip `key_hash` from `SELECT *` — the API uses an explicit `PUBLIC_COLUMNS` allow-list to keep `key_hash` and `felt_count` out of public responses.

### Indexes
`expires_at`, `mood`, `key_hash`, `created_at DESC`.

### Auto-expiry (manual to enable)
`pg_cron` is referenced in `schema .sql` as a commented-out setup:

```sql
SELECT cron.schedule(
  'delete-expired-thoughts',
  '0 3 * * *',
  $$ DELETE FROM thoughts WHERE expires_at < NOW() $$
);
```

Operator must enable `pg_cron` in the Supabase dashboard (Database → Extensions) and run the schedule statement. Without it, expired rows linger but are never returned (every query filters `expires_at > NOW()`).

### Realtime
Supabase Realtime needs the `thoughts` table added to the `supabase_realtime` publication. Without that, the client subscription in `app/page.tsx` connects but never fires `INSERT` events. The 60-second polling in the same file will catch up regardless.

### Important schema/code mismatch (must fix before shipping long thoughts)
The `content` `CHECK` allows **≤ 280 chars**, but the API + compose modal now accept up to **2000 chars** (see §6 and §10). Inserts of 281+ chars currently fail with a `check_violation`. The fix is one statement in Supabase SQL Editor:

```sql
ALTER TABLE thoughts DROP CONSTRAINT thoughts_content_check;
ALTER TABLE thoughts ADD CONSTRAINT thoughts_content_check
  CHECK (char_length(content) >= 3 AND char_length(content) <= 2000);
```

Update `schema .sql` to match.

---

## 6. API Routes

All routes live under `/app/api/*`. Vercel `maxDuration` is **10 s** (set in `vercel.json`) — Groq calls usually return in 0.5–2 s.

### `GET /api/thoughts`
Returns up to 150 active thoughts, newest first.

- Query: `select PUBLIC_COLUMNS where expires_at > NOW() order created_at desc limit 150`.
- `PUBLIC_COLUMNS = "id, content, mood, mood_color, is_crisis, created_at, expires_at, position_x, position_y, rotation, opacity_level"`.
- **Never includes `key_hash` or `felt_count`.**
- 500 on supabase failure, with `{ error: "could not load the wall" }`.

### `POST /api/thoughts`
Creates a new thought.

- Body: `{ content: string }`.
- Rejects: non-string content, length `< 3` or `> 2000` → 400.
- IP rate limit: `thoughtRatelimit` — 5 per hour, sliding window, prefix `echoes:thoughts`. On 429: `{ error: "the wall is resting. try again soon." }`.
- IP source: first hop of `x-forwarded-for`, then `x-real-ip`, then `127.0.0.1`.
- Pipeline:
  1. `moderateContent(content)` (Groq) → `allow | block | crisis`. `block` → 400 generic. `crisis` → set `is_crisis: true` and continue. Network failure → fall open to `allow`.
  2. `detectMood(content)` (Groq) → `{ mood, color }` (lowercase mood, hex `mood_color`). Fallback: `{ mood: "untagged", color: "#888888" }`.
  3. Read existing positions (`position_x, position_y` of all active thoughts) to feed the placement algorithm.
  4. `assignPositions(existingPositions)` → grid-cell-furthest-from-neighbors with jitter. See §11.
  5. `generateKey()` → `ECHO-XXXX-XXXX` from a 32-char ambiguous-free alphabet. `hashKey(key)` → SHA-256 hex.
  6. Insert row (no `key_hash` or `felt_count` in the response).
- Response on success:
  ```json
  { "success": true, "key": "ECHO-...", "mood": "...",
    "mood_color": "#...", "is_crisis": false, "thought": {...} }
  ```
- The `key` is returned **only** here; it is never stored in plaintext anywhere.

### `POST /api/felt`
Increments `felt_count` for one thought.

- Body: `{ thought_id: string }` — must match UUID v1–5 regex.
- IP rate limit: `feltRatelimit` — 30 per minute, prefix `echoes:felt`. On 429: `{ error: "rate_limited" }` (silent on the client — no toast).
- Reads current `felt_count`, increments, writes back. There's a small race here (two simultaneous taps could both read the same value); acceptable because counts are private and never shown.
- 404 if thought is missing or expired.

### `POST /api/key`
Looks up a key holder's thoughts.

- Body: `{ key: string }`.
- Normalizes (`trim().toUpperCase()`) and validates against `/^ECHO-[A-Z0-9]{4}-[A-Z0-9]{4}$/`. Anything else → returns `[]` silently.
- Hashes the key, queries `id, felt_count where key_hash = ? and expires_at > NOW()`.
- Returns an array of `{ id, felt_count }`. Note: `felt_count` is included **only** in this response, never on `GET /api/thoughts`. This is the only way a key-holder sees their private counts.
- Errors silently → `[]` (no enumeration leak).

### `GET /api/health`
For uptime monitors. Lightweight `head:true` count query against `thoughts`. Returns `{ status: "ok", timestamp, db: "connected" }` on success or `{ status: "degraded", timestamp, db: "error" }` with HTTP 503.

### Security headers (all routes)
Set in `next.config.mjs` via `async headers()` matching `/:path*`:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

---

## 7. Design System

### Colors
| Token | Value | Used for |
|---|---|---|
| Page background | `#0d0b09` | `body`, sticky-bar at-top, modal overlays |
| Wordmark | `#e6dfd2` | top-bar `<h1>` |
| Body thought text | `#ece5d6` | both wall preview and expanded view |
| Tagline / mid-grey copy | `#5a544a`, `#5a554c`, `#666` | sub-wordmark line, modal sub-copy |
| Faint copy / footer | `#1e1e1c`, `#2a2826` | footer lines, empty-state body |
| Accent ember | `#c47a3a` | FAB, caret-color, felt hover, crisis tone |
| Accent gold (own) | `#c4bdb0` (`ACCENT_BRIGHT`) | unlocked / own-card star, release button |
| Toast success | `#7aad8c` | "your thought is out there", "felt ✦" |
| Toast error | `#c4687a` | "key not found", "could not reach the wall" |
| Toast info | `#888888` | rate-limit notice |
| Card surface (non-own) | `linear-gradient(moodColor@0.04, moodColor@0.04), rgba(255,255,255,0.06)` | adds a faint mood wash |
| Card surface (own) | `linear-gradient(moodColor@0.04, moodColor@0.04), rgba(168,156,138,0.10)` | gold-tinted own cards |

### Mood color map (`lib/utils.ts`)
Fallback when Groq doesn't supply one or returns an unknown mood:

| Mood | Color |
|---|---|
| heartbreak | `#c4687a` |
| loneliness | `#6b8cad` |
| anger | `#c47a3a` |
| anxiety | `#9b7fc4` |
| joy | `#7aad8c` |
| life | `#a89b7a` |
| random | `#888888` |

For unmapped moods, a deterministic hash picks from a 12-color muted palette (rose, blue, ember, violet, sage, ochre, gray, cool-blue, dusty-pink, olive, mustard, slate-blue).

### Typography rules
- Thought text on the wall: Playfair italic, 12–16 px depending on length (see `getThoughtTypography`), color `#ece5d6`, `text-shadow: 0 1px 3px rgba(0,0,0,0.65)`.
- Mood tag (whisper): Syne 300, **8 px**, uppercase, letter-spacing **0.22em**, mood color at **0.45 alpha**.
- Filter pills: Syne 300, 10 px, uppercase, letter-spacing 0.06em.
- Toasts: Syne 300, 11 px, letter-spacing 0.04em, bottom-center.
- Footer: Syne 300, 9 px, letter-spacing 0.08em, color `#1e1e1c` (and `#2a2826` for the night-mode line).
- Search input + filter input: Syne 300, 11 px, color `#c8c4bc`, caret `#c47a3a`.
- Compose textarea: Playfair italic, 15 px, color `#c2bdb4`, line-height 1.7.

### Spacing & layout
- Background never pure black — `#0d0b09` warm near-black.
- A subtle SVG noise grain overlays everything at 0.06 opacity, mix-blend `overlay` (`body::before`).
- Two stacked radial gradients (`body::after`) form the warm centered glow + hard outer vignette.
- Top bar: `padding: 12px 40px 8px`, header `maxHeight: 60`, wordmark 24 px Playfair italic.
- Wall main: `padding: 40px 40px 80px`. The 40 px top is the deliberate 24 px+ breathing room beneath the FilterBar.
- Wall is `position: relative; min-height: 75vh` (60vh on mobile).
- Cards are absolutely positioned by `left: ${position_x}%, top: ${position_y}%` on desktop. On mobile they reflow into a 2-col `column-count` masonry (`position: static !important`, no rotation, no depth blur).
- The big background `echoes` watermark (Playfair italic, `min(38vw, 520px)`, `#1a1612 @ 0.55 opacity`) sits behind everything at z-index 0.

### Card visual rules (`ThoughtCard`)
- Width 160 / 180 / 220 px from `getCardWidth(preview)` (preview length, not full content).
- Inner padding via `getThoughtTypography` — depends on preview length: `24px 18px 22px` for very short (and centers vertically), otherwise `20px 18px 16px`.
- `border-left: 3px solid moodColor @ alpha(0.55 normal, 0.9 own)`. Own cards animate this border between 0.7 and 1.0 in a 3 s loop.
- Inset edge `box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.1)`.
- Ambient outer glow if `opacity_level > 0.8`: `0 0 40px moodColor@0.06`.
- Hover (inner): `scale(1.03)`, brighter inset, `0 8px 32px rgba(0,0,0,0.4)`, brighter border-left.

### Depth tiers (`opacity_level`)
Each card gets one of three tiers, applied via `data-depth` attribute and inline `scale`:

| Tier | `opacity_level` range | scale | filter |
|---|---|---|---|
| far | `< 0.75` | 0.88 | `blur(0.4px)` |
| mid | `0.75 – 0.88` | 0.94 | none |
| near | `≥ 0.88` | 1.00 | none |

The `filter: blur` is in `globals.css` keyed by `[data-depth="far"]`. Mobile resets `filter: none !important`.

The displayed opacity floor is also lifted on matched cards: `Math.max(0.82, opacity_level)`. Far cards are still smaller and slightly blurred — they're just readable. Filtered-out (non-matching mood) cards drop to `0.15` opacity and `scale(0.97)`.

### Rotation
Generated as `(Math.random() - 0.5) * 6` → range **–3° to +3°**. Render-side clamp in `ThoughtCard` (`clampRotation`) covers any older DB rows that still hold larger values.

### Position bounds
`assignPositions` produces `position_x ∈ [4, 76]` and `position_y ∈ [6, 92]`. `Wall.tsx` defensively clamps `position_x` into `[2, 78]` for any older rows.

---

## 8. Components — full per-component spec

### `Wall.tsx`
Container for all cards. Wrapped in `<motion.div>` driving the cinematic entrance:

```ts
hidden: { opacity: 0 }
visible: {
  opacity: 1,
  transition: {
    opacity: { duration: 0.8, ease: "easeOut" },
    delayChildren: 0.4,
    staggerChildren: 0.12,
  }
}
```

Renders `FractureLines`, `EmberParticles`, then maps `thoughts` to `ThoughtCard` inside an `AnimatePresence mode="popLayout"`. Receives `newIds: Set<string>` and forwards `isNew` per card.

### `ThoughtCard.tsx`
Three sub-elements:

1. **Outer wrapper** (`.wall-card`) — absolute-positioned via `left%/top%`, holds `data-depth`, inline `scale: depthScale`, consumes parent variants (`hidden`/`visible`). The visible variant is a **function** that takes `custom = targetOpacity` and returns the resolved animate object. `custom` updates → motion re-runs visible target → opacity tweens. Spring transition for `isNew`, regular ease for normal entrance.

   - Initial y: `isNew ? 360 : 20` — new arrivals slide from far below.
   - Spring: `{ type: "spring", stiffness: 80, damping: 14, mass: 0.9 }` — a soft bounce, ~1.2 s settle.

2. **Inner card** (`.thought-card-inner`) — has `layoutId={`thought-${id}`}` *only* when not expanded. Click → `setExpanded(true)`. Hover scales 1.03. Resting border-left is animated by a `useAnimationControls` instance (`controls`). Own cards run a 3 s sinusoidal pulse on the border-left color.

3. **Felt button** — 28×28 circle at `right: 10, bottom: 8`, resting bg `rgba(255,255,255,0.025)`. Color `#4a4540` resting → ember `#c47a3a` on hover (CSS `transition: color 200ms ease`, scoped via `.felt-btn` class only when *not* felt). On tap:
   - sessionStorage `echoes:felt:<id>` flag is set so this browser session can't re-fire.
   - Scale animates `[1, 1.6, 0.9, 1.1, 1]` over 0.5 s.
   - A ripple (24×24 white circle) expands and fades over 0.4 s.
   - The whole card's `controls` runs `borderLeftColor [resting → flash → resting]` and `boxShadow [base → warmGlow → base]` over 0.9 s. `warmGlow = 0 0 56px 8px moodColor@0.32, 0 0 24px moodColor@0.32` — a brief radiating warmth tinted to that thought's mood.
   - Successful API response triggers a `felt ✦` success toast (silent on 429).

4. **Expand-in-place** — when `expanded`, the inner card unmounts and an `AnimatePresence`-wrapped overlay mounts. Inside the overlay, a `motion.div` with the *same* `layoutId` mounts at center, max-width **340 px**, max-height **78 vh**, `overflow-y: auto`, rotated to 0. Framer-motion morphs position/size between the two. The overlay is `rgba(13,11,9,0.92)` + `backdrop-filter: blur(8px)` and dismisses on outside click. A `×` button (Syne 300, 18 px, color `#444`) sits at `top: 8, right: 12`. The expanded body shows the **full** `thought.content` (no clamping, no preview) at Playfair italic 17 px.

### `ComposeModal.tsx`
Two states: write screen and key-reveal screen.

**Write screen**:
- Heading: Playfair italic 20 px `"what's on your mind"`.
- Sub-copy: Syne 300 11 px `"it disappears in 30 days. no one will ever know it was you."`.
- Textarea: Playfair italic 15 px, `min-height: 140`, `max-height: 40vh`, `overflow-y: auto`. Border-bottom transparent normally; turns to `0.5px solid rgba(196,104,122,0.4)` when `remaining ≤ 10`.
- Counter: shows the number `remaining = 2000 - used`. Color band: calm `#2e2e2e` ≤ 1700, warm `#6b6052` ≤ 1900, ember `#c4bdb0` > 1900. The counter scale-pulses when its band changes.
- Cancel + Release buttons. Release is disabled below 3 chars or while submitting; while submitting it animates a soft ember pulse on its bg/border.
- On `429` from the API, calls the optional `onRateLimited(message)` prop so the parent can fire an info toast. The error is also shown inline.

**Key-reveal screen**:
- Heading: `"released."` Playfair italic 22 px.
- Body: short reassurance line.
- The key (`ECHO-XXXX-XXXX`) is rendered char-by-char with a 40 ms stagger, fade + blur-in. After all chars are visible, a soft glow pulses around the key's box.
- Two micro-copy lines: "this key only exists once. it was never stored." / "save this somewhere. enter it on the wall to see your thought highlighted."
- "go to wall →" button closes the modal.

### `AboutModal.tsx`
Triggered by the `?` button in the top bar. Heading `"what is this"` (Playfair italic 18 px). Body in Syne 300 12 px line-height 1.8: the four-line manifesto. Below: small Syne 300 10 px byline `"built by one person, for anyone who needed it."`. Top-right `×` (Syne 300, 16 px, `#555`). Closes on overlay click or Escape.

### `FilterBar.tsx`
Horizontal pill bar. Pill order: **search-pill** → **`✦ all`** → unique moods.

- The leftmost element is a **pill-shaped search button** (`🔍 search moods`) styled identically to the other pills. Clicking it swaps the pill (via `AnimatePresence`) for an inline rounded input box: `🔍` prefix + native input + inline `×` close button.
- Input: transparent, no outer border (the rounded *box* has the border), Syne 300 11 px, color `#c8c4bc`, caret `#c47a3a`, no border-radius on the input itself.
- Width: 160 + 40 (icon + close) on desktop, `viewportW - 110` on mobile.
- Filtering: case-insensitive `mood.toLowerCase().includes(query)`. The "✦ all" pill is rendered *outside* the AnimatePresence so it never animates out.
- Pills use `layout` + enter (`opacity:0 scale:0.85`) + exit (`opacity:0 scale:0.85 marginLeft/Right:-4`) so the bar collapses smoothly when filtered.
- Active pill: pulse box-shadow over 2 s, mood-tinted bg + brighter border, label rendered as `[ moodname ]`.
- Empty result on desktop: `"no moods yet"` (Syne 300, 10 px, `#2a2a2a`).
- Mobile: when search opens, all pills hide; the input box stretches across the row.
- Escape or the inline `×` closes search and clears the query.

### `FractureLines.tsx`
A memoized `<svg viewBox="0 0 100 100" preserveAspectRatio="none">` of 18 hand-tuned hairline cracks (`stroke="rgba(180,172,160,0.09 - 0.16)"`, `vector-effect: non-scaling-stroke`). Sits behind cards (`z-index: 1`) inside the wall. Hidden on mobile.

### `EmberParticles.tsx`
10 particles on desktop, 5 on mobile. Each is a 1.5×1.5 px `#b4ada0` dot starting in the lower 60–95% of the wall, animating `y: [0, -180]`, drifting horizontally on a sinusoidal pattern (`drift: [0, ±a, ∓0.7a, ±0.9a, ∓0.4a, 0]`), looping over 8–14 s with a random 0–8 s start delay. Listens to `matchMedia("(max-width: 767px)")` to rebuild for the right device count.

### `app/page.tsx` — root client component
Owns and orchestrates everything. State:
- `thoughts: Thought[]` — wall data.
- `ownThoughtIds: string[]` — populated by `/api/key` on unlock.
- `activeFilter: string` — current mood filter (`"all"` or a mood string).
- `composeOpen / aboutOpen / showOnboarding` — modal toggles.
- `keyInput` — controlled input.
- `toast: { id, message, type } | null` — bottom-center toast.
- `loading` — initial fetch flag (drives the skeleton wall).
- `animateWordmark` — wordmark char-stagger plays once per session via `sessionStorage["echoes:title-animated"]`.
- `isScrolled` — toggles backdrop-blur on the sticky-bar after 4 px scroll.
- `newIds: Set<string>` — ids of cards that should slide in from below.
- `thoughtCount` — from supabase `count: exact, head: true`. Fetched on mount + every 60 s.
- `nightLabel` — `"wall active · h:mma"` if local hour is `< 5` or `≥ 22`, else `null`. Recomputed every 60 s.
- `composeOpenRef` — read by the realtime subscription so the user is never interrupted while composing.

Effects:
- Initial fetch + 60 s polling of `/api/thoughts`.
- Realtime channel `echoes-thoughts-arrivals` subscribed to `INSERT` on `public.thoughts`. On insert: skip if compose modal is open; otherwise build a sanitized `Thought` (the realtime payload would otherwise carry `key_hash`), prepend to state, mark in `newIds` for 1.8 s.
- Onboarding overlay: shown if `localStorage["echoes:onboarded:v1"] !== "1"`. Auto-dismisses after 4.2 s. Click anywhere also dismisses. The flag is set when `showOnboarding` flips to false, regardless of cause.
- `document.title` toggles between `"echoes — throw it into the dark"` and `"echoes — say something"` based on `composeOpen`.
- Escape clears the unlock state when unlocked.

The floating release button (FAB) is rendered at the very end, outside `<main>`. 52 px ember circle pinned to `right: 24, bottom: 24, z-index: 35`. Soft pulse on `box-shadow` over 3.6 s. Hides whenever any modal/onboarding overlay is open.

---

## 9. Behaviors

### Posting a thought
1. User clicks `[ + release ]` (top bar) or the FAB.
2. `ComposeModal` opens; `document.title` changes; FAB is hidden.
3. User types up to 2000 chars. The textarea expands to `40vh` then scrolls. The remaining counter changes color band as it approaches the limit.
4. Submit → `POST /api/thoughts`. While in-flight, the submit button does an ember pulse animation.
5. On 429, parent shows `"the wall is resting. try again soon."` info toast; modal stays open with the error inline.
6. On success, the modal swaps to the key-reveal screen. The card is added to local state (so it appears on the wall behind the modal). `ownThoughtIds` is updated so the new card is visually marked as own. Parent fires `your thought is out there` success toast. `keyInput` is auto-populated with the new key so closing the modal lands the user already "unlocked" against their new thought.
7. The user copies the key. The modal is dismissed manually via "go to wall →".

### Felting
1. User clicks the `○`.
2. Local state flips immediately: ember warmth on the whole card, ripple from the button, ember scale bounce. SessionStorage is set so refreshing this tab doesn't let them double-tap.
3. `POST /api/felt` is fired. On 200, a tiny `felt ✦` toast confirms. On 429, nothing visible — the card already showed warmth, the count just doesn't increment.
4. `felt_count` is never displayed publicly. Only the key-holder sees it via `/api/key`.

### Key unlock
1. User pastes `ECHO-XXXX-XXXX` into the top-bar input and clicks `[ unlock ]` (or hits Enter).
2. `POST /api/key` returns `[{ id, felt_count }, ...]` for thoughts the key opens.
3. Empty array → `"key not found"` error toast.
4. Non-empty → `ownThoughtIds` is populated, success toast `"✦ your thoughts are glowing"`, an `✕` button appears next to the unlock input. Pressing it (or Escape) clears.
5. **Current behavior:** the wall stays full when unlocked — the user's own thoughts are *highlighted in place* (gold bg tint, animated border-left, top-right `✦`, gold-tinted felt-button background) while everyone else's thoughts remain visible at their normal styling. The `✕` button next to the unlock input clears the unlock state (drops the highlight; the wall is unchanged otherwise).

### Card expand
- Click any card. Inner card unmounts at its position; identical `motion.div` mounts at center inside an overlay. `layoutId` shares identity → framer-motion morphs the layout box.
- The expanded view has the same mood-color border-left, same Playfair italic, no rotation, max-width 340 px, max-height 78vh with internal scroll. Full content is shown without truncation. A `×` close button at top-right.
- Clicking the dim overlay or the `×` reverses the morph back to the wall position.

### Long thoughts (preview hook)
`getThoughtPreview(content)` — if content ≤ 110 chars, returns it as-is. Otherwise looks for a sentence terminator (`.`, `!`, `?`, `\n`) at index ≥ 30 within the first 140 chars and cuts there; if none found, cuts at the last word boundary before 110 chars and appends `…`. The card width and typography are sized off the **preview**, so a 1500-char story still presents as a clean 160–220 px card. The full text is revealed in the expanded view.

### Realtime arrivals
- Card fades + slides up from y: 360 px with a soft spring, matched-opacity floor of 0.82.
- Skipped if the user has the compose modal open (so a stranger's post doesn't disrupt their writing).
- The polling fetcher runs in parallel and will pick up arrivals if the realtime subscription is misconfigured server-side.

### Onboarding
- First-ever visit per browser shows a full-bleed `#0d0b09` overlay with the line *"this is a place for thoughts that have nowhere else to go."* (Playfair italic 18 px `#d4cfc7`, max-width 360 px, line-height 1.55, 0.2 s delay before the line fades in over 1.4 s).
- Auto-dismisses after 4.2 s; clicking dismisses immediately.
- `localStorage["echoes:onboarded:v1"] = "1"` blocks future shows.

### Late-night indicator
- When local hour is `≥ 22` or `< 5`, a third footer line `"wall active · h:mma"` appears in `#2a2826` (slightly dimmer than the other two lines). Updates every minute.

### Wordmark animation
- On the first visit per session (sessionStorage flag), each character of `echoes.` fades + drops in with a 0.06 s stagger, 0.34 s duration, ease-out cubic.

---

## 10. Mood System

Moods are **freeform strings produced by Groq** (`llama-3.1-8b-instant`), not from a fixed enum. The system prompt (in `lib/groq.ts`) instructs the model to:
- Return JSON only with `mood` (single lowercase word or 2–3 word phrase, specific to the emotional tone) and `color` (muted desaturated hex, saturation < 55%, no neon).
- Avoid generic words like "sad" or "happy". Be evocative — examples in the prompt: `heartbreak`, `late night thoughts`, `missing someone`, `existential dread`, `tired of it all`, `numb`, `longing`, `silent anger`.

If the JSON is malformed or empty, the API falls back to `{ mood: "untagged", color: "#888888" }` and logs.

Color resolution at render time uses `getMoodColor(mood)`:
1. If the mood matches the documented map (heartbreak / loneliness / anger / anxiety / joy / life / random), use that hex.
2. Otherwise hash the mood string and pick from the 12-color fallback palette.

The DB stores whatever color Groq returned (or the fallback). `getMoodColor` only matters when something downstream needs a color from a mood string alone.

---

## 11. Placement Algorithm (`assignPositions`)

```ts
const X_MIN = 4,  X_MAX = 76;     // matches Wall.tsx clamp [2, 78] with breathing room
const Y_MIN = 6,  Y_MAX = 92;
const COLS = 5,   ROWS = 5;        // 25 cells
```

For every cell center `(cx, cy)`, compute the *minimum* Euclidean distance to any existing thought. Pick the cell with the **largest** such minimum (random tie-break across ties). Add `±30%` jitter inside the cell. Clamp to `[X_MIN, X_MAX] × [Y_MIN, Y_MAX]`.

Rotation: `(Math.random() - 0.5) * 6 → [-3, 3]`. Opacity: `0.6 + Math.random() * 0.4 → [0.6, 1.0]`.

The API fetches all active `position_x, position_y` rows before calling this — so new posts genuinely slot into gaps rather than landing on top of existing cards. (Pre-fix, the API was passing `[]` and posts landed at random.)

---

## 12. Key System

- `KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"` — uppercase letters and digits, with `0`, `O`, `I`, `1` removed for legibility.
- `generateKey()` → `ECHO-XXXX-XXXX`, ~32^8 ≈ 1.1 × 10¹² combinations. Uses `crypto.getRandomValues` when available, falls back to `Math.random` (server runtime always has crypto).
- `hashKey(key)` → SHA-256 hex via `crypto.subtle.digest`. The DB stores **only the hash**.
- The plaintext key exists exactly once: in the response body of the successful POST. It is never logged, never stored, never inferable from anything in the DB.
- Anyone with the key can call `/api/key` and learn the IDs and `felt_count` of the thoughts they posted with that key. Without the key there is no way to associate a thought with a poster.

---

## 13. Rate Limiting

`lib/ratelimit.ts` — Upstash sliding window, IP-keyed, per route.

| Limiter | Limit | Prefix | Where applied |
|---|---|---|---|
| `thoughtRatelimit` | 5 / hour | `echoes:thoughts` | `POST /api/thoughts` |
| `feltRatelimit` | 30 / minute | `echoes:felt` | `POST /api/felt` |

If Upstash is unreachable, both routes **fail open** — the limit is skipped with a `console.error`. No rate limit on `GET /api/thoughts`, `POST /api/key`, or `GET /api/health`.

The 5 / hour for thoughts means seeded demo content **cannot** be inserted via the public API in a reasonable timeframe. The seed step earlier in development used the Supabase REST endpoint directly with the anon key, bypassing the rate limit by design (it's a route-level limit, not a DB-level one).

---

## 14. Animations Catalogue

| Trigger | Component | What animates | Spec |
|---|---|---|---|
| Page load | Wall container | opacity 0→1 | 0.8 s ease-out |
| Page load | Each card (initial entrance) | opacity 0→target, y 20→0 | staggerChildren 0.12 s, delayChildren 0.4 s, 0.6 s ease-out per card |
| Realtime new card | One card | y 360→0, opacity 0→target | spring (s 80, d 14, m 0.9) |
| Hover card | inner | scale 1→1.03, brighter shadow + border | 0.2 s ease-out |
| Filter dim | card | opacity → 0.15, scale → 0.97 | 0.25 s ease-out |
| Filter remove | card | exit (AnimatePresence) | 0.22 s ease-in |
| Click card | inner ↔ expanded | layoutId morph (position + size) | framer default |
| Tap felt | felt button | scale `[1, 1.6, 0.9, 1.1, 1]` | 0.5 s |
| Tap felt | inner ripple | scale 0→1, opacity 0.4→0 | 0.4 s ease-out |
| Tap felt | inner card | borderLeftColor + boxShadow flash through warmGlow | 0.9 s with `times: [0, 0.35, 1]` |
| Resting (own card) | inner | borderLeftColor sinusoid | 3 s loop |
| Wordmark first load | each char | opacity 0→1, y -4→0 | 0.06 s stagger, 0.34 s duration |
| Toast | toast div | opacity 0→1, y 8→0 then reverse | 0.3 s ease-out, 3 s lifetime |
| Onboarding | overlay | opacity 0→1 | 0.9 s ease-out |
| Onboarding | sentence | opacity 0→1, y 6→0 | 1.4 s ease-out, 0.2 s delay |
| FAB | button | box-shadow ember pulse | 3.6 s loop |
| FAB hover/tap | button | scale 1.05 / 0.96 | framer default |
| Search pill ↔ input | FilterBar | swap via AnimatePresence | 0.18–0.20 s |
| Pill enter / exit | FilterBar | opacity + scale 0.85 + neg margin | 0.22–0.25 s |
| Active pill | filter pill | box-shadow pulse | 2 s loop |
| Compose textarea warning | textarea | border-color | 0.2 s ease |
| Compose submit | release button | bg + border ember pulse | 1.5 s loop while submitting |
| Key reveal | each char | opacity 0→1, y 6→0, blur 2→0 | 0.04 s stagger, 0.32 s duration |
| Key reveal box | container | box-shadow glow flash | 2 s, delayed until char stagger ends |
| Ember particles | each particle | y 0→-180, x drift sinusoid, opacity decay | 8–14 s loop |
| Skeleton (loading) | shimmer layer | bg-position scroll | 1.8 s loop |

---

## 15. Mobile Responsiveness

`app/globals.css` defines two breakpoints:

`@media (max-width: 767px)`:
- Sticky-bar becomes static (it would otherwise eat too much vertical real estate).
- Wall switches to `column-count: 2; column-gap: 10px`. Cards become `position: static !important; transform: none !important; display: inline-block; width: 100%`.
- Thought-card-inner `transform: none !important` (kills rotation on mobile — they look chaotic in masonry).
- `.fracture-lines` hidden.
- Filter pills bumped to `padding: 9px 18px; font-size: 11px` for easier tapping.
- Sticky-bar inner padding `20px 16px 12px`.
- Depth-tier `filter: none !important` (no blur on mobile).

`@media (max-width: 639px)`:
- Top bar stacks vertically (`flex-direction: column; align-items: stretch`).
- Top-bar actions wrap full-width with the unlock form taking flex.

---

## 16. Known Deviations & Bugs

These are intentional or pending — record before you touch them.

1. ~~**Schema char_length still 280.**~~ `schema .sql` is now in sync at 2000. The migration below still has to run **once** against the live Supabase project (DDL can't be issued via the anon REST endpoint — paste this in Supabase → SQL Editor → New Query):
   ```sql
   ALTER TABLE thoughts DROP CONSTRAINT thoughts_content_check;
   ALTER TABLE thoughts ADD CONSTRAINT thoughts_content_check
     CHECK (char_length(content) >= 3 AND char_length(content) <= 2000);
   ```
   The exact constraint name might differ if Supabase autogenerated it. To find it: `SELECT conname FROM pg_constraint WHERE conrelid = 'thoughts'::regclass AND contype = 'c';` and substitute the name into the `DROP` line.

2. ~~**Unlock filters instead of highlights.**~~ Fixed. `visibleThoughts = thoughts` unconditionally; the wall stays full when a key is entered, and own cards are highlighted in place via the existing `isOwn` styling (gold-tinted bg, animated border-left, top-right `✦`, gold-tinted felt-button background). The `✕` button next to the unlock input now means "forget this key" rather than "show all".

3. ~~**`schema .sql` filename has a literal space.**~~ Renamed to `schema.sql`.

4. **`pg_cron` schedule for auto-expiry is not active.** `expires_at` filter on every read keeps things correct visually, but old rows accumulate forever. Enable the extension and run the `cron.schedule` statement.

5. **Realtime publication may not include `thoughts`.** If new thoughts don't appear on other open tabs within ~1 s, go to Supabase → Database → Replication → make sure `thoughts` is in the `supabase_realtime` publication. Polling will mask the issue at 60 s granularity.

6. ~~**`getArchiveNumber` in `lib/utils.ts` is exported but unused.**~~ Removed.

7. **Felt count race.** `read → +1 → write` is not atomic. Two simultaneous taps from different IPs could both write `n+1`. Acceptable because the count is private and the UX never lies (each user sees their tap acknowledged).

8. **No `DELETE` policy on `thoughts`.** A user who posted with a key currently has no way to delete their thought. If you add a delete-by-key endpoint, you'll need an RLS policy that uses an RPC with the hashed key as a `WHERE` filter.

---

## 17. Feature Status

### Shipped
- **Share thought as image.** A "share ↗" button at the bottom-right of the expanded card view. On click, `lib/share.ts` builds an off-screen `<div>` styled at **1080×1920** (Instagram story aspect), renders it to a PNG blob via `html-to-image`'s `toBlob`, and either:
  - hands the file to `navigator.share({ files })` if the browser supports it (mobile Safari, Chrome Android), or
  - falls back to a hidden `<a download>` click that saves `echo-<id8>.png` to the user's machine.
  - Filename: `echo-<first 8 chars of UUID>.png`.
  - Layout: dark warm gradient (matches the wall), thin mood-color hairline at top of the central block, thought text in Playfair italic centered with auto-sizing (64 / 52 / 38 / 30 / 24 px depending on length), mood label in Syne 300 small caps under the text, tiny `echoes.` watermark in Playfair italic at the bottom. No identifying info beyond what's in the public `Thought`.
  - Button states: idle "share ↗" → "rendering…" while busy → "shared ✦" / "saved" / "couldn't share" for ~2.4 s after, then back to idle.
  - Hover color: ember `#c47a3a` (CSS rule `.share-btn:not(:disabled):hover`).

### Deferred — still need product/asset decisions

1. **Ambient sound toggle.** Needs an audio file (rain / hum / static, looped, ≤ 200 KB). Off by default, persisted per user, small speaker glyph somewhere subtle. Wiring is straightforward once an asset is chosen.
2. **Self-delete by key.** A `DELETE /api/thoughts` taking `{ key, thought_id }` that hashes the key and deletes the row only if the hashes match. Needs an RLS RPC or a SECURITY DEFINER function (or a service-role server route).

---

## 18. Deployment

- **Hosting:** Vercel free tier.
- **Repo:** GitHub, auto-deploys on push to `main`.
- **Env vars:** all five from §4 must be set in the Vercel project settings.
- **Function timeout:** 10 s per `app/api/**/*.ts` (set in `vercel.json`).
- **Health check:** `/api/health` returns `200 + { status: "ok" }` once the app + DB are reachable; uptime monitors should hit this.
- **Domain:** dark theme; the app sets `viewport.themeColor = "#0d0b09"` in `app/layout.tsx` so iOS Safari/Android Chrome address bars match.
- **Local dev:** `npm run dev`. On this Windows machine, Node 24 is at `C:\Program Files\nodejs\node.exe` and PowerShell blocks `.ps1` shims — call `npm.cmd` / `npx.cmd` directly.

---

## 19. Quick Reference — "How do I…"

| Want to… | Where |
|---|---|
| Change the wordmark / tagline | `app/page.tsx` near the `<h1>` |
| Add a new mood color fallback | `MOOD_MAP` in `lib/utils.ts` |
| Adjust felt rate limit | `lib/ratelimit.ts` |
| Adjust thought rate limit | `lib/ratelimit.ts` |
| Change content max length | `app/api/thoughts/route.ts` (validation) + `components/ComposeModal.tsx` (`MAX_LEN`) + DB CHECK |
| Re-tune card depth thresholds | `getDepthTier` / `getDepthScale` in `components/ThoughtCard.tsx` |
| Re-tune wall stagger / fade | `wallVariants` in `components/Wall.tsx` |
| Change the placement algorithm | `assignPositions` in `lib/utils.ts` |
| Change preview length / sentence cutoff | `getThoughtPreview` in `lib/utils.ts` |
| Add another security header | `next.config.mjs` `securityHeaders` |
| Move the FAB | the trailing `motion.button` in `app/page.tsx` |
| Tweak share image layout | `buildNode` in `lib/share.ts` |
| Change share image dimensions | `FRAME_WIDTH` / `FRAME_HEIGHT` in `lib/share.ts` |
| Disable the onboarding splash | clear `localStorage["echoes:onboarded:v1"]` from devtools |
| Replay the wordmark animation | clear `sessionStorage["echoes:title-animated"]` |
| Reset a session's felt locks | clear `sessionStorage["echoes:felt:*"]` |

---

## 20. The Two Inviolable Lines

Reproduced verbatim from `CLAUDE.md` because every contributor has to internalize them:

> Never add public metrics, counts, or social signals.
> The wall is the heart — aesthetic quality matters more than features.
