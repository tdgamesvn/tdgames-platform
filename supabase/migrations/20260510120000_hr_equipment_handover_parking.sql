-- Bàn giao dụng cụ / tài sản làm việc + Đăng ký gửi xe (HR)

CREATE TABLE IF NOT EXISTS public.hr_equipment_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  handover_number text NOT NULL DEFAULT '',
  handover_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'signed', 'returned')),
  location text NOT NULL DEFAULT '',
  giver_name text NOT NULL DEFAULT '',
  receiver_ack text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.hr_equipment_handover_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.hr_equipment_handovers(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'cái',
  serial_number text NOT NULL DEFAULT '',
  condition_notes text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hr_equipment_handovers_employee ON public.hr_equipment_handovers(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_handover_items_handover ON public.hr_equipment_handover_items(handover_id);

CREATE TABLE IF NOT EXISTS public.hr_parking_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL DEFAULT 'motorcycle'
    CHECK (vehicle_type IN ('motorcycle', 'car', 'bicycle', 'electric_bike', 'other')),
  license_plate text NOT NULL DEFAULT '',
  vehicle_brand text NOT NULL DEFAULT '',
  vehicle_model text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  card_number text NOT NULL DEFAULT '',
  parking_area text NOT NULL DEFAULT '',
  registered_at date,
  effective_from date,
  effective_to date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_hr_parking_employee ON public.hr_parking_registrations(employee_id);

-- RLS
ALTER TABLE public.hr_equipment_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_equipment_handover_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_parking_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_equipment_handovers_select ON public.hr_equipment_handovers;
CREATE POLICY hr_equipment_handovers_select ON public.hr_equipment_handovers
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS hr_equipment_handovers_insert ON public.hr_equipment_handovers;
CREATE POLICY hr_equipment_handovers_insert ON public.hr_equipment_handovers
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS hr_equipment_handovers_update ON public.hr_equipment_handovers;
CREATE POLICY hr_equipment_handovers_update ON public.hr_equipment_handovers
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS hr_equipment_handovers_delete ON public.hr_equipment_handovers;
CREATE POLICY hr_equipment_handovers_delete ON public.hr_equipment_handovers
  FOR DELETE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS hr_equipment_handover_items_select ON public.hr_equipment_handover_items;
CREATE POLICY hr_equipment_handover_items_select ON public.hr_equipment_handover_items
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.hr_equipment_handovers h
      WHERE h.id = handover_id
        AND h.employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS hr_equipment_handover_items_insert ON public.hr_equipment_handover_items;
CREATE POLICY hr_equipment_handover_items_insert ON public.hr_equipment_handover_items
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS hr_equipment_handover_items_update ON public.hr_equipment_handover_items;
CREATE POLICY hr_equipment_handover_items_update ON public.hr_equipment_handover_items
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS hr_equipment_handover_items_delete ON public.hr_equipment_handover_items;
CREATE POLICY hr_equipment_handover_items_delete ON public.hr_equipment_handover_items
  FOR DELETE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS hr_parking_registrations_select ON public.hr_parking_registrations;
CREATE POLICY hr_parking_registrations_select ON public.hr_parking_registrations
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS hr_parking_registrations_insert ON public.hr_parking_registrations;
CREATE POLICY hr_parking_registrations_insert ON public.hr_parking_registrations
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS hr_parking_registrations_update ON public.hr_parking_registrations;
CREATE POLICY hr_parking_registrations_update ON public.hr_parking_registrations
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS hr_parking_registrations_delete ON public.hr_parking_registrations;
CREATE POLICY hr_parking_registrations_delete ON public.hr_parking_registrations
  FOR DELETE TO authenticated USING (public.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_equipment_handovers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_equipment_handover_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_parking_registrations TO authenticated;
GRANT ALL ON public.hr_equipment_handovers TO service_role;
GRANT ALL ON public.hr_equipment_handover_items TO service_role;
GRANT ALL ON public.hr_parking_registrations TO service_role;
