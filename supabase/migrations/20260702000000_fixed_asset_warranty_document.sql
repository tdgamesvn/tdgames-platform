-- Migration: add warranty_expires & document_url to acc_fixed_assets
-- Date: 2026-07-02

ALTER TABLE acc_fixed_assets
  ADD COLUMN IF NOT EXISTS warranty_expires DATE,
  ADD COLUMN IF NOT EXISTS document_url TEXT;

COMMENT ON COLUMN acc_fixed_assets.warranty_expires IS 'Ngày hết hạn bảo hành';
COMMENT ON COLUMN acc_fixed_assets.document_url      IS 'URL giấy tờ mua hàng / hóa đơn (R2)';
