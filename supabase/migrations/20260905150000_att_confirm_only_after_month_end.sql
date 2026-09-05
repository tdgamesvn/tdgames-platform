-- Chỉ cho HR gửi yêu cầu xác nhận bảng công từ NGÀY CUỐI THÁNG trở đi.
-- Gửi giữa tháng thì NV thấy số liệu dở dang (vd 5/9 mới có 3 công) → khó hiểu, xác nhận vô nghĩa.
-- UI cũng mờ nút trước ngày đó; guard ở đây là lớp chặn thật.

CREATE OR REPLACE FUNCTION public.att_request_sheet_confirm(_sheet_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s record;
  _n int;
  _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _last  date;
BEGIN
  IF NOT is_staff() THEN RAISE EXCEPTION 'Chi HR/admin duoc gui yeu cau xac nhan'; END IF;
  SELECT * INTO _s FROM att_monthly_sheets WHERE id = _sheet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Khong tim thay bang cong'; END IF;
  IF _s.status = 'finalized' THEN RAISE EXCEPTION 'Bang cong da chot'; END IF;

  _last := (make_date(_s.year, _s.month, 1) + interval '1 month' - interval '1 day')::date;
  IF _today < _last THEN
    RAISE EXCEPTION 'Thang %/% chua ket thuc — gui yeu cau xac nhan tu ngay % tro di.', _s.month, _s.year, to_char(_last, 'DD/MM');
  END IF;

  UPDATE att_monthly_records SET confirmed_at = NULL WHERE sheet_id = _sheet_id;
  UPDATE att_monthly_sheets  SET review_sent_at = now() WHERE id = _sheet_id;

  INSERT INTO notifications (recipient_user_id, type, title, body, link)
  SELECT e.auth_user_id, 'attendance_confirm',
         '📋 Xác nhận bảng công Tháng ' || _s.month || '/' || _s.year,
         'Kiểm tra ngày công / OT / đi muộn của bạn trong Portal. Đúng thì bấm Xác nhận, sai thì báo HR trước khi chốt.',
         '#portal/tasks'
  FROM   att_monthly_records mr
  JOIN   hr_employees e ON e.id = mr.employee_id
  WHERE  mr.sheet_id = _sheet_id AND e.auth_user_id IS NOT NULL AND e.status = 'active';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
