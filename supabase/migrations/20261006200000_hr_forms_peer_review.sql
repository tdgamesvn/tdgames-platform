-- HR Forms giai đoạn 2: ĐÁNH GIÁ CHÉO (hr_forms.kind = 'peer_review').
-- Sếp chốt 2026-10-06:
--   1. HR/admin tự chọn người chấm cho từng người (khác phòng ban cũng được) → RPC hr_form_open_peer.
--   2. Chưa có trưởng phòng ⇒ tạm thời ADMIN là người duyệt công bố (hr_form_peer_publications).
--   3. Người được đánh giá LUÔN thấy bài chấm của trưởng phòng (assignment.is_manager, có tên).
--      Bài của đồng nghiệp chỉ thấy khi admin duyệt công bố, KHÔNG có tên người chấm
--      (giá trị từng câu sắp xếp độc lập ⇒ không nối được các câu của cùng 1 người chấm).

ALTER TABLE public.hr_form_assignments ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false;
ALTER TABLE public.hr_form_responses   ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false;

-- Gắn cờ is_manager cho bài nộp (bài ẩn danh không lưu respondent ⇒ suy từ auth.uid() + assignment).
CREATE OR REPLACE FUNCTION public.hr_form_responses_mark_manager()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.is_manager := NEW.target_employee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.hr_form_assignments a
    WHERE a.form_id = NEW.form_id AND a.target_employee_id = NEW.target_employee_id AND a.is_manager
      AND a.respondent_employee_id IN (SELECT public.hr_forms_my_employee_ids()));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hr_form_responses_mark_manager ON public.hr_form_responses;
CREATE TRIGGER trg_hr_form_responses_mark_manager BEFORE INSERT ON public.hr_form_responses
  FOR EACH ROW EXECUTE FUNCTION public.hr_form_responses_mark_manager();

CREATE TABLE IF NOT EXISTS public.hr_form_peer_publications (
  form_id             uuid NOT NULL REFERENCES public.hr_forms(id) ON DELETE CASCADE,
  target_employee_id  uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  published_at        timestamptz NOT NULL DEFAULT now(),
  published_by        uuid DEFAULT auth.uid(),
  PRIMARY KEY (form_id, target_employee_id)
);
ALTER TABLE public.hr_form_peer_publications ENABLE ROW LEVEL SECURITY;
-- HR xem được; chỉ admin công bố/thu hồi (tạm thay trưởng phòng).
CREATE POLICY hr_form_peer_publications_read ON public.hr_form_peer_publications FOR SELECT TO authenticated
  USING (public.hr_forms_is_manager());
CREATE POLICY hr_form_peer_publications_admin ON public.hr_form_peer_publications FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin'])) WITH CHECK (public.jwt_has_any_role(ARRAY['admin']));

-- Mỗi người được đánh giá chỉ có tối đa 1 trưởng phòng chấm (kết quả gắn tên theo assignment này).
CREATE UNIQUE INDEX IF NOT EXISTS hr_form_assignments_one_manager_idx
  ON public.hr_form_assignments(form_id, target_employee_id) WHERE is_manager;

CREATE INDEX IF NOT EXISTS hr_form_responses_target_idx ON public.hr_form_responses(form_id, target_employee_id);

