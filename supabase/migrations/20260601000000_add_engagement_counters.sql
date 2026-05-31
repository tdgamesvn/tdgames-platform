-- Add engagement counters to crm_outreach_leads
-- Incremented by Resend webhook on email.opened / email.clicked events
-- Used for hot lead detection (open_count >= 3 triggers Discord alert)

ALTER TABLE crm_outreach_leads
  ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE crm_outreach_leads
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_open_count ON crm_outreach_leads(open_count DESC);
