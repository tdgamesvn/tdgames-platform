-- ══════════════════════════════════════════════════════════════════
-- Leave Balances — quy tắc 50% (sếp, 2026-08-03):
--   "Lên chính thức được ít nhất 50% của tháng đó thì được hưởng
--    1 ngày phép cho tháng đó luôn."
--
--   Cũ (20260707180000): đếm hiệu số chỉ mục tháng → tháng chính thức
--       chỉ được cộng khi SANG tháng kế tiếp. VD chính thức 12/7 →
--       suốt tháng 7 số dư = 0, phải đến 1/8 mới có 1 ngày. Và tháng 12
--       thì mất luôn (1/1 năm sau đã reset).
--
--   Mới: xét TỪNG tháng dương lịch. Số ngày chính thức trong tháng
--       (tính đến hôm nay) >= 50% số ngày của tháng đó → tháng đó được
--       1 ngày, có hiệu lực NGAY. VD chính thức 12/7 → 12→27/7 là 16/31
--       ngày (>= 15.5) → từ 27/7 đã có 1 ngày. Tháng làm đủ → đạt mốc
--       vào ngày 16 (hoặc 15 với tháng 30 ngày, 14 với tháng 2).
--
--   Hệ quả: mốc cộng rơi vào GIỮA tháng → cron phải chạy hàng ngày,
--       không còn ngày 1 hàng tháng.
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
          -- số ngày đã chính thức trong tháng này, tính đến p_as_of
          LEAST(p_as_of, (m.month_start + interval '1 month - 1 day')::date)
          - GREATEST(p_official_date, m.month_start::date)
          + 1
        ) * 2
        >= EXTRACT(DAY FROM (m.month_start + interval '1 month - 1 day'))::int;
$function$;

-- Cron: mốc cộng nằm giữa tháng → chạy hàng ngày 00:10 UTC thay vì ngày 1.
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-leave-balances-monthly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'refresh-leave-balances-daily',
  '10 0 * * *',
  $$SELECT public.refresh_leave_balances(EXTRACT(YEAR FROM CURRENT_DATE)::integer)$$
);

-- Backfill năm hiện tại theo công thức mới.
SELECT public.refresh_leave_balances(2026);
