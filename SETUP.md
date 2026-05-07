# Echoes — Setup Guide

## Before you touch Claude Code, do these first

---

## 1. Create accounts (all free, ~10 minutes total)

### Supabase (your database)
1. Go to https://supabase.com
2. Sign up → Create new project
3. Choose a name (e.g. "echoes"), set a database password, pick a region closest to you
4. Wait ~2 minutes for it to spin up
5. Go to Settings → API
6. Copy "Project URL" → paste into .env.local as NEXT_PUBLIC_SUPABASE_URL
7. Copy "anon public" key → paste into .env.local as NEXT_PUBLIC_SUPABASE_ANON_KEY

### Run the database schema
1. In Supabase: go to SQL Editor → New Query
2. Open schema.sql from this folder
3. Copy everything and paste it into the SQL editor
4. Click Run
5. You should see "Success" — your thoughts table is ready

### Groq (your free AI for mood tagging)
1. Go to https://console.groq.com
2. Sign up (free)
3. Go to API Keys → Create API Key
4. Copy it → paste into .env.local as GROQ_API_KEY

---

## 2. Install tools

### Node.js
Download from https://nodejs.org — install the LTS version

### VS Code
Download from https://code.visualstudio.com

### Claude Code extension for VS Code
Search "Claude Code" in VS Code Extensions panel and install it

### Claude Code CLI (terminal)
```bash
npm install -g @anthropic/claude-code
```

---

## 3. Start the project with Claude Code

Open VS Code in your project folder.
Open the terminal (Ctrl+` or Cmd+`).

Run this as your very first Claude Code prompt:

```
Read CLAUDE.md fully before doing anything.

Initialize a Next.js 14 project in this folder with:
- TypeScript
- Tailwind CSS  
- App Router
- ESLint

Then install these packages:
npm install framer-motion @supabase/supabase-js groq

Create the full file structure described in CLAUDE.md.
Create empty placeholder files for all components and lib files.
Do not write any UI code yet — just the project skeleton with correct imports.
```

---

## 4. Build order (run these Claude Code prompts in order)

After skeleton is ready:

**Prompt A — Types and utilities**
```
Read CLAUDE.md. Build lib/types.ts and lib/utils.ts.
types.ts: the Thought TypeScript interface with all fields from CLAUDE.md.
utils.ts: 
- generateKey() that creates ECHO-XXXX-XXXX format keys
- hashKey(key: string) that returns SHA-256 hash using Web Crypto API
- getMoodColor(mood: string) that returns hex color from the mood map in CLAUDE.md,
  with a deterministic hash fallback for unknown moods
```

**Prompt B — Database and AI clients**
```
Read CLAUDE.md. Build lib/supabase.ts and lib/groq.ts.
supabase.ts: create and export Supabase client using env variables.
groq.ts: create and export Groq client using GROQ_API_KEY env variable.
```

**Prompt C — API routes**
```
Read CLAUDE.md. Build all three API routes:

1. app/api/thoughts/route.ts
   GET: fetch all active (non-expired) thoughts, exclude key_hash from response,
        order by created_at DESC, limit 100
   POST: receive { content, position_x, position_y, rotation, opacity_level, key_hash }
         → call Groq to detect mood and color
         → insert into Supabase
         → generate and return key (never store raw key, only hash)

2. app/api/felt/route.ts  
   POST: receive { thought_id }, increment felt_count by 1

3. app/api/key/route.ts
   POST: receive { key }, hash it, return thought IDs where key_hash matches
```

**Prompt D — Wall UI**
```
Read CLAUDE.md carefully — especially the Design rules section.
Build the main wall experience: Wall.tsx, ThoughtCard.tsx, FilterBar.tsx, app/page.tsx.

This is the most important prompt. Aesthetic quality is the priority.
Follow every design rule in CLAUDE.md exactly.
Use Framer Motion for card entrance animations (staggered, 80ms apart).
The wall is absolutely positioned cards on desktop, masonry on mobile.
```

**Prompt E — Compose modal**
```
Read CLAUDE.md. Build ComposeModal.tsx.
Full screen overlay with blur background.
Playfair Display italic textarea, no border except subtle bottom line on focus.
After posting: show the generated key styled like a typewriter code.
Animate in/out with Framer Motion.
```

**Prompt F — Polish and connect everything**
```
Read CLAUDE.md. Wire everything together in app/page.tsx.
Fetch real thoughts from /api/thoughts on load.
Connect ComposeModal to /api/thoughts POST.
Connect FilterBar to filter displayed thoughts by mood.
Connect key input in top bar to /api/key POST — highlight matching thoughts.
Add the grain texture overlay to globals.css.
Make sure it looks exactly right on mobile too.
```

---

## 5. Run locally
```bash
npm run dev
```
Open http://localhost:3000

---

## 6. Deploy to Vercel (when ready)
1. Push your project to GitHub
2. Go to https://vercel.com → Import project
3. Add all three env variables from .env.local in Vercel dashboard
4. Deploy — it's live
