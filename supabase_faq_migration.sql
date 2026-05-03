-- =====================================================
-- Supabase Migration: FAQ & Support System
-- Run this in your Supabase SQL Editor (Dashboard → SQL)
-- =====================================================

-- 1. FAQ Table
CREATE TABLE IF NOT EXISTS faq (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'chilling_center')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. System Config Table (for nestle_phone etc.)
CREATE TABLE IF NOT EXISTS system_config (
  id BIGSERIAL PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Feedback Logs Table
CREATE TABLE IF NOT EXISTS feedback_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  role TEXT,
  question_id BIGINT REFERENCES faq(id) ON DELETE SET NULL,
  additional_info TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- 4. Add phone_number to chilling_centers (if not already present)
ALTER TABLE chilling_centers
  ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '';

-- 5. Enable Row Level Security (optional but recommended)
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read for FAQs
CREATE POLICY "Public read FAQs" ON faq FOR SELECT USING (true);

-- Allow public read for system_config
CREATE POLICY "Public read config" ON system_config FOR SELECT USING (true);

-- Allow authenticated inserts for feedback_logs
CREATE POLICY "Auth insert feedback" ON feedback_logs FOR INSERT WITH CHECK (true);

-- Allow service role full access (for API functions)
CREATE POLICY "Service role full access faq" ON faq FOR ALL USING (true);
CREATE POLICY "Service role full access config" ON system_config FOR ALL USING (true);
CREATE POLICY "Service role full access logs" ON feedback_logs FOR ALL USING (true);

-- 6. Seed initial Nestlé phone number (optional)
INSERT INTO system_config (config_key, config_value)
VALUES ('nestle_phone', '+94771234567')
ON CONFLICT (config_key) DO NOTHING;
