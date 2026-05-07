# Echoes — Claude Code Prompts
# Copy and paste these one by one into Claude Code, in order.
# Always wait for each one to finish before running the next.

========================================================
PROMPT 0 — PROJECT SKELETON (run this first)
========================================================

Read CLAUDE.md fully before doing anything.

Initialize a Next.js 14 project in this folder with TypeScript, Tailwind CSS, App Router, and ESLint.

Then install these packages:
  framer-motion
  @supabase/supabase-js
  groq

Create the complete file structure from CLAUDE.md with empty placeholder files. Do not write any real logic yet — just create the files with correct import statements so nothing is broken.

Also add these two Google Fonts to app/layout.tsx using next/font/google:
- Playfair Display (weights 400, 700, style italic)
- Syne (weights 300, 400, 500)

Set the html background to #0d0b09 in globals.css.


========================================================
PROMPT A — TYPES AND UTILITIES
========================================================

Read CLAUDE.md.

Build lib/types.ts with this Thought interface:
  id: string
  content: string
  mood: string
  mood_color: string
  felt_count: number
  is_crisis: boolean
  created_at: string
  expires_at: string
  position_x: number
  position_y: number
  rotation: number
  opacity_level: number

Build lib/utils.ts with these four functions:

1. generateKey(): string
   Returns a key in format ECHO-XXXX-XXXX
   Characters must be uppercase alphanumeric only
   Exclude these characters to avoid confusion: 0, O, I, 1

2. hashKey(key: string): Promise<string>
   Returns SHA-256 hash of the key using the Web Crypto API (no external library)

3. getMoodColor(mood: string): string
   Checks the mood map from CLAUDE.md first.
   If not found, deterministically hashes the mood string to pick 
   from the 12-color fallback palette in CLAUDE.md.
   Always returns a valid hex color string.

4. assignPositions(existingThoughts: Thought[]): { position_x: number, position_y: number, rotation: number, opacity_level: number }
   Returns random but non-overlapping position values for a new thought card.
   position_x: 5 to 85 (percentage)
   position_y: 5 to 85 (percentage)
   rotation: -4 to 4 degrees
   opacity_level: 0.6 to 1.0


========================================================
PROMPT B — DATABASE AND AI CLIENTS
========================================================

Read CLAUDE.md.

Build lib/supabase.ts:
  Create and export a Supabase client using NEXT_PUBLIC_SUPABASE_URL 
  and NEXT_PUBLIC_SUPABASE_ANON_KEY from environment variables.
  Use createClient from @supabase/supabase-js.

Build lib/groq.ts:
  Create and export a Groq client using GROQ_API_KEY.
  Export a function called detectMood(content: string) that:
  - Calls Groq with model "llama-3.1-8b-instant"
  - Uses this exact system prompt:
    "You are a mood detector for anonymous emotional thoughts posted by young people aged 14-28. Analyze the thought and return ONLY a valid JSON object with exactly two fields: mood (a single lowercase word or short 2-3 word phrase that captures the specific emotional tone — be creative and specific, examples: 'heartbreak', 'late night thoughts', 'missing someone', 'existential dread', 'tired of it all', 'small joy', 'numb', 'longing', 'silent anger' — never use generic words like 'sad' or 'happy') and color (a muted, desaturated hex color that emotionally fits this mood — keep saturation under 55%, avoid bright or neon colors). Return only the JSON, no explanation, no markdown."
  - Parses the response and returns { mood: string, color: string }
  - Falls back to { mood: 'untagged', color: '#888888' } on any error

  Export a function called moderateContent(content: string) that:
  - Calls Groq with model "llama-3.1-8b-instant"
  - Checks if the content is: spam/promo, hate speech/slurs/threats, or crisis/self-harm
  - Returns { action: 'allow' | 'block' | 'crisis', reason?: string }
  - 'block' for spam and hate speech
  - 'crisis' for self-harm signals (thought still posts, but is_crisis = true)
  - 'allow' for everything else including dark emotional venting


========================================================
PROMPT C — API ROUTES
========================================================

Read CLAUDE.md.

