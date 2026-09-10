-- ══════════════════════════════════════════════════════════════════
-- Leave Balances — tháng lên chính thức phải đủ 2/3 tháng (sếp, 2026-09-10):
--
--   Cũ (20260803100000 / 20260910100000): tháng lên chính thức được 1 ngày
--       phép nếu số ngày chính thức trong tháng >= 50% số ngày tháng đó.
--
--   Mới: >= 2/3 số ngày tháng đó (tính theo ngày dương lịch, như cũ).
--       VD chính thức 11/9 (20/30) → có T9; 12/9 (19/30) → T10 mới có.
--
--   Grandfather: người có ngày chính thức TRƯỚC 10/9/2026 đã được tính theo
--       quy tắc 50% → giữ nguyên, không tính lại (cron refresh hàng ngày ghi đè
--       accrued_days nên phải khoá trong công thức, không thể chỉ bỏ backfill).
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
  CROSS JOIN LATERAL (
    SELECT
      -- số ngày chính thức trong CẢ tháng này (dự kiến đến cuối tháng)
      ((m.month_start + interval '1 month - 1 day')::date - GREATEST(p_official_date, m.month_start::date) + 1) AS d,
      EXTRACT(DAY FROM (m.month_start + interval '1 month - 1 day'))::int AS n
  ) x
  WHERE CASE
          -- ponytail: grandfather quy tắc 50% cho người chính thức trước 10/9/2026
          WHEN p_official_date < DATE '2026-09-10' THEN x.d * 2 >= x.n
          ELSE x.d * 3 >= x.n * 2
        END;
$function$;

-- Self-check: fail migration nếu công thức sai.
DO $$
BEGIN
  -- Người cũ: giữ quy tắc 50% — chính thức 12/7 (16/31) vẫn có T7
  ASSERT public.count_official_months_in_year('2026-07-12', 2026, '2026-07-12') = 1;
  ASSERT public.count_official_months_in_year('2026-07-20', 2026, '2026-07-31') = 0;
  -- Người mới: 2/3 — chính thức 11/9 (20/30 = 2/3) → có T9 ngay
  ASSERT public.count_official_months_in_year('2026-09-11', 2026, '2026-09-11') = 1;
  -- Chính thức 12/9 (19/30 < 2/3) → không T9, T10 mới có
  ASSERT public.count_official_months_in_year('2026-09-12', 2026, '2026-09-30') = 0;
  ASSERT public.count_official_months_in_year('2026-09-12', 2026, '2026-10-01') = 1;
  -- Tháng 31 ngày: 11/10 (21/31 → 63 >= 62) có; 12/10 (20/31 → 60 < 62) không
  ASSERT public.count_official_months_in_year('2026-10-11', 2026, '2026-10-31') = 1;
  ASSERT public.count_official_months_in_year('2026-10-12', 2026, '2026-10-31') = 0;
  -- Tháng làm đủ + chưa chính thức không đổi
  ASSERT public.count_official_months_in_year('2026-01-01', 2026, '2026-12-31') = 12;
  ASSERT public.count_official_months_in_year('2026-11-01', 2026, '2026-09-10') = 0;
END $$;

-- Backfill: người cũ không đổi (grandfather), người chính thức từ 10/9 tính theo 2/3.
SELECT public.refresh_leave_balances(2026);
