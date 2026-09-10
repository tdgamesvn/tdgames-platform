-- ══════════════════════════════════════════════════════════════════
-- Leave Balances — cộng phép ĐẦU tháng (sếp, 2026-09-10):
--
--   Cũ (20260803100000): quy tắc 50% đếm "số ngày ĐÃ chính thức tính
--       đến hôm nay" cho MỌI tháng → tháng làm đủ cũng phải đợi tới
--       ngày 15–16 mới có phép. Tác dụng phụ, không phải chủ đích.
--
--   Mới: đếm theo DỰ KIẾN CẢ THÁNG (tính đến cuối tháng thay vì hôm nay).
--       - Tháng làm đủ → có phép ngay ngày 1.
--       - Tháng lên chính thức: vẫn giữ quy tắc 50% — chính thức 12/7
--         (16/31 ngày) → có phép ngay 12/7; chính thức 20/7 (12/31) → không.
--       - Tháng chưa bắt đầu (month_start > p_as_of) vẫn không tính,
--         nhờ cận trên generate_series = date_trunc('month', p_as_of).
--
--   Cron vẫn chạy hàng ngày: ngày chính thức có thể rơi giữa tháng.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.count_official_months_in_year(p_official_date date, p_year integer, p_as_of date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COUNT(*)::integer
  FROM generate_series(
         GREATEST(date_trunc('month', p_official_date::timestamp), make_date(p_year, 1, 1)::timestamp),
         LEAST(date_trunc('month', p_as_of::timestamp), make_date(p_year, 12, 1)::timestamp),
         interval '1 month'
       ) AS m(month_start)
  WHERE (
          -- số ngày chính thức trong CẢ tháng này (dự kiến đến cuối tháng)
          (m.month_start + interval '1 month - 1 day')::date
          - GREATEST(p_official_date, m.month_start::date)
          + 1
        ) * 2
        >= EXTRACT(DAY FROM (m.month_start + interval '1 month - 1 day'))::int;
$function$;

-- Self-check: fail migration nếu công thức sai.
DO $$
BEGIN
  -- Tháng làm đủ: ngày 1 đã được tính (chính thức 1/1, hỏi tại 1/9 → 9 tháng)
  ASSERT public.count_official_months_in_year('2026-01-01', 2026, '2026-09-01') = 9;
  -- Chính thức 12/7 (16/31 ngày) → tính ngay 12/7
  ASSERT public.count_official_months_in_year('2026-07-12', 2026, '2026-07-12') = 1;
  -- Chính thức 20/7 (12/31 ngày) → không được T7, T8 mới có (ngày 1/8)
  ASSERT public.count_official_months_in_year('2026-07-20', 2026, '2026-07-31') = 0;
  ASSERT public.count_official_months_in_year('2026-07-20', 2026, '2026-08-01') = 1;
  -- Tháng chưa tới không tính
  ASSERT public.count_official_months_in_year('2026-01-01', 2026, '2026-12-31') = 12;
  -- Chưa chính thức → 0
  ASSERT public.count_official_months_in_year('2026-10-01', 2026, '2026-09-10') = 0;
END $$;

-- Backfill năm hiện tại theo công thức mới.
SELECT public.refresh_leave_balances(2026);
