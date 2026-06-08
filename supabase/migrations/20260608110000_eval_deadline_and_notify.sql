-- ══════════════════════════════════════════════════════════════
-- Eval deadline column + notify-on-create trigger
-- ══════════════════════════════════════════════════════════════

-- 1. Add deadline column
--    Use DEFAULT now() temporarily so the ALTER succeeds even if
--    test rows exist, then drop the default to enforce NOT NULL
--    for all future inserts.
ALTER TABLE hr_evaluation_cycles
  ADD COLUMN deadline timestamptz NOT NULL DEFAULT now();

ALTER TABLE hr_evaluation_cycles
  ALTER COLUMN deadline DROP DEFAULT;

-- 2. Trigger: notify employee when a new cycle is created
CREATE OR REPLACE FUNCTION public.notify_eval_cycle_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _auth_user_id uuid;
BEGIN
  SELECT auth_user_id INTO _auth_user_id
  FROM hr_employees WHERE id = NEW.employee_id LIMIT 1;

  -- Employee has no platform account → skip silently
  IF _auth_user_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (
    _auth_user_id,
    'eval_assigned',
    'Bạn có form tự đánh giá mới',
    'Kỳ đánh giá: ' || NEW.period_label || '. Hạn nộp: ' ||
      to_char(NEW.deadline AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'),
    '#portal'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_eval_cycle_created
  AFTER INSERT ON public.hr_evaluation_cycles
  FOR EACH ROW EXECUTE FUNCTION public.notify_eval_cycle_created();
