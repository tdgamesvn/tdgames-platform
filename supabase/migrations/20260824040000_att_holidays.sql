-- Lịch nghỉ lễ/Tết do HR nhập tay (app không có nguồn dữ liệu ngày lễ nào để tự lấy).
-- Dùng để tắt nhắc chấm công những ngày cả công ty nghỉ.
--
-- Nhập theo KHOẢNG chứ không theo từng ngày: Tết là một dòng 14/02→20/02, HR khỏi bấm 7 lần.

CREATE TABLE IF NOT EXISTS public.att_holidays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  date_from  date NOT NULL,
  date_to    date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT att_holidays_range CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS att_holidays_range_idx ON public.att_holidays (date_from, date_to);

ALTER TABLE public.att_holidays ENABLE ROW LEVEL SECURITY;

-- Ai cũng đọc được (widget chấm công / nhắc việc cần biết), chỉ staff sửa được.
DROP POLICY IF EXISTS att_holidays_read ON public.att_holidays;
CREATE POLICY att_holidays_read ON public.att_holidays
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS att_holidays_write ON public.att_holidays;
CREATE POLICY att_holidays_write ON public.att_holidays
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-- Nhắc chấm công: bỏ qua ngày nghỉ lễ, cạnh điều kiện đơn nghỉ đã có.
CREATE OR REPLACE FUNCTION public.att_should_check_today(_employee_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
           -- Đơn nghỉ đã duyệt phủ ngày này. leave_type='remote' KHÔNG tính:
           -- làm tại nhà vẫn phải chấm công, chỉ là bỏ qua GPS.
           SELECT 1 FROM public.att_requests q
           WHERE q.employee_id = _employee_id
             AND q.request_type = 'leave'
             AND q.status = 'approved'
             AND COALESCE(q.leave_type, '') <> 'remote'
             AND _date BETWEEN q.date_from AND q.date_to
         )
     AND NOT EXISTS (
           SELECT 1 FROM public.att_holidays h
           WHERE _date BETWEEN h.date_from AND h.date_to
         );
$$;
