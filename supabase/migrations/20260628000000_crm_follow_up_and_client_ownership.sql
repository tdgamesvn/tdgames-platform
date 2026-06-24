-- Follow-up Reminders: add next_follow_up date to deals
ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS next_follow_up DATE;

-- Client Ownership: assign BD to each client
ALTER TABLE crm_clients
  ADD COLUMN IF NOT EXISTS assigned_bd_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_bd_name TEXT DEFAULT '';

-- Index for follow-up queries (find overdue/today follow-ups)
CREATE INDEX IF NOT EXISTS idx_deals_next_follow_up
  ON crm_deals (next_follow_up)
  WHERE next_follow_up IS NOT NULL;

-- Index for client ownership queries
CREATE INDEX IF NOT EXISTS idx_clients_assigned_bd
  ON crm_clients (assigned_bd_id)
  WHERE assigned_bd_id IS NOT NULL;
