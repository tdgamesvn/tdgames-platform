-- HR Forms (Khảo sát & Biểu mẫu) — giai đoạn 1: khảo sát thường.
-- Module riêng, KHÔNG đụng hr_evaluation_* (đánh giá cố định self/leader).
--
-- Ẩn danh (sếp chốt 2026-10-06): HR biết AI đã nộp (assignment.submitted_at, để nhắc),
-- nhưng KHÔNG biết nội dung của ai: response của form ẩn danh không lưu respondent,
-- không lưu assignment_id, không lưu giờ nộp chính xác (chỉ ngày) ⇒ không nối ngược được.
-- Mọi ghi của nhân viên đi qua RPC SECURITY DEFINER; bảng không có policy INSERT cho member.

CREATE TABLE IF NOT EXISTS public.hr_forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  kind          text NOT NULL DEFAULT 'survey' CHECK (kind IN ('survey','peer_review')),
  is_anonymous  boolean NOT NULL DEFAULT false,
  deadline      date,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  entity        text DEFAULT 'TD GAMES',
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  opened_at     timestamptz
);

CREATE TABLE IF NOT EXISTS public.hr_form_questions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id   uuid NOT NULL REFERENCES public.hr_forms(id) ON DELETE CASCADE,
  position  int  NOT NULL DEFAULT 0,
  kind      text NOT NULL CHECK (kind IN ('text','textarea','single_choice','multi_choice','rating','scale')),
  label     text NOT NULL,
  options   jsonb NOT NULL DEFAULT '[]'::jsonb,   -- choice: ["A","B"]; scale: {"min":1,"max":10}
  required  boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS hr_form_questions_form_idx ON public.hr_form_questions(form_id, position);

CREATE TABLE IF NOT EXISTS public.hr_form_assignments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                 uuid NOT NULL REFERENCES public.hr_forms(id) ON DELETE CASCADE,
  respondent_employee_id  uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  target_employee_id      uuid REFERENCES public.hr_employees(id) ON DELETE CASCADE, -- giai đoạn 2 (peer_review)
  submitted_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (form_id, respondent_employee_id, target_employee_id)
);
CREATE INDEX IF NOT EXISTS hr_form_assignments_resp_idx ON public.hr_form_assignments(respondent_employee_id);

CREATE TABLE IF NOT EXISTS public.hr_form_responses (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                 uuid NOT NULL REFERENCES public.hr_forms(id) ON DELETE CASCADE,
  assignment_id           uuid UNIQUE REFERENCES public.hr_form_assignments(id) ON DELETE CASCADE, -- NULL nếu ẩn danh
  respondent_employee_id  uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,              -- NULL nếu ẩn danh
  target_employee_id      uuid REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  answers                 jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { question_id: value }
  submitted_on            date NOT NULL DEFAULT current_date
);
CREATE INDEX IF NOT EXISTS hr_form_responses_form_idx ON public.hr_form_responses(form_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.hr_forms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_form_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_form_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_form_responses   ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hr_forms_is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public.jwt_has_any_role(ARRAY['admin','hr']); $$;

CREATE OR REPLACE FUNCTION public.hr_forms_my_employee_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT id FROM public.hr_employees WHERE auth_user_id = auth.uid(); $$;

-- Form: HR/admin toàn quyền; nhân viên đọc form không phải draft mà mình được giao.
CREATE POLICY hr_forms_manage ON public.hr_forms FOR ALL TO authenticated
  USING (public.hr_forms_is_manager()) WITH CHECK (public.hr_forms_is_manager());
CREATE POLICY hr_forms_read_assigned ON public.hr_forms FOR SELECT TO authenticated
  USING (status <> 'draft' AND EXISTS (
    SELECT 1 FROM public.hr_form_assignments a
    WHERE a.form_id = hr_forms.id
      AND a.respondent_employee_id IN (SELECT public.hr_forms_my_employee_ids())));

CREATE POLICY hr_form_questions_manage ON public.hr_form_questions FOR ALL TO authenticated
  USING (public.hr_forms_is_manager()) WITH CHECK (public.hr_forms_is_manager());
CREATE POLICY hr_form_questions_read_assigned ON public.hr_form_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_forms f WHERE f.id = form_id)); -- kế thừa RLS của hr_forms

-- Assignment: HR đọc/xoá; nhân viên đọc của mình. Tạo/đánh dấu nộp chỉ qua RPC.
CREATE POLICY hr_form_assignments_manage ON public.hr_form_assignments FOR ALL TO authenticated
  USING (public.hr_forms_is_manager()) WITH CHECK (public.hr_forms_is_manager());
CREATE POLICY hr_form_assignments_read_own ON public.hr_form_assignments FOR SELECT TO authenticated
  USING (respondent_employee_id IN (SELECT public.hr_forms_my_employee_ids()));

-- Response: HR chỉ ĐỌC (không sửa câu trả lời của người khác); nhân viên đọc bài
-- không ẩn danh của chính mình. Không ai INSERT trực tiếp.
CREATE POLICY hr_form_responses_read_manager ON public.hr_form_responses FOR SELECT TO authenticated
  USING (public.hr_forms_is_manager());
CREATE POLICY hr_form_responses_read_own ON public.hr_form_responses FOR SELECT TO authenticated
  USING (respondent_employee_id IN (SELECT public.hr_forms_my_employee_ids()));

