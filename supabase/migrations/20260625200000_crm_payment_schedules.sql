-- supabase/migrations/20260625200000_crm_payment_schedules.sql

CREATE TABLE IF NOT EXISTS crm_payment_schedules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES crm_projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  amount      numeric     NOT NULL DEFAULT 0,
  currency    text        NOT NULL DEFAULT 'VND',
  due_date    date        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'invoiced', 'paid')),
  invoiced_at timestamptz,
  paid_at     timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_crm_ps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_ps_updated_at
  BEFORE UPDATE ON crm_payment_schedules
  FOR EACH ROW EXECUTE FUNCTION set_crm_ps_updated_at();

CREATE POLICY "crm_ps_select" ON crm_payment_schedules
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "crm_ps_insert" ON crm_payment_schedules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'bd')
          OR raw_user_meta_data->'secondary_roles' ? 'admin'
          OR raw_user_meta_data->'secondary_roles' ? 'bd'
        )
    )
  );

CREATE POLICY "crm_ps_update" ON crm_payment_schedules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'ke_toan', 'bd')
          OR raw_user_meta_data->'secondary_roles' ? 'admin'
          OR raw_user_meta_data->'secondary_roles' ? 'ke_toan'
          OR raw_user_meta_data->'secondary_roles' ? 'bd'
        )
    )
  );

CREATE POLICY "crm_ps_delete" ON crm_payment_schedules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'bd')
          OR raw_user_meta_data->'secondary_roles' ? 'admin'
          OR raw_user_meta_data->'secondary_roles' ? 'bd'
        )
    )
  );
