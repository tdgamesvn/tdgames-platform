-- BD Dashboard Enhancement: studio owner + contract value
-- 2026-06-24

-- Feature 1: Studio owner assignment
ALTER TABLE crm_studios
  ADD COLUMN IF NOT EXISTS owner_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_name text;

CREATE INDEX IF NOT EXISTS crm_studios_owner_id_idx ON crm_studios (owner_id);

-- Feature 3: Contract value on documents
ALTER TABLE crm_documents
  ADD COLUMN IF NOT EXISTS contract_value    numeric(15, 2),
  ADD COLUMN IF NOT EXISTS contract_currency text NOT NULL DEFAULT 'USD'
    CHECK (contract_currency IN ('USD', 'VND'));

CREATE INDEX IF NOT EXISTS crm_documents_contract_idx
  ON crm_documents (created_by, doc_type)
  WHERE doc_type = 'contract';
