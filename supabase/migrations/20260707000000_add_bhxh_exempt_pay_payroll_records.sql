-- Fix: bảng lương T6 tạo ra nhưng rỗng — insert pay_payroll_records fail
-- vì code mới ghi cột bhxh_exempt nhưng prod chưa có cột này.
-- Đã apply trực tiếp trên prod qua MCP (2026-07-02), file này để đồng bộ history.

ALTER TABLE pay_payroll_records
  ADD COLUMN IF NOT EXISTS bhxh_exempt boolean NOT NULL DEFAULT false;