Build app/api/thoughts/route.ts:

  GET handler:
  - Fetch thoughts from Supabase where expires_at > NOW()
  - Select all columns EXCEPT key_hash (never expose this)
  - Order by created_at DESC, limit 150
  - Return as JSON array

  POST handler:
  - Receive body: { content: string }
  - Validate content is 3-280 characters
  - Call moderateContent(content) from lib/groq.ts
    - If action is 'block': return 400 with message "this thought couldn't be released"
    - If action is 'crisis': set is_crisis = true
  - Call detectMood(content) to get mood and mood_color
  - Call assignPositions([]) for position values
  - Call generateKey() to create the raw key
  - Call hashKey(key) to get key_hash
  - Insert into Supabase thoughts table with all values
  - Return { success: true, key, mood, mood_color, is_crisis }
  - NEVER return key_hash in the response

Build app/api/felt/route.ts:

  POST handler:
  - Receive body: { thought_id: string }
  - Increment felt_count by 1 in Supabase for that thought_id
  - Return { success: true }

Build app/api/key/route.ts:

  POST handler:
  - Receive body: { key: string }
  - Call hashKey(key) to get key_hash
  - Query Supabase for thoughts where key_hash matches AND expires_at > NOW()
  - Return array of thought IDs and their felt_counts
  - Never return full thought objects here, just { id, felt_count }[]


========================================================
PROMPT D — WALL UI (most important — take your time)
========================================================

Read CLAUDE.md carefully. Every design rule must be followed exactly.

Build these components and the main page:

--- ThoughtCard.tsx ---
Props: thought: Thought, isOwn: boolean, onFelt: (id: string) => void

Visual design (follow CLAUDE.md design rules):
- No hard border — use box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.06)
- Background: rgba(255,255,255,0.03)
- Left border: 2px solid [mood_color] at 40% opacity
- If isOwn: left border at 80% opacity, background rgba(255,255,255,0.05), 
  subtle amber glow: box-shadow includes 0 0 20px rgba(196,122,58,0.08)
- Thought text: Playfair Display italic, 13px, #bdb8af, line-height 1.75, max 3 lines then fade
- Mood tag below text: Syne 300, 9px, uppercase, letter-spacing 0.12em, mood_color at 60% opacity
- If is_crisis: show a small line below mood tag in Syne 300 10px #555:
  "if you're struggling, you're not alone — Kaan Pete Roi: 01779-554391"

Felt button:
- Small, bottom right of card
- Hollow ring ○ when not felt, ember 🔥 when felt
- On click: Framer Motion scale animation 1 → 1.5 → 1 over 300ms
- Color: #3a3a3a default, #c47a3a when felt
- Store felt state in sessionStorage keyed by thought id

Card positioning:
- position: absolute
- left: position_x% 
- top: position_y%
- transform: rotate(rotation + deg)
- opacity: opacity_level

Entrance animation (Framer Motion):
- initial: { opacity: 0, y: 12, scale: 0.96 }
- animate: { opacity: opacity_level, y: 0, scale: 1 }
- transition: { duration: 0.4, delay: index * 0.07 }

On hover:
- scale: 1.03
- z-index: 20
- box-shadow brightens

On click (not on felt button):
- Expand to show full text in a centered modal overlay

--- Wall.tsx ---
Props: thoughts: Thought[], ownThoughtIds: string[]

- position: relative, min-height: 75vh, width: 100%
- Renders all ThoughtCard components absolutely positioned
- On mobile (< 768px): switch to CSS columns masonry layout instead

--- FilterBar.tsx ---
Props: moods: string[], activeFilter: string, onFilter: (mood: string) => void

- Horizontal scrollable row, no scrollbar visible
- First pill always: "✦ all"
- Each pill: Syne 300, 10px, uppercase, letter-spacing 0.06em
  - Inactive: no background, 0.5px border of #2a2a2a, color #444, border-radius 20px
  - Active: background of mood_color at 15%, border 0.5px solid mood_color at 70%, color: mood_color
- Extract unique moods from the thoughts array automatically

