-- Add trigger_source and lead_score to crm_outreach_leads
-- trigger_source: origin of the lead signal (generic, hiring_signal, funded, etc.)
-- lead_score: 0-100 priority score (hiring_signal T1=85, T2=70, T3=55; generic T1=50, T2=40, T3=30)

ALTER TABLE crm_outreach_leads
  ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'generic';

ALTER TABLE crm_outreach_leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 30;

UPDATE crm_outreach_leads SET lead_score = 50 WHERE tier = 1 AND trigger_source = 'generic';
UPDATE crm_outreach_leads SET lead_score = 40 WHERE tier = 2 AND trigger_source = 'generic';

CREATE INDEX IF NOT EXISTS idx_leads_trigger_source ON crm_outreach_leads(trigger_source);
CREATE INDEX IF NOT EXISTS idx_leads_score ON crm_outreach_leads(lead_score DESC);
