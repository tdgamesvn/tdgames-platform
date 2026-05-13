-- ============================================================
-- Invoice → Expense Revenue Auto-Sync
-- When an invoice is marked 'paid', automatically create /
-- update a revenue record in expense_expenses.
-- Also provides sync_invoice_revenue() RPC for backfill.
-- ============================================================

-- ── Trigger function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_invoice_sync_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount   numeric;
  v_date     date;
  v_cat_id   uuid := '868dbd1b-3187-43b5-a9dd-496191ac268a'; -- 💰 Doanh thu dự án
BEGIN
  -- Helper: resolve amount (prefer amount_received, else sum items)
  v_amount := CASE
    WHEN NEW.amount_received IS NOT NULL AND NEW.amount_received > 0 THEN NEW.amount_received
    ELSE COALESCE((
      SELECT SUM((item->>'quantity')::numeric * (item->>'unitPrice')::numeric)
      FROM jsonb_array_elements(NEW.items) item
    ), 0)
  END;

  v_date := COALESCE(NEW.paid_date, NEW.issue_date, CURRENT_DATE);

  -- ── Invoice becomes paid ──────────────────────────────────
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    IF EXISTS (SELECT 1 FROM expense_expenses WHERE source_type = 'invoice' AND source_id = NEW.id) THEN
      -- Already synced — just update amount & date
      UPDATE expense_expenses
      SET amount       = v_amount,
          currency     = NEW.currency,
          expense_date = v_date,
          client_name  = NEW.client_name,
          title        = 'Doanh thu: ' || COALESCE(NEW.client_name, 'Invoice #' || NEW.invoice_number),
          notes        = 'Tự động từ Invoice #' || NEW.invoice_number,
          updated_at   = now()
      WHERE source_type = 'invoice' AND source_id = NEW.id;
    ELSE
      INSERT INTO expense_expenses (
        title, amount, currency, expense_date, category_id,
        client_name, vendor, status, type, source_type, source_id,
        created_by, notes
      ) VALUES (
        'Doanh thu: ' || COALESCE(NEW.client_name, 'Invoice #' || NEW.invoice_number),
        v_amount,
        NEW.currency,
        v_date,
        v_cat_id,
        NEW.client_name,
        '',
        'approved',
        'revenue',
        'invoice',
        NEW.id,
        'system',
        'Tự động từ Invoice #' || NEW.invoice_number || COALESCE(' | ' || NEW.client_name, '')
      );
    END IF;
  END IF;

  -- ── Invoice un-paid (status reverted from paid) ───────────
  IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    DELETE FROM expense_expenses
    WHERE source_type = 'invoice' AND source_id = NEW.id;
  END IF;

  -- ── Invoice still paid but amount changed ─────────────────
  IF NEW.status = 'paid' AND OLD.status = 'paid'
     AND (NEW.amount_received IS DISTINCT FROM OLD.amount_received
          OR NEW.items IS DISTINCT FROM OLD.items) THEN
    UPDATE expense_expenses
    SET amount     = v_amount,
        updated_at = now()
    WHERE source_type = 'invoice' AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_invoice_sync_revenue
  AFTER UPDATE ON invoice_invoices
  FOR EACH ROW
  EXECUTE FUNCTION trg_invoice_sync_revenue();

-- ── RPC: full sync / backfill (called from frontend button) ──
CREATE OR REPLACE FUNCTION public.sync_invoice_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_updated  integer := 0;
  v_inv      record;
  v_amount   numeric;
  v_date     date;
  v_cat_id   uuid := '868dbd1b-3187-43b5-a9dd-496191ac268a';
BEGIN
  FOR v_inv IN
    SELECT * FROM invoice_invoices WHERE status = 'paid'
  LOOP
    v_amount := CASE
      WHEN v_inv.amount_received IS NOT NULL AND v_inv.amount_received > 0 THEN v_inv.amount_received
      ELSE COALESCE((
        SELECT SUM((item->>'quantity')::numeric * (item->>'unitPrice')::numeric)
        FROM jsonb_array_elements(v_inv.items) item
      ), 0)
    END;

    v_date := COALESCE(v_inv.paid_date, v_inv.issue_date, CURRENT_DATE);

    IF EXISTS (SELECT 1 FROM expense_expenses WHERE source_type = 'invoice' AND source_id = v_inv.id) THEN
      UPDATE expense_expenses
      SET amount       = v_amount,
          currency     = v_inv.currency,
          expense_date = v_date,
          client_name  = v_inv.client_name,
          title        = 'Doanh thu: ' || COALESCE(v_inv.client_name, 'Invoice #' || v_inv.invoice_number),
          updated_at   = now()
      WHERE source_type = 'invoice' AND source_id = v_inv.id;
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO expense_expenses (
        title, amount, currency, expense_date, category_id,
        client_name, vendor, status, type, source_type, source_id,
        created_by, notes
      ) VALUES (
        'Doanh thu: ' || COALESCE(v_inv.client_name, 'Invoice #' || v_inv.invoice_number),
        v_amount,
        v_inv.currency,
        v_date,
        v_cat_id,
        v_inv.client_name,
        '',
        'approved',
        'revenue',
        'invoice',
        v_inv.id,
        'system',
        'Sync từ Invoice #' || v_inv.invoice_number || COALESCE(' | ' || v_inv.client_name, '')
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;
