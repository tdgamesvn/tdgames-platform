-- Onboarding Acknowledgment Flow — DB schema
-- 2026-07-03

-- 1. Đánh dấu bài handbook là "bắt buộc đọc khi onboarding"
ALTER TABLE handbook_articles
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN handbook_articles.is_required IS
  'Admin đánh dấu bài này bắt buộc nhân viên mới phải đọc và tick xác nhận trước khi vào app.';

-- 2. Ghi nhận thời điểm nhân viên hoàn thành onboarding
ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

COMMENT ON COLUMN hr_employees.onboarding_completed_at IS
  'NULL = chưa hoàn thành onboarding acknowledgment. SET = đã xem và tick tất cả bài bắt buộc.';

-- 3. Lưu từng bài nhân viên đã acknowledge
CREATE TABLE IF NOT EXISTS hr_onboarding_acknowledgments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id     uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  article_id      uuid NOT NULL REFERENCES handbook_articles(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, article_id)
);

COMMENT ON TABLE hr_onboarding_acknowledgments IS
  'Mỗi row = nhân viên đã tick xác nhận đọc 1 bài handbook bắt buộc.';

-- RLS: nhân viên chỉ thấy acknowledgment của mình; admin thấy tất cả
ALTER TABLE hr_onboarding_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_own_acks" ON hr_onboarding_acknowledgments
  FOR ALL USING (
    auth.uid() = employee_id
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role') IN ('admin', 'hr', 'ke_toan')
    )
  );
