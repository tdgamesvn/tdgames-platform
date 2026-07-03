-- Nghiệm thu freelancer theo từng dự án: mỗi nghiệm thu chỉ chứa task của 1 dự án.
-- Cột này lưu tên dự án (WorkforceTask.project) để hiển thị trên list/detail.
-- Không backfill — nghiệm thu cũ (trước migration) có thể đã gộp nhiều dự án,
-- không xác định được 1 dự án duy nhất nên để NULL.
ALTER TABLE wf_settlements
  ADD COLUMN IF NOT EXISTS project_name text;
