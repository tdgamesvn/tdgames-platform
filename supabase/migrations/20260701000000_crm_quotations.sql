-- CRM Quotations table
CREATE TABLE IF NOT EXISTS crm_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES crm_clients(id) ON DELETE CASCADE,
  quotation_number TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VND')),
  discount NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until DATE,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_deal ON crm_quotations(deal_id);
CREATE INDEX IF NOT EXISTS idx_quotations_client ON crm_quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON crm_quotations(status);

-- RLS
ALTER TABLE crm_quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quotations"
  ON crm_quotations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert quotations"
  ON crm_quotations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update quotations"
  ON crm_quotations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete quotations"
  ON crm_quotations FOR DELETE TO authenticated USING (true);
