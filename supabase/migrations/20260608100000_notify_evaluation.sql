-- ══════════════════════════════════════════════════════════════
-- Evaluation notifications — 2 trigger functions
-- ══════════════════════════════════════════════════════════════

-- 1. hr_evaluation_submissions INSERT
--    • self  → notify leader + HR/admin
--    • leader → notify employee
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_eval_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cycle        hr_evaluation_cycles%ROWTYPE;
  _emp          hr_employees%ROWTYPE;
  _admin        RECORD;
  _rating_label text;
BEGIN
  SELECT * INTO _cycle FROM hr_evaluation_cycles WHERE id = NEW.cycle_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO _emp FROM hr_employees WHERE id = _cycle.employee_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- ── Employee nộp tự đánh giá ─────────────────────────────
  IF NEW.evaluator_role = 'self' THEN

    -- Thông báo leader
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
    VALUES (
      _cycle.leader_user_id,
      'eval_self_submitted',
      COALESCE(_emp.full_name, 'Nhân viên') || ' đã nộp tự đánh giá',
      'Chu kỳ: ' || _cycle.period_label,
      '#hr'
    );

    -- Thông báo HR/admin (bỏ qua leader để không trùng)
    FOR _admin IN
      SELECT u.id FROM auth.users u
      WHERE (u.raw_user_meta_data->>'role') IN ('admin', 'hr')
        AND u.id <> _cycle.leader_user_id
    LOOP
      INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
      VALUES (
        _admin.id,
        'eval_self_submitted',
        COALESCE(_emp.full_name, 'Nhân viên') || ' đã nộp tự đánh giá',
        'Chu kỳ: ' || _cycle.period_label,
        '#hr'
      );
    END LOOP;

  -- ── Leader nộp đánh giá → thông báo nhân viên ────────────
  ELSIF NEW.evaluator_role = 'leader' THEN

    IF _emp.auth_user_id IS NOT NULL THEN
      _rating_label := CASE NEW.rating
        WHEN 'excellent'         THEN 'Xuất sắc'
        WHEN 'good'              THEN 'Tốt'
        WHEN 'meets'             THEN 'Đạt yêu cầu'
        WHEN 'needs_improvement' THEN 'Cần cải thiện'
        ELSE NEW.rating
      END;

      INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
      VALUES (
        _emp.auth_user_id,
        'eval_leader_submitted',
        'Đánh giá của bạn đã được hoàn thành',
        'Chu kỳ: ' || _cycle.period_label || ' — Kết quả: ' || _rating_label,
        '#portal'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_eval_submission
  AFTER INSERT ON public.hr_evaluation_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_eval_submission();

-- 2. hr_evaluation_cycles status change
--    • pending_1on1 → notify HR/admin (gap > 1.0, cần buổi 1-on-1)
--    • completed    → notify employee + leader
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_eval_cycle_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp   hr_employees%ROWTYPE;
  _admin RECORD;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT * INTO _emp FROM hr_employees WHERE id = NEW.employee_id LIMIT 1;

  -- ── pending_1on1: gap điểm > 1.0 ─────────────────────────
  IF NEW.status = 'pending_1on1' THEN
    FOR _admin IN
      SELECT u.id FROM auth.users u
      WHERE (u.raw_user_meta_data->>'role') IN ('admin', 'hr')
    LOOP
      INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
      VALUES (
        _admin.id,
        'eval_1on1_required',
        COALESCE(_emp.full_name, 'Nhân viên') || ' cần buổi 1-on-1',
        'Điểm chênh lệch > 1.0 — Chu kỳ: ' || NEW.period_label,
        '#hr'
      );
    END LOOP;
  END IF;

  -- ── completed: đánh giá xong → thông báo NV + leader ─────
  IF NEW.status = 'completed' THEN

    IF _emp.auth_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
      VALUES (
        _emp.auth_user_id,
        'eval_completed',
        'Chu kỳ đánh giá đã hoàn tất',
        'Chu kỳ: ' || NEW.period_label,
        '#portal'
      );
    END IF;

    -- Notify leader (nếu khác employee)
    IF NEW.leader_user_id IS DISTINCT FROM _emp.auth_user_id THEN
      INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
      VALUES (
        NEW.leader_user_id,
        'eval_completed',
        'Chu kỳ đánh giá đã hoàn tất',
        'Chu kỳ: ' || NEW.period_label || ' — ' || COALESCE(_emp.full_name, 'Nhân viên'),
        '#hr'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_eval_cycle_status
  AFTER UPDATE OF status ON public.hr_evaluation_cycles
  FOR EACH ROW EXECUTE FUNCTION public.notify_eval_cycle_status();
