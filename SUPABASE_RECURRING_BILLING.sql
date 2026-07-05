-- ============================================================
-- TechVilo CRM — RECURRING MONTHLY BILLING (Phase C)
-- ============================================================
-- HOW TO USE:
--   1. Run SUPABASE_MIGRATION.sql and SUPABASE_SECURITY_PATCH.sql first
--   2. Supabase Dashboard → SQL Editor → paste THIS file → Run
--
-- This script is IDEMPOTENT — safe to run multiple times.
--
-- What it adds:
--   • invoices table — one bill per recurring project per month
--   • generate_monthly_invoices() — creates the current month's bills;
--     the app calls it automatically when the Payments page opens
--   • Waive support — write off a bill (client left without paying)
--     so dead dues stop inflating your outstanding numbers
--   • invoice_id links on ledgers/payments so installments reconcile
--   • One-time backfill that carries existing recurring dues into
--     this month's bill (no double counting)
--
-- Until this is run, the app silently falls back to the old
-- one-time-total flow. Nothing breaks.
-- ============================================================


-- ------------------------------------------------------------
-- 1. invoices table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,             -- first day of the billing month
  billing_month TEXT NOT NULL,             -- display label, e.g. "July 2026"
  amount        NUMERIC NOT NULL DEFAULT 0,
  paid_amount   NUMERIC NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'Due',  -- Due | Partial | Paid | Waived
  waive_reason  TEXT,
  due_date      DATE,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, period_start)        -- one bill per project per month
);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client  ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);

-- Link installments back to the bill they pay off
ALTER TABLE ledgers  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ledgers_invoice  ON ledgers(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);


-- ------------------------------------------------------------
-- 2. Row Level Security (same rules as ledgers/payments)
-- ------------------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

DROP POLICY IF EXISTS "invoices_write" ON invoices;
CREATE POLICY "invoices_write" ON invoices
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ------------------------------------------------------------
-- 3. ONE-TIME BACKFILL for existing recurring projects
-- ------------------------------------------------------------
-- Creates this month's bill for every active recurring project that
-- doesn't have one yet. If the project already carries an outstanding
-- due (old system), that due becomes this month's bill amount instead
-- of the monthly rate — so nothing is counted twice.
INSERT INTO invoices (project_id, client_id, period_start, billing_month, amount, due_date, created_by)
SELECT
  p.id,
  p.client_id,
  date_trunc('month', now())::date,
  trim(to_char(now(), 'FMMonth YYYY')),
  CASE WHEN COALESCE(p.due_amount, 0) > 0 THEN p.due_amount ELSE p.amount END,
  (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  p.created_by
FROM projects p
WHERE p.billing_type ILIKE 'Recurring%'
  AND p.status IN ('Active', 'In Progress')
ON CONFLICT (project_id, period_start) DO NOTHING;


-- ------------------------------------------------------------
-- 4. Monthly generation function
-- ------------------------------------------------------------
-- The app calls this (rpc) whenever the Payments page loads, so a new
-- month's bills appear automatically the first time anyone opens the
-- page that month. Paused/Cancelled/Completed projects are skipped.
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO invoices (project_id, client_id, period_start, billing_month, amount, due_date, created_by)
  SELECT
    p.id,
    p.client_id,
    date_trunc('month', now())::date,
    trim(to_char(now(), 'FMMonth YYYY')),
    p.amount,
    (date_trunc('month', now()) + interval '1 month - 1 day')::date,
    p.created_by
  FROM projects p
  WHERE p.billing_type ILIKE 'Recurring%'
    AND p.status IN ('Active', 'In Progress')
  ON CONFLICT (project_id, period_start) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices() TO authenticated;


-- ------------------------------------------------------------
-- 5. OPTIONAL — fully automatic generation on the 1st of each month
-- ------------------------------------------------------------
-- The lazy app-side call above is already enough. If you also want the
-- database to do it by itself (even if nobody opens the CRM), enable
-- the pg_cron extension (Database → Extensions → pg_cron) and then
-- uncomment:
--
-- SELECT cron.schedule(
--   'generate-monthly-invoices',
--   '5 0 1 * *',                 -- 00:05 on the 1st of every month
--   $$ SELECT public.generate_monthly_invoices(); $$
-- );


-- ============================================================
-- ✅ DONE
-- ============================================================
-- After running this:
--   • Every active recurring project gets one bill per month
--   • Payments page shows a "Monthly Bills" section per client
--   • A bill can be Waived (written off) when a client leaves unpaid
--   • Projects can be Paused / Cancelled — billing stops immediately
-- ============================================================
