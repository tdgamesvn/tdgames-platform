-- Tier lead (Art Director / Producer / CEO...) đang hardcode 3 mức cứng trong frontend
-- (TIER_CFG) — chuyển sang bảng để BD/admin tự thêm tier mới qua nút "+" trên UI,
-- không cần sửa code mỗi lần muốn thêm mức mới.
CREATE TABLE IF NOT EXISTS public.crm_lead_tiers (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '🔹',
  color text NOT NULL DEFAULT '#FF9500',
  description text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed đúng 3 tier đang hardcode để không phá dữ liệu leads hiện có (tier=1/2/3).
INSERT INTO public.crm_lead_tiers (id, label, icon, color, description, sort_order)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 'Tier 1', '⭐', '#FFD60A', 'Art Director / Outsource Manager', 1),
  (2, 'Tier 2', '★',  '#FF9500', 'Producer / Lead Artist', 2),
  (3, 'Tier 3', '☆',  '#888888', 'CEO / BD Manager', 3)
ON CONFLICT (id) DO NOTHING;

-- Đẩy identity sequence qua khỏi 3 id đã seed để insert tiếp theo không đụng.
SELECT setval(pg_get_serial_sequence('public.crm_lead_tiers', 'id'), 3, true);

ALTER TABLE public.crm_lead_tiers ENABLE ROW LEVEL SECURITY;

-- Cùng nhóm role được thao tác crm_studios (admin/ke_toan/bd) — không tách theo entity,
-- tier là thang phân loại lead dùng chung cho cả 2 sổ.
CREATE POLICY crm_lead_tiers_select ON public.crm_lead_tiers
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin', 'ke_toan', 'bd']));

CREATE POLICY crm_lead_tiers_insert ON public.crm_lead_tiers
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin', 'ke_toan', 'bd']));
