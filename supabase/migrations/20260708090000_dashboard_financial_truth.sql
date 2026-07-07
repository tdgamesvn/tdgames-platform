-- Dashboard Financial Truth Layer:
-- 1) Bank balance history (append-only, same pattern as hr_position_history)
-- 2) crm_project_id link columns for expense_expenses + wf_tasks so
--    Project Profitability can be computed without free-text matching.
-- 3) FK-ify invoice_invoices.crm_project_id (was plain text with no constraint).

-- ── 1. Bank balance snapshots ──────────────────────────────────
CREATE TABLE public.finance_bank_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE,
  balance numeric NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'statement_reconciled')),
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_balance_snapshots_account_date
  ON public.finance_bank_balance_snapshots (account_id, snapshot_date DESC);

ALTER TABLE public.finance_bank_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_bank_balance_snapshots_staff ON public.finance_bank_balance_snapshots
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- ── 2. Project FK columns ──────────────────────────────────────
ALTER TABLE public.expense_expenses
  ADD COLUMN IF NOT EXISTS crm_project_id uuid REFERENCES public.crm_projects(id) ON DELETE SET NULL;

ALTER TABLE public.wf_tasks
  ADD COLUMN IF NOT EXISTS crm_project_id uuid REFERENCES public.crm_projects(id) ON DELETE SET NULL;

-- No backfill: existing `project` / `project_name` free-text fields stay as
-- display fallback. Confidence indicator (Task 4) surfaces the % still
-- unmapped instead of guessing a match.

-- ── 3. FK-ify invoice_invoices.crm_project_id ──────────────────
-- Column already exists as `text` with no constraint. Null out any value
-- that isn't a valid crm_projects.id before adding the FK, so the
-- migration can't fail on dirty data.
UPDATE public.invoice_invoices
SET crm_project_id = NULL
WHERE crm_project_id IS NOT NULL
  AND crm_project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE public.invoice_invoices i
SET crm_project_id = NULL
WHERE i.crm_project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.crm_projects p WHERE p.id = i.crm_project_id::uuid);

ALTER TABLE public.invoice_invoices
  ALTER COLUMN crm_project_id TYPE uuid USING crm_project_id::uuid;

ALTER TABLE public.invoice_invoices
  ADD CONSTRAINT invoice_invoices_crm_project_id_fkey
  FOREIGN KEY (crm_project_id) REFERENCES public.crm_projects(id) ON DELETE SET NULL;
