-- Test quyền apply_migration qua MCP (02/10/2026) — chỉ thêm ghi chú cho hàm, không đổi logic.
COMMENT ON FUNCTION public.att_guard_sheet_finalize() IS
  'Chặn chốt bảng công (draft→finalized) khi chưa gửi NV xác nhận hoặc còn NV bắt buộc chưa xác nhận. Migration 20261002150000.';
