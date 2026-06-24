-- CRM Deals — Sales Pipeline for BD
-- Each deal tracks a potential revenue opportunity through stages

CREATE TABLE IF NOT EXISTS crm_deals (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
  title         text NOT NULL,
  value         numeric(15,2) NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','VND')),
  stage         text NOT NULL DEFAULT 'lead'
                CHECK (stage IN ('lead','contacted','negotiating','proposal_sent','contracting','won','lost')),
  owner_id      uuid NOT NULL,               -- auth.users.id of the BD
  owner_name    text NOT NULL DEFAULT '',     -- display name for quick render
  expected_close_date date,
  actual_close_date   date,
  lost_reason   text,
  probability   smallint NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_crm_deals_client   ON crm_deals(client_id);
CREATE INDEX idx_crm_deals_owner    ON crm_deals(owner_id);
CREATE INDEX idx_crm_deals_stage    ON crm_deals(stage);

-- RLS
ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;

-- Admin & ke_toan: full access
CREATE POLICY crm_deals_admin ON crm_deals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' IN ('admin','ke_toan')
             OR u.raw_user_meta_data->>'secondary_roles' LIKE '%ke_toan%')
    )
  );

-- BD: see all deals, edit only own
CREATE POLICY crm_deals_bd_read ON crm_deals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'bd'
             OR u.raw_user_meta_data->>'secondary_roles' LIKE '%bd%')
    )
  );

CREATE POLICY crm_deals_bd_write ON crm_deals
  FOR ALL
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'bd'
             OR u.raw_user_meta_data->>'secondary_roles' LIKE '%bd%')
    )
  );