-- ─── Mở đợt đánh giá chéo: giao từng cặp (người chấm → người được chấm) ─────
-- p_respondents[i] chấm p_targets[i]; p_is_manager[i] = người chấm là trưởng phòng của target.
-- Gọi lại được để thêm cặp; cặp đã có thì bỏ qua.
-- Mỗi người chấm chỉ nhận 1 thông báo/lần gọi dù được giao nhiều người.
CREATE OR REPLACE FUNCTION public.hr_form_open_peer(p_form_id uuid, p_respondents uuid[], p_targets uuid[], p_is_manager boolean[] DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _f public.hr_forms; _n int;
BEGIN
  IF NOT public.hr_forms_is_manager() THEN RAISE EXCEPTION 'Chỉ HR/admin được mở đánh giá'; END IF;
  IF COALESCE(array_length(p_respondents, 1), 0) <> COALESCE(array_length(p_targets, 1), 0) THEN
    RAISE EXCEPTION 'Danh sách cặp không hợp lệ';
  END IF;
  SELECT * INTO _f FROM public.hr_forms WHERE id = p_form_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy form'; END IF;
  IF _f.kind <> 'peer_review' THEN RAISE EXCEPTION 'Form không phải đánh giá chéo'; END IF;
  IF _f.status = 'closed' THEN RAISE EXCEPTION 'Form đã đóng'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hr_form_questions WHERE form_id = p_form_id) THEN
    RAISE EXCEPTION 'Form chưa có câu hỏi';
  END IF;

  WITH pairs AS (
    SELECT r, t, bool_or(COALESCE(m, false)) AS m
    FROM unnest(p_respondents, p_targets, COALESCE(p_is_manager, '{}'::boolean[])) AS u(r, t, m)
    WHERE r IS NOT NULL AND t IS NOT NULL AND r <> t GROUP BY r, t
  ), ins AS (
    INSERT INTO public.hr_form_assignments (form_id, respondent_employee_id, target_employee_id, is_manager)
    SELECT p_form_id, p.r, p.t, p.m FROM pairs p
    JOIN public.hr_employees er ON er.id = p.r AND er.auth_user_id IS NOT NULL
    JOIN public.hr_employees et ON et.id = p.t
    ON CONFLICT DO NOTHING
    RETURNING respondent_employee_id
  ), per AS (
    SELECT respondent_employee_id AS rid, count(*) AS cnt FROM ins GROUP BY 1
  ), noti AS (
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT e.auth_user_id, 'hr_form_open',
           '🤝 Đánh giá chéo: ' || _f.title,
           'Mời bạn đánh giá ' || per.cnt || ' đồng nghiệp'
             || CASE WHEN _f.deadline IS NOT NULL THEN ' · hạn ' || to_char(_f.deadline, 'DD/MM/YYYY') ELSE '' END,
           '#portal/surveys', jsonb_build_object('form_id', p_form_id)
    FROM per JOIN public.hr_employees e ON e.id = per.rid
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM noti;

  UPDATE public.hr_forms SET status = 'open', opened_at = COALESCE(opened_at, now()) WHERE id = p_form_id;
  RETURN _n;
END $$;

-- Chặn hr_form_open (khảo sát thường) dùng nhầm cho peer_review (sẽ tạo assignment không có target).
CREATE OR REPLACE FUNCTION public.hr_forms_guard_open_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.target_employee_id IS NULL
     AND EXISTS (SELECT 1 FROM public.hr_forms WHERE id = NEW.form_id AND kind = 'peer_review') THEN
    RAISE EXCEPTION 'Đánh giá chéo phải có người được đánh giá';
  END IF;
  IF NEW.target_employee_id = NEW.respondent_employee_id THEN
    RAISE EXCEPTION 'Không tự đánh giá chính mình trong đánh giá chéo';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hr_form_assignments_guard ON public.hr_form_assignments;
CREATE TRIGGER trg_hr_form_assignments_guard BEFORE INSERT OR UPDATE ON public.hr_form_assignments
  FOR EACH ROW EXECUTE FUNCTION public.hr_forms_guard_open_kind();

-- ─── Tên người được đánh giá cho người chấm (member không đọc được hr_employees của người khác) ──
CREATE OR REPLACE FUNCTION public.hr_form_my_targets()
RETURNS TABLE (employee_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT e.id, e.full_name
  FROM public.hr_form_assignments a JOIN public.hr_employees e ON e.id = a.target_employee_id
  WHERE a.respondent_employee_id IN (SELECT public.hr_forms_my_employee_ids());
$$;

-- ─── HR công bố / thu hồi kết quả cho người được đánh giá ────────────────────
CREATE OR REPLACE FUNCTION public.hr_form_publish_peer(p_form_id uuid, p_target_ids uuid[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _f public.hr_forms; _n int;
BEGIN
  IF NOT public.jwt_has_any_role(ARRAY['admin']) THEN RAISE EXCEPTION 'Chỉ admin được duyệt công bố kết quả'; END IF;
  SELECT * INTO _f FROM public.hr_forms WHERE id = p_form_id;
  IF NOT FOUND OR _f.kind <> 'peer_review' THEN RAISE EXCEPTION 'Không phải đợt đánh giá chéo'; END IF;

  WITH ok AS (  -- chỉ người đã có ≥ 1 bài chấm của đồng nghiệp (bài trưởng phòng luôn hiện sẵn)
    SELECT DISTINCT r.target_employee_id AS tid FROM public.hr_form_responses r
    WHERE r.form_id = p_form_id AND r.target_employee_id = ANY(p_target_ids) AND NOT r.is_manager
  ), ins AS (
    INSERT INTO public.hr_form_peer_publications (form_id, target_employee_id)
    SELECT p_form_id, tid FROM ok
    ON CONFLICT DO NOTHING
    RETURNING target_employee_id
  ), noti AS (
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT e.auth_user_id, 'hr_form_peer_result', '📊 Có kết quả đánh giá chéo',
           _f.title, '#portal/surveys', jsonb_build_object('form_id', p_form_id)
    FROM ins JOIN public.hr_employees e ON e.id = ins.target_employee_id
    WHERE e.auth_user_id IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM ins;   -- CTE ghi (noti) luôn chạy dù không SELECT
  RETURN _n;
END $$;

-- ─── Người được đánh giá xem kết quả của mình ─────────────────────────────────
-- Trả về [{form_id, title, published, n, managers:[{name, answers}], questions:[{id,label,kind,options,values}]}].
--   managers: bài trưởng phòng — luôn có, kèm tên.
--   questions.values: bài đồng nghiệp, chỉ khi admin đã công bố; sort theo giá trị, không tên.
CREATE OR REPLACE FUNCTION public.hr_form_my_peer_results()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH me AS (SELECT public.hr_forms_my_employee_ids() AS id),
  tf AS (  -- (form, tôi) có bài trưởng phòng hoặc đã công bố
    SELECT DISTINCT r.form_id, r.target_employee_id AS tid FROM public.hr_form_responses r
    WHERE r.target_employee_id IN (SELECT id FROM me) AND r.is_manager
    UNION
    SELECT p.form_id, p.target_employee_id FROM public.hr_form_peer_publications p
    WHERE p.target_employee_id IN (SELECT id FROM me)
  )
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'title'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'form_id', f.id, 'title', f.title,
      'published', pub.form_id IS NOT NULL,
      'n', CASE WHEN pub.form_id IS NULL THEN 0 ELSE (SELECT count(*) FROM public.hr_form_responses r
            WHERE r.form_id = f.id AND r.target_employee_id = tf.tid AND NOT r.is_manager) END,
      'managers', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('name', e.full_name, 'answers', r.answers)), '[]'::jsonb)
        FROM public.hr_form_responses r
        JOIN public.hr_form_assignments a ON a.form_id = r.form_id AND a.target_employee_id = r.target_employee_id AND a.is_manager
        JOIN public.hr_employees e ON e.id = a.respondent_employee_id
        WHERE r.form_id = f.id AND r.target_employee_id = tf.tid AND r.is_manager
          AND (r.respondent_employee_id IS NULL OR r.respondent_employee_id = a.respondent_employee_id)),
      'questions', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', q.id, 'label', q.label, 'kind', q.kind, 'options', q.options,
          'values', CASE WHEN pub.form_id IS NULL THEN '[]'::jsonb ELSE
                    (SELECT COALESCE(jsonb_agg(r.answers->q.id::text ORDER BY (r.answers->q.id::text)::text), '[]'::jsonb)
                     FROM public.hr_form_responses r
                     WHERE r.form_id = f.id AND r.target_employee_id = tf.tid AND NOT r.is_manager
                       AND r.answers ? q.id::text
                       AND r.answers->q.id::text NOT IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb)) END
        ) ORDER BY q.position), '[]'::jsonb)
        FROM public.hr_form_questions q WHERE q.form_id = f.id)
    ) AS x
    FROM tf
    JOIN public.hr_forms f ON f.id = tf.form_id
    LEFT JOIN public.hr_form_peer_publications pub ON pub.form_id = tf.form_id AND pub.target_employee_id = tf.tid
  ) s;
$$;

REVOKE ALL ON FUNCTION public.hr_form_open_peer(uuid, uuid[], uuid[], boolean[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_form_my_targets()                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_form_publish_peer(uuid, uuid[])      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_form_my_peer_results()               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_forms_guard_open_kind()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hr_form_responses_mark_manager()        FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hr_form_open_peer(uuid, uuid[], uuid[], boolean[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_form_my_targets()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_form_publish_peer(uuid, uuid[])      TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_form_my_peer_results()               TO authenticated;