--- app/page.tsx ---
- Fetch thoughts from /api/thoughts on mount
- Top bar: 
  Left: wordmark "echoes" in Playfair Display italic 22px #d4cfc7 + tagline "throw it into the dark" Syne 300 9px #333 below it
  Right: key input (Syne, placeholder "your key...") + unlock button + "release a thought" button in ember orange
- FilterBar below top bar
- Wall below FilterBar
- Key input: on submit POST to /api/key, store returned IDs in state as ownThoughtIds
- "Release a thought" button: opens ComposeModal
- After new thought posted: add to thoughts state, show key modal


========================================================
PROMPT E — COMPOSE MODAL
========================================================

Read CLAUDE.md.

Build components/ComposeModal.tsx:
Props: onClose: () => void, onPosted: (thought: Thought, key: string) => void

Overlay:
- Full screen, position fixed, z-index 50
- Background: rgba(13,11,9,0.92)
- backdrop-filter: blur(8px)
- Click outside modal box → close

Modal box:
- Background: #111009
- Border: 0.5px solid rgba(255,255,255,0.08)
- Border-radius: 16px
- Padding: 32px
- Max-width: 420px, centered
- Framer Motion: initial { opacity:0, y:24 } → animate { opacity:1, y:0 }
- Exit: { opacity:0, y:16 }

Content:
- Heading "what's on your mind" — Playfair Display italic, 20px, #d4cfc7
- Subline — Syne 300, 11px, #3a3a3a, line-height 1.6:
  "it disappears in 30 days. no one will ever know it was you."
- Textarea:
  - background: transparent
  - no border normally
  - on focus: border-bottom 0.5px solid #2a2a2a
  - Playfair Display italic, 15px, #c2bdb4
  - placeholder "say it..." in #272420
  - min-height: 120px, no resize handle
  - max 280 characters
- Character counter: Syne 300, 10px, #2e2e2e, right-aligned, counts down
- Loading state: show "releasing..." with a subtle pulse on the button
- Error state: show error message in Syne 300, 11px, #c4687a

After successful post — replace form with key reveal screen:
- "released." heading in Playfair Display italic
- Subtext: "your thought is out there now. it'll fade in 30 days."
- Key display box:
  - Background: rgba(196,122,58,0.06)
  - Border: 0.5px solid rgba(196,122,58,0.3)
  - Border-radius: 8px
  - Padding: 16px 20px
  - Label: "your key" in Syne 300, 9px, #555, uppercase, letter-spacing 0.1em
  - Key value: Syne 500, 18px, #c47a3a, letter-spacing 0.2em
  - Note below: Syne 300, 10px, #3a3a3a: 
    "save this somewhere. enter it on the wall to see your thought highlighted."
- "go to wall →" button to close


========================================================
PROMPT F — FINAL WIRING AND POLISH
========================================================

Read CLAUDE.md.

Wire everything together and polish:

1. app/globals.css — add:
   - Grain texture: a fixed full-screen ::before pseudo-element on body
     using an SVG noise filter with opacity 0.035 and mix-blend-mode: overlay
   - Hide all scrollbars globally (scrollbar-width: none, ::-webkit-scrollbar display none)
   - Smooth scrolling: scroll-behavior smooth
   - Selection color: background #c47a3a33, text #c47a3a

2. app/layout.tsx — set:
   - Title: "echoes"
   - Description: "throw your thoughts into the dark."
   - Theme color: #0d0b09
   - No favicon for now (use default)

3. app/page.tsx — final wiring:
   - Real-time feel: re-fetch thoughts every 60 seconds silently
   - When a new thought is added via ComposeModal, prepend it to the list
   - Smooth transition when filter changes (Framer Motion AnimatePresence)
   - On mobile: the top bar stacks vertically, key input goes below the wordmark
   - Loading state: show 6 skeleton thought cards with a subtle pulse animation
   - Empty state per filter: show centered text in Playfair Display italic 
     "no thoughts here yet. be the first." in #2e2e2e

4. Final check — go through CLAUDE.md and verify:
   - key_hash never appears in any API response
   - felt_count is never shown publicly
   - expired thoughts are always filtered
   - All fonts match the spec
   - Mobile layout works correctly
