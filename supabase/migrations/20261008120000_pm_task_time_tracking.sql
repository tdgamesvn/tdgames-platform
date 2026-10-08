-- Theo dõi thời gian làm task theo trạng thái ClickUp (app Dự án).
-- Sếp chốt 2026-10-08:
--   • Tính giờ làm: in progress, fix, lead_check, internal review (lead_check vẫn làm tiếp batch sau).
--   • KHÔNG tính: client_review, pending, nhóm chưa bắt đầu, nhóm kết thúc.
--   • Fulltime: chỉ phần giao với giờ CHẤM CÔNG thật (check_in→check_out, trừ 12:00–13:00 giờ VN).
--     Không chấm công ngày đó = không làm. (Chấm công qua app từ T9, log trạng thái từ 17/9 ⇒ phủ đủ.)
--   • Freelancer: tương đối = tổng thời gian đồng hồ ở trạng thái "đang làm".
-- Nguồn: wf_task_status_log (trigger, từ 17/9). Khoảng trước log đầu tiên của task KHÔNG biết ⇒ bỏ.

-- 1. Phân nhóm trạng thái (admin sửa được)
CREATE TABLE IF NOT EXISTS public.wf_status_categories (
  status    text PRIMARY KEY CHECK (status = lower(trim(status))),
  category  text NOT NULL CHECK (category IN ('active','waiting_client','not_started','done')),
  label     text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.wf_status_categories (status, category, label) VALUES
  ('in progress','active','Đang làm'), ('fix','active','Sửa (FIX)'),
  ('lead_check','active','Lead check'), ('internal review','active','Review nội bộ'),
  ('client_review','waiting_client','Chờ khách duyệt'), ('pending','waiting_client','Tạm dừng'),
  ('backlog','not_started','Backlog'), ('new request','not_started','Yêu cầu mới'), ('planning','not_started','Lên kế hoạch'),
  ('approved','done','Đã duyệt'), ('closed','done','Đóng'), ('completed','done','Hoàn thành'),
  ('complete','done','Hoàn thành'), ('done','done','Xong'), ('cancelled','done','Huỷ')
ON CONFLICT (status) DO NOTHING;

ALTER TABLE public.wf_status_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY wf_status_categories_read ON public.wf_status_categories FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','pm','ke_toan']));
CREATE POLICY wf_status_categories_admin ON public.wf_status_categories FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin'])) WITH CHECK (public.jwt_has_any_role(ARRAY['admin']));

-- 2. Khoảng trạng thái của từng task: [changed_at, lần đổi kế tiếp | now()).
--    Trạng thái lạ chưa phân nhóm ⇒ 'unknown' (không tính, hiện ra để admin phân nhóm).
CREATE OR REPLACE VIEW public.pm_task_status_intervals AS
  SELECT l.task_id,
         lower(trim(l.to_status)) AS status,
         COALESCE(c.category, 'unknown') AS category,
         l.changed_at AS started_at,
         LEAD(l.changed_at) OVER w AS ended_at,
         tstzrange(l.changed_at, COALESCE(LEAD(l.changed_at) OVER w, now())) AS period
  FROM public.wf_task_status_log l
  LEFT JOIN public.wf_status_categories c ON c.status = lower(trim(l.to_status))
  WHERE public.jwt_has_any_role(ARRAY['admin','pm'])
  WINDOW w AS (PARTITION BY l.task_id ORDER BY l.changed_at);

-- 3. Khung giờ làm thật của fulltime: chấm công, tách nghỉ trưa 12:00–13:00 VN.
--    Chưa check-out (đang làm / quên bấm) ⇒ tính tới min(now, 17:30 VN).
CREATE OR REPLACE VIEW public.pm_work_windows AS
  WITH base AS (
    SELECT e.worker_id, r.date,
           r.check_in AS s,
           COALESCE(r.check_out, LEAST(now(), (r.date + time '17:30') AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS e,
           (r.date + time '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS l1,
           (r.date + time '13:00') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS l2
    FROM public.att_records r
    JOIN public.hr_employees e ON e.id = r.employee_id AND e.worker_id IS NOT NULL
    WHERE r.check_in IS NOT NULL
  )
  SELECT worker_id, date, tstzrange(s, LEAST(e, l1)) AS win FROM base WHERE s < LEAST(e, l1)
  UNION ALL
  SELECT worker_id, date, tstzrange(GREATEST(s, l2), e) FROM base WHERE GREATEST(s, l2) < e;

-- 4. Tổng hợp theo (task, người làm)
CREATE OR REPLACE VIEW public.pm_task_time AS
  WITH tw AS (  -- người làm của task (assignees, fallback worker_id)
    SELECT a.task_id, a.worker_id FROM public.wf_task_assignees a
    UNION
    SELECT t.id, t.worker_id FROM public.wf_tasks t
    WHERE t.worker_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.wf_task_assignees a WHERE a.task_id = t.id)
  ),
  ft AS (  -- fulltime = có hồ sơ HR fulltime/parttime liên kết worker
    SELECT DISTINCT worker_id FROM public.hr_employees WHERE worker_id IS NOT NULL AND type IN ('fulltime','parttime')
  ),
  iv AS (SELECT * FROM public.pm_task_status_intervals)
  SELECT tw.task_id, tw.worker_id,
         (ft.worker_id IS NOT NULL) AS is_fulltime,
         -- Giờ làm: fulltime = giao với chấm công; freelancer = đồng hồ
         round((CASE WHEN ft.worker_id IS NOT NULL THEN
            COALESCE((SELECT sum(extract(epoch FROM upper(iv.period * w.win) - lower(iv.period * w.win)))
                      FROM iv JOIN public.pm_work_windows w ON w.worker_id = tw.worker_id AND iv.period && w.win
                      WHERE iv.task_id = tw.task_id AND iv.category = 'active'), 0)
          ELSE
            COALESCE((SELECT sum(extract(epoch FROM upper(iv.period) - lower(iv.period)))
                      FROM iv WHERE iv.task_id = tw.task_id AND iv.category = 'active'), 0)
          END / 3600.0)::numeric, 2) AS active_hours,
         round((COALESCE((SELECT sum(extract(epoch FROM upper(iv.period) - lower(iv.period)))
                 FROM iv WHERE iv.task_id = tw.task_id AND iv.category = 'active'), 0) / 3600.0)::numeric, 2) AS active_calendar_hours,
         round((COALESCE((SELECT sum(extract(epoch FROM upper(iv.period) - lower(iv.period)))
                 FROM iv WHERE iv.task_id = tw.task_id AND iv.category = 'waiting_client'), 0) / 3600.0)::numeric, 2) AS waiting_client_hours,
         (SELECT count(*) FROM iv WHERE iv.task_id = tw.task_id AND iv.status = 'fix') AS fix_rounds,
         (SELECT min(iv.started_at) FROM iv WHERE iv.task_id = tw.task_id AND iv.status = 'client_review') AS first_client_review_at,
         (SELECT min(iv.started_at) FROM iv WHERE iv.task_id = tw.task_id) AS tracked_since,
         (SELECT iv.status FROM iv WHERE iv.task_id = tw.task_id ORDER BY iv.started_at DESC LIMIT 1) AS current_status,
         (SELECT iv.started_at FROM iv WHERE iv.task_id = tw.task_id ORDER BY iv.started_at DESC LIMIT 1) AS current_status_since
  FROM tw LEFT JOIN ft ON ft.worker_id = tw.worker_id
  WHERE public.jwt_has_any_role(ARRAY['admin','pm'])
    AND EXISTS (SELECT 1 FROM public.wf_task_status_log l WHERE l.task_id = tw.task_id);

REVOKE ALL ON public.pm_task_status_intervals, public.pm_work_windows, public.pm_task_time FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pm_task_status_intervals, public.pm_task_time TO authenticated;
-- pm_work_windows: chỉ dùng nội bộ trong pm_task_time (giờ chấm công cá nhân) — không grant.
