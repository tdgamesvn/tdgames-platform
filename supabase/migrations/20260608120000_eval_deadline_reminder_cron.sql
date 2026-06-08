-- ══════════════════════════════════════════════════════════════
-- pg_cron: daily eval deadline reminder
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: find cycles whose deadline is tomorrow (VN time),
-- self-evaluation not yet submitted, status still pending_self.
-- Sends one reminder per cycle (deduped via metadata->>'cycle_id').
CREATE OR REPLACE FUNCTION public.send_eval_deadline_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rec              RECORD;
  _auth_user_id     uuid;
  _deadline_fmt     text;
BEGIN
  FOR _rec IN
    SELECT c.id, c.employee_id, c.period_label, c.deadline
    FROM hr_evaluation_cycles c
    WHERE (c.deadline AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
          = ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '1 day')::date
      AND c.self_submitted_at IS NULL
      AND c.status = 'pending_self'
  LOOP
    SELECT e.auth_user_id INTO _auth_user_id
    FROM hr_employees e WHERE e.id = _rec.employee_id LIMIT 1;

    -- No platform account → skip
    CONTINUE WHEN _auth_user_id IS NULL;

    -- Dedup: skip if reminder for this exact cycle was already sent
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = 'eval_deadline_reminder'
        AND metadata->>'cycle_id' = _rec.id::text
    );

    _deadline_fmt := to_char(
      _rec.deadline AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'
    );

    INSERT INTO public.notifications
      (recipient_user_id, type, title, body, link, metadata)
    VALUES (
      _auth_user_id,
      'eval_deadline_reminder',
      'Nhắc nhở: Form đánh giá sắp hết hạn',
      'Kỳ đánh giá: ' || _rec.period_label ||
        '. Hạn nộp: ngày mai (' || _deadline_fmt || ').',
      '#portal',
      jsonb_build_object('cycle_id', _rec.id)
    );
  END LOOP;
END;
$$;

-- Schedule: 01:00 UTC = 08:00 Asia/Ho_Chi_Minh
SELECT cron.schedule(
  'eval-deadline-reminder',
  '0 1 * * *',
  'SELECT public.send_eval_deadline_reminders()'
);
