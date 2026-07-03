-- Mở rộng cơ chế "blend lương cũ/mới tháng chuyển giao" (đã có cho pre_official_base_salary)
-- sang thêm Phụ cấp KPI và Tăng ca mặc định — tránh tính nhầm phần thử việc theo mức mới
-- khi NV đổi mức KPI/OT đúng lúc lên chính thức.
ALTER TABLE pay_payroll_records
  ADD COLUMN IF NOT EXISTS pre_official_kpi_allowance bigint,
  ADD COLUMN IF NOT EXISTS pre_official_default_ot bigint;
