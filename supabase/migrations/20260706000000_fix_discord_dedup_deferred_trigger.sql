-- ══════════════════════════════════════════════════════════════════════════════
-- Fix Discord dedup: running-minimum bug (2nd occurrence after 20260704 fix)
--
-- Root cause:
--   notify_eval_submission() (and other notify_* functions) insert one
--   notification per admin via a FOR loop — that's N separate INSERT
--   statements in the same transaction, not one batch insert.
--   trg_discord_admin_forward is AFTER INSERT ... FOR EACH ROW, which fires
--   IMMEDIATELY after each individual INSERT — before the next admin's row
--   exists. The dedup check (id::text < NEW.id::text) only ever "sees" rows
--   inserted so far, not the full group. Result: the running MINIMUM id seen
--   so far fires each time it drops lower — not just once per group. With 3
--   admins, random UUID ordering produced 2 Discord messages instead of 1.
--   (20260704 fix solved the advisory-lock re-entrancy bug but this ordering
--   bug survived because tests likely had only 2 admins / lucky ordering.)
--
-- Fix:
--   Make the trigger a DEFERRABLE INITIALLY DEFERRED constraint trigger.
--   Constraint triggers can be deferred to end-of-transaction (COMMIT), so by
--   the time ANY row's trigger actually fires, ALL rows from ALL inserts in
--   the transaction already exist in the table. The existing dedup query
--   (id::text < NEW.id::text) then correctly finds the true group minimum —
--   exactly one row per (type, title, created_at) group fires Discord.
--   No change to the function body needed — only the trigger's timing.
--
-- Scope: global — fixes ALL notify_* functions that loop-insert per admin.
-- ══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_discord_admin_forward ON public.notifications;

CREATE CONSTRAINT TRIGGER trg_discord_admin_forward
  AFTER INSERT ON public.notifications
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_discord_admin_forward();
