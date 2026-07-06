-- ══════════════════════════════════════════════════════════════════
-- Leave Balances — chốt lại mốc cộng ngày phép theo THÁNG DƯƠNG LỊCH
-- (sếp, 2026-07-06, follow-up sau khi phát hiện công thức cũ sai mốc):
--
--   Cũ: count_official_months_in_year() dùng AGE() theo NGÀY chính thức
--       lặp lại mỗi tháng (VD chính thức 15/6 → phải đến 15/7 mới cộng
--       ngày đầu tiên). Sếp xác nhận đây KHÔNG đúng ý.
--
--   Mới: hễ chính thức trong bất kỳ ngày nào của 1 tháng dương lịch (dù
--       chỉ 1 ngày) → tháng đó tính đủ; ngày phép của tháng đó được cộng
--       vào đúng ngày 1 đầu tháng KẾ TIẾP. VD chính thức 15/6/2026 → đến
--       1/7/2026 được cộng ngay 1 ngày (cho tháng 6). Đến 1/8 cộng thêm
--       1 ngày nữa (cho tháng 7). Tính bằng hiệu số chỉ mục tháng
--       (year*12+month), không phụ thuộc ngày trong tháng.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.count_official_months_in_year(p_official_date date, p_year integer, p_as_of date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT GREATEST(0,
    (
      EXTRACT(YEAR FROM LEAST(p_as_of, make_date(p_year, 12, 31)))::int * 12
      + EXTRACT(MONTH FROM LEAST(p_as_of, make_date(p_year, 12, 31)))::int
    )
    -
    (
      EXTRACT(YEAR FROM GREATEST(p_official_date, make_date(p_year, 1, 1)))::int * 12
      + EXTRACT(MONTH FROM GREATEST(p_official_date, make_date(p_year, 1, 1)))::int
    )
  )::integer;
$function$;

-- Backfill: tính lại accrued_days cho toàn bộ NV fulltime/active năm 2026
-- theo công thức mới (auto_create_leave_balance trigger + refresh_leave_balances
-- cron đều gọi chung count_official_months_in_year, không cần sửa 2 hàm đó).
SELECT public.refresh_leave_balances(2026);