-- ─── RPC: mở form + giao cho nhân viên + bắn thông báo (push qua trigger notifications) ──
-- Gọi lại được để thêm người nhận; người đã được giao thì không bị báo lần 2.
CREATE OR REPLACE FUNCTION public.hr_form_open(p_form_id uuid, p_employee_ids uuid[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _f public.hr_forms;
  _n int;
BEGIN
  IF NOT public.hr_forms_is_manager() THEN RAISE EXCEPTION 'Chỉ HR/admin được mở khảo sát'; END IF;
  SELECT * INTO _f FROM public.hr_forms WHERE id = p_form_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy form'; END IF;
  IF _f.status = 'closed' THEN RAISE EXCEPTION 'Form đã đóng'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hr_form_questions WHERE form_id = p_form_id) THEN
    RAISE EXCEPTION 'Form chưa có câu hỏi';
  END IF;

  WITH ins AS (
    INSERT INTO public.hr_form_assignments (form_id, respondent_employee_id)
    SELECT p_form_id, e.id FROM public.hr_employees e
    WHERE e.id = ANY(p_employee_ids) AND e.auth_user_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING respondent_employee_id
  ), noti AS (
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT e.auth_user_id, 'hr_form_open',
           '📋 Khảo sát mới: ' || _f.title,
           CASE WHEN _f.deadline IS NOT NULL
                THEN 'Hạn nộp ' || to_char(_f.deadline, 'DD/MM/YYYY') ELSE 'Mời bạn điền khảo sát' END,
           '#portal/surveys', jsonb_build_object('form_id', p_form_id)
    FROM ins JOIN public.hr_employees e ON e.id = ins.respondent_employee_id
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM noti;

  UPDATE public.hr_forms SET status = 'open', opened_at = COALESCE(opened_at, now()) WHERE id = p_form_id;
  RETURN _n;
END $$;

-- Nhắc người chưa nộp.
CREATE OR REPLACE FUNCTION public.hr_form_remind(p_form_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _f public.hr_forms; _n int;
BEGIN
  IF NOT public.hr_forms_is_manager() THEN RAISE EXCEPTION 'Chỉ HR/admin'; END IF;
  SELECT * INTO _f FROM public.hr_forms WHERE id = p_form_id;
  IF _f.status <> 'open' THEN RAISE EXCEPTION 'Form không ở trạng thái mở'; END IF;
  WITH noti AS (
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT DISTINCT e.auth_user_id, 'hr_form_remind', '⏰ Nhắc điền khảo sát: ' || _f.title,
           CASE WHEN _f.deadline IS NOT NULL
                THEN 'Hạn nộp ' || to_char(_f.deadline, 'DD/MM/YYYY') ELSE 'Bạn chưa nộp khảo sát' END,
           '#portal/surveys', jsonb_build_object('form_id', p_form_id)
    FROM public.hr_form_assignments a JOIN public.hr_employees e ON e.id = a.respondent_employee_id
    WHERE a.form_id = p_form_id AND a.submitted_at IS NULL AND e.auth_user_id IS NOT NULL
    RETURNING 1
  ) SELECT count(*) INTO _n FROM noti;
  RETURN _n;
END $$;

-- Nhân viên nộp bài. Kiểm: đúng người, form open, còn hạn (hết ngày deadline giờ VN), chưa nộp,
-- câu bắt buộc có trả lời. Ẩn danh ⇒ response không mang dấu vết người nộp.
CREATE OR REPLACE FUNCTION public.hr_form_submit(p_assignment_id uuid, p_answers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _a public.hr_form_assignments; _f public.hr_forms; _missing text;
BEGIN
  SELECT * INTO _a FROM public.hr_form_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND OR _a.respondent_employee_id NOT IN (SELECT public.hr_forms_my_employee_ids()) THEN
    RAISE EXCEPTION 'Không tìm thấy khảo sát của bạn';
  END IF;
  IF _a.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Bạn đã nộp khảo sát này rồi'; END IF;
  SELECT * INTO _f FROM public.hr_forms WHERE id = _a.form_id;
  IF _f.status <> 'open' THEN RAISE EXCEPTION 'Khảo sát đã đóng'; END IF;
  IF _f.deadline IS NOT NULL AND (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > _f.deadline THEN
    RAISE EXCEPTION 'Đã quá hạn nộp';
  END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION 'Dữ liệu trả lời không hợp lệ'; END IF;

  SELECT string_agg(q.label, ', ') INTO _missing
  FROM public.hr_form_questions q
  WHERE q.form_id = _f.id AND q.required
    AND (NOT p_answers ? q.id::text
         OR p_answers->q.id::text IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb));
  IF _missing IS NOT NULL THEN RAISE EXCEPTION 'Chưa trả lời câu bắt buộc: %', _missing; END IF;

  -- Chỉ giữ key là câu hỏi của form (chặn nhồi dữ liệu rác)
  INSERT INTO public.hr_form_responses (form_id, assignment_id, respondent_employee_id, target_employee_id, answers)
  SELECT _f.id,
         CASE WHEN _f.is_anonymous THEN NULL ELSE _a.id END,
         CASE WHEN _f.is_anonymous THEN NULL ELSE _a.respondent_employee_id END,
         _a.target_employee_id,
         COALESCE((SELECT jsonb_object_agg(k, v) FROM jsonb_each(p_answers) AS j(k, v)
                   WHERE k IN (SELECT id::text FROM public.hr_form_questions WHERE form_id = _f.id)), '{}'::jsonb);

  UPDATE public.hr_form_assignments SET submitted_at = now() WHERE id = _a.id;
END $$;

REVOKE ALL ON FUNCTION public.hr_form_open(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_form_remind(uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_form_submit(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_form_open(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_form_remind(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_form_submit(uuid, jsonb) TO authenticated;
