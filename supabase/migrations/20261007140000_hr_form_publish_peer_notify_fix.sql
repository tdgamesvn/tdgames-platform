-- hr_form_publish_peer: thông báo cho người được đánh giá không được tạo.
-- Bản cũ chèn notifications trong CTE `noti` không được câu chính tham chiếu
-- (test prod 2026-10-07: publish trả 1 nhưng 0 notification).
-- Sửa: tách thành 2 câu lệnh tường minh.
CREATE OR REPLACE FUNCTION public.hr_form_publish_peer(p_form_id uuid, p_target_ids uuid[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _f public.hr_forms; _ids uuid[];
BEGIN
  IF NOT public.jwt_has_any_role(ARRAY['admin']) THEN RAISE EXCEPTION 'Chỉ admin được duyệt công bố kết quả'; END IF;
  SELECT * INTO _f FROM public.hr_forms WHERE id = p_form_id;
  IF NOT FOUND OR _f.kind <> 'peer_review' THEN RAISE EXCEPTION 'Không phải đợt đánh giá chéo'; END IF;

  -- chỉ người đã có ≥ 1 bài chấm của đồng nghiệp (bài trưởng phòng luôn hiện sẵn)
  WITH ins AS (
    INSERT INTO public.hr_form_peer_publications (form_id, target_employee_id)
    SELECT DISTINCT p_form_id, r.target_employee_id FROM public.hr_form_responses r
    WHERE r.form_id = p_form_id AND r.target_employee_id = ANY(p_target_ids) AND NOT r.is_manager
    ON CONFLICT DO NOTHING
    RETURNING target_employee_id
  )
  SELECT COALESCE(array_agg(target_employee_id), '{}') INTO _ids FROM ins;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link, metadata)
  SELECT e.auth_user_id, 'hr_form_peer_result', '📊 Có kết quả đánh giá chéo',
         _f.title, '#portal/surveys', jsonb_build_object('form_id', p_form_id)
  FROM public.hr_employees e
  WHERE e.id = ANY(_ids) AND e.auth_user_id IS NOT NULL;

  RETURN COALESCE(array_length(_ids, 1), 0);
END $$;

REVOKE ALL ON FUNCTION public.hr_form_publish_peer(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_form_publish_peer(uuid, uuid[]) TO authenticated;
