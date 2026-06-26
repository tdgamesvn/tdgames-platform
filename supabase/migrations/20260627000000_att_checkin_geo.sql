-- supabase/migrations/20260627000000_att_checkin_geo.sql

-- ── 1. Add GPS audit columns to att_records ─────────────────
ALTER TABLE public.att_records
  ADD COLUMN IF NOT EXISTS check_in_lat  FLOAT,
  ADD COLUMN IF NOT EXISTS check_in_lng  FLOAT;

-- ── 2. Office config table (single row) ─────────────────────
CREATE TABLE IF NOT EXISTS public.att_office_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name   TEXT    NOT NULL DEFAULT 'TD Games HQ',
  lat           FLOAT   NOT NULL,
  lng           FLOAT   NOT NULL,
  radius_meters INT     NOT NULL DEFAULT 300,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default: Hòa Bình Green City, 505 Minh Khai, Vĩnh Tuy, HN
INSERT INTO public.att_office_config (office_name, lat, lng, radius_meters)
VALUES ('Hòa Bình Green City – 505 Minh Khai', 20.9979, 105.8672, 300)
ON CONFLICT DO NOTHING;

-- ── 3. RLS on att_office_config (read-only for all authenticated) ──
ALTER TABLE public.att_office_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "att_office_config_read_authenticated" ON public.att_office_config;
CREATE POLICY "att_office_config_read_authenticated"
  ON public.att_office_config FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "att_office_config_update_admin" ON public.att_office_config;
CREATE POLICY "att_office_config_update_admin"
  ON public.att_office_config FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr')
  );

-- ── 4. RLS on att_records for member self-service ────────────
-- NOTE: att_records may already have RLS enabled from earlier migrations.
-- These policies are additive (DROP IF EXISTS prevents conflicts).

ALTER TABLE public.att_records ENABLE ROW LEVEL SECURITY;

-- SELECT: member sees only their own records
DROP POLICY IF EXISTS "att_records_member_select_own" ON public.att_records;
CREATE POLICY "att_records_member_select_own"
  ON public.att_records FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr', 'ke_toan')
  );

-- INSERT: member can create their own record, method must be 'geo' or 'remote'
DROP POLICY IF EXISTS "att_records_member_insert_geo" ON public.att_records;
CREATE POLICY "att_records_member_insert_geo"
  ON public.att_records FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    AND method IN ('geo', 'remote')
  );

-- UPDATE: member can update check_out on their own record
DROP POLICY IF EXISTS "att_records_member_update_checkout" ON public.att_records;
CREATE POLICY "att_records_member_update_checkout"
  ON public.att_records FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr')
  )
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr')
  );
