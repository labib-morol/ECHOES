-- Echoes — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- https://supabase.com → your project → SQL Editor → New Query

-- ============================================
-- THOUGHTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS thoughts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content         TEXT NOT NULL CHECK (char_length(content) >= 3 AND char_length(content) <= 2000),
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

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-expired thoughts (but key_hash is excluded at API level)
CREATE POLICY "Public can read active thoughts"
  ON thoughts FOR SELECT
  USING (expires_at > NOW());

-- Anyone can insert a thought (no login required)
CREATE POLICY "Anyone can post a thought"
  ON thoughts FOR INSERT
  WITH CHECK (true);

-- Anyone can increment felt_count (controlled at API level with rate limiting)
CREATE POLICY "Anyone can update felt_count"
  ON thoughts FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================
-- AUTO-DELETE EXPIRED THOUGHTS
-- Enable pg_cron extension in Supabase dashboard first:
-- Database → Extensions → search "pg_cron" → enable
-- Then run this:
-- ============================================

-- SELECT cron.schedule(
--   'delete-expired-thoughts',
--   '0 3 * * *',
--   $$ DELETE FROM thoughts WHERE expires_at < NOW() $$
-- );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_thoughts_expires_at ON thoughts(expires_at);
CREATE INDEX IF NOT EXISTS idx_thoughts_mood ON thoughts(mood);
CREATE INDEX IF NOT EXISTS idx_thoughts_key_hash ON thoughts(key_hash);
CREATE INDEX IF NOT EXISTS idx_thoughts_created_at ON thoughts(created_at DESC);

-- ============================================
-- VERIFY
-- ============================================
-- After running, check with:
-- SELECT * FROM thoughts LIMIT 5;
-- You should see an empty table with all columns.
