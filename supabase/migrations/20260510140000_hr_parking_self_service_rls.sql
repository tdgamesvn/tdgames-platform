-- Allow employees to manage their own parking rows (insert/update/delete) in addition to staff.

DROP POLICY IF EXISTS hr_parking_registrations_insert_self ON public.hr_parking_registrations;
CREATE POLICY hr_parking_registrations_insert_self ON public.hr_parking_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS hr_parking_registrations_update_self ON public.hr_parking_registrations;
CREATE POLICY hr_parking_registrations_update_self ON public.hr_parking_registrations
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())
  )
  WITH CHECK (
    employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS hr_parking_registrations_delete_self ON public.hr_parking_registrations;
CREATE POLICY hr_parking_registrations_delete_self ON public.hr_parking_registrations
  FOR DELETE TO authenticated
  USING (
    employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())
  );
