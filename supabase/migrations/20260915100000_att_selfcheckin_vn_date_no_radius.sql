-- 1. Ngày chấm công so với "hôm nay" theo giờ VN, không phải CURRENT_DATE (UTC).
--    Client gửi todayVN() (Asia/Ho_Chi_Minh) ⇒ 00:00–07:00 VN server còn ở ngày hôm trước
--    ⇒ RLS từ chối oan. Đổi sang (now() at time zone 'Asia/Ho_Chi_Minh')::date cho khớp.
-- 2. Bỏ kiểm bán kính với method='geo': nhân viên chưa (hoặc chưa được duyệt) đơn Remote vẫn
--    được chấm GPS ngoài phạm vi VP. Toạ độ vẫn bắt buộc và vẫn lưu check_in_lat/lng để HR
--    đối chiếu sau. method='remote' vẫn phải có đơn WFH đã duyệt phủ đúng ngày.
-- Policy att_records_member_insert_geo gọi hàm theo tên ⇒ chỉ cần REPLACE hàm.
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
  SELECT _date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND CASE _method
    WHEN 'remote' THEN EXISTS (
      SELECT 1 FROM att_requests r
      WHERE r.employee_id  = _employee_id
        AND r.request_type = 'leave'
        AND r.leave_type   = 'remote'
        AND r.status       = 'approved'
        AND _date BETWEEN r.date_from AND r.date_to
    )
    WHEN 'geo' THEN _lat IS NOT NULL AND _lng IS NOT NULL
    ELSE false
  END;
$$;
