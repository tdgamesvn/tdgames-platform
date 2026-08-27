-- Vá lỗ: policy `att_records_member_insert_geo` chỉ kiểm `method IN ('geo','remote')`.
-- Toàn bộ việc kiểm vị trí / kiểm có đơn WFH đang nằm ở CheckinWidget.tsx, tức là ở phía
-- client, tức là không kiểm gì cả. Nhân viên gọi thẳng PostgREST bằng token của chính mình:
--   • insert method='remote' từ bất kỳ đâu, không cần đơn nào được duyệt;
--   • insert method='geo' với lat/lng = null hoặc toạ độ bịa;
--   • insert cho `date` bất kỳ trong quá khứ (backfill ngày quên chấm).
--
-- Ba điều kiện thêm vào đều là thứ server tự kiểm được, không cần tin client:
--   1. method='remote' ⇒ phải có att_requests leave/remote status='approved' phủ đúng ngày đó.
--   2. method='geo'    ⇒ toạ độ phải nằm trong bán kính att_office_config (cùng công thức
--                        haversine client đang dùng ⇒ không phát sinh từ chối oan).
--   3. date = CURRENT_DATE ⇒ chỉ chấm cho hôm nay.
--
-- Không đụng `att_records_staff` (is_staff(), FOR ALL) — HR/admin nhập tay và Edge Function
-- (service_role, bypass RLS) đi lối khác, không bị siết.
--
-- ponytail: hàm STABLE thường, KHÔNG SECURITY DEFINER — policy chạy dưới quyền người gọi,
-- att_requests_select đã cho member đọc đơn của chính mình nên EXISTS chạy được. Để DEFINER
-- thì hàm thành RPC dò được trạng thái WFH của người khác, tự mở một lỗ khác.
-- ponytail: haversine viết thẳng, không bật PostGIS/earthdistance cho một phép tính.
-- Ceiling: toạ độ vẫn do client gửi ⇒ chặn được gọi API trần, KHÔNG chặn được app giả GPS.
-- Muốn chặn tiếp phải đi qua Edge Function ký nonce, đắt hơn nhiều — chưa cần.
CREATE OR REPLACE FUNCTION public.att_selfcheckin_valid(
  _employee_id uuid,
  _method      text,
  _date        date,
  _lat         float8,
  _lng         float8
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT _date = CURRENT_DATE AND CASE _method
    WHEN 'remote' THEN EXISTS (
      SELECT 1 FROM att_requests r
      WHERE r.employee_id  = _employee_id
        AND r.request_type = 'leave'
        AND r.leave_type   = 'remote'
        AND r.status       = 'approved'
        AND _date BETWEEN r.date_from AND r.date_to
    )
    WHEN 'geo' THEN _lat IS NOT NULL AND _lng IS NOT NULL AND EXISTS (
      SELECT 1 FROM att_office_config c
      WHERE 2 * 6371000 * asin(sqrt(
              power(sin(radians(_lat - c.lat) / 2), 2)
              + cos(radians(c.lat)) * cos(radians(_lat))
                * power(sin(radians(_lng - c.lng) / 2), 2)
            )) <= c.radius_meters
    )
    ELSE false
  END;
$$;

DROP POLICY IF EXISTS "att_records_member_insert_geo" ON public.att_records;
CREATE POLICY "att_records_member_insert_geo"
  ON public.att_records FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    AND public.att_selfcheckin_valid(employee_id, method, date, check_in_lat, check_in_lng)
  );
