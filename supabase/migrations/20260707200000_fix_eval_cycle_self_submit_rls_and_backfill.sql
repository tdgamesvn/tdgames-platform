-- Root cause: 20260702120000_tighten_rls_role_policies.sql restricted hr_eval_cycles_write to
-- admin/hr, leader_user_id, or created_by only. The employee submitting their OWN self-evaluation
-- is none of these, so the status-advance UPDATE (pending_self -> pending_leader) in
-- submitEvaluation() was silently blocked by RLS (0 rows updated, no error thrown) — the
-- submission row still saved fine, but the cycle stayed stuck on "pending_self".
-- Fix: allow the employee being evaluated to update their own cycle too, matching the existing
-- auth_user_id-lookup pattern used elsewhere in this project (e.g. hr_onboarding_acknowledgments).

DROP POLICY IF EXISTS hr_eval_cycles_write ON public.hr_evaluation_cycles;
CREATE POLICY hr_eval_cycles_write ON public.hr_evaluation_cycles
  FOR ALL TO authenticated
  USING (
    public.jwt_has_any_role(ARRAY['admin','hr'])
    OR leader_user_id = auth.uid()
    OR created_by = auth.uid()
    OR employee_id IN (SELECT e.id FROM hr_employees e WHERE e.auth_user_id = auth.uid())
  )
  WITH CHECK (
    public.jwt_has_any_role(ARRAY['admin','hr'])
    OR leader_user_id = auth.uid()
    OR created_by = auth.uid()
    OR employee_id IN (SELECT e.id FROM hr_employees e WHERE e.auth_user_id = auth.uid())
  );

-- Backfill: any cycle stuck on pending_self that already has a self submission on file.
UPDATE hr_evaluation_cycles c
SET status = 'pending_leader',
    self_submitted_at = s.submitted_at
FROM hr_evaluation_submissions s
WHERE s.cycle_id = c.id
  AND s.evaluator_role = 'self'
  AND c.status = 'pending_self';
