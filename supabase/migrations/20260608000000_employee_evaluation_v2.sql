-- ══════════════════════════════════════════════════════════
-- Employee Evaluation v2 — 2 new tables
-- ══════════════════════════════════════════════════════════

-- ── Table 1: hr_evaluation_cycles ────────────────────────

CREATE TABLE hr_evaluation_cycles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  period_type          text NOT NULL CHECK (period_type IN ('probation','semi_annual')),
  period_label         text NOT NULL,
  status               text NOT NULL DEFAULT 'pending_self'
                         CHECK (status IN ('pending_self','pending_leader','pending_1on1','completed')),
  leader_user_id       uuid NOT NULL REFERENCES auth.users(id),
  self_submitted_at    timestamptz,
  leader_submitted_at  timestamptz,
  completed_at         timestamptz,
  requires_1on1        boolean NOT NULL DEFAULT false,
  created_by           uuid NOT NULL REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_eval_cycles_employee ON hr_evaluation_cycles(employee_id);
CREATE INDEX idx_hr_eval_cycles_status   ON hr_evaluation_cycles(status);
CREATE INDEX idx_hr_eval_cycles_leader   ON hr_evaluation_cycles(leader_user_id);

-- ── Table 2: hr_evaluation_submissions ───────────────────

CREATE TABLE hr_evaluation_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id            uuid NOT NULL REFERENCES hr_evaluation_cycles(id) ON DELETE CASCADE,
  evaluator_role      text NOT NULL CHECK (evaluator_role IN ('self','leader')),
  evaluator_user_id   uuid NOT NULL REFERENCES auth.users(id),
  groups              jsonb NOT NULL DEFAULT '[]',
  -- [{name, weight, scores:[1-5], group_avg}]
  total_score         numeric(4,2) NOT NULL,
  rating              text NOT NULL CHECK (rating IN ('excellent','good','meets','needs_improvement')),
  comments            text NOT NULL DEFAULT '',
  recommended_action  text NOT NULL DEFAULT '',
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, evaluator_role)
);

CREATE INDEX idx_hr_eval_submissions_cycle ON hr_evaluation_submissions(cycle_id);

-- ── RLS ──────────────────────────────────────────────────

ALTER TABLE hr_evaluation_cycles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_evaluation_submissions ENABLE ROW LEVEL SECURITY;

-- Full access for authenticated users (HR staff) — matches pattern used in rest of app
-- Fine-grained policies can be added later once role system is confirmed.
CREATE POLICY "hr_eval_cycles_auth_all"
  ON hr_evaluation_cycles FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "hr_eval_submissions_auth_all"
  ON hr_evaluation_submissions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
