-- ============================================================
-- TechVilo CRM — AUDIT #2 PATCH
-- ============================================================
-- HOW TO USE:
--   1. Run the previous three SQL files first:
--      SUPABASE_MIGRATION.sql → SUPABASE_SECURITY_PATCH.sql →
--      SUPABASE_RECURRING_BILLING.sql
--   2. Supabase Dashboard → SQL Editor → paste THIS file → Run
--
-- This script is IDEMPOTENT — safe to run multiple times.
--
-- What it fixes/adds:
--   • D6: generate_monthly_invoices() now also refreshes each
--         project's due_amount, so the dashboard "Outstanding Due"
--         is correct the moment a new month's bills are created
--   • E1: ad_support_payments — installment history for Ad Support
--         (who collected how much, when, by which method), plus a
--         backfill so existing paid amounts keep their totals
-- ============================================================


-- ------------------------------------------------------------
-- 1. (D6) Regenerate bills AND refresh project dues
-- ------------------------------------------------------------
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

  -- Refresh the derived due on every recurring project so KPIs update
  -- immediately when a new month's bills open (audit #2 finding D6).
  UPDATE projects p
  SET due_amount = COALESCE(sub.due, 0)
  FROM (
    SELECT i.project_id,
           SUM(GREATEST((i.amount - i.paid_amount), 0)) AS due
    FROM invoices i
    WHERE i.status <> 'Waived'
    GROUP BY i.project_id
  ) sub
  WHERE p.id = sub.project_id
    AND p.billing_type ILIKE 'Recurring%'
    AND p.due_amount IS DISTINCT FROM COALESCE(sub.due, 0);

  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices() TO authenticated;


-- ------------------------------------------------------------
-- 2. (E1) Ad Support installment history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_support_payments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_support_id UUID NOT NULL REFERENCES ad_support(id) ON DELETE CASCADE,
  amount        NUMERIC NOT NULL,
  method        TEXT,
  date          DATE NOT NULL,
  note          TEXT,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asp_ad_support ON ad_support_payments(ad_support_id);
CREATE INDEX IF NOT EXISTS idx_asp_created_by ON ad_support_payments(created_by);

ALTER TABLE ad_support_payments ENABLE ROW LEVEL SECURITY;

-- Reads follow ad_support (open to all authenticated users — Staff can
-- see the section); writes are Admin/Manager only, matching the app.
DROP POLICY IF EXISTS "asp_select" ON ad_support_payments;
CREATE POLICY "asp_select" ON ad_support_payments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "asp_write" ON ad_support_payments;
CREATE POLICY "asp_write" ON ad_support_payments
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('Admin', 'Manager'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('Admin', 'Manager'));


-- ------------------------------------------------------------
-- 3. (E1) One-time backfill
-- ------------------------------------------------------------
-- Existing records that already have a paid amount get one synthetic
-- installment so history starts consistent. Runs only once per record.
INSERT INTO ad_support_payments (ad_support_id, amount, method, date, note, created_by)
SELECT
  a.id,
  a.paid_amount,
  'Unknown',
  COALESCE(a.date::date, CURRENT_DATE),
  'Backfilled from previously recorded paid amount',
  a.created_by
FROM ad_support a
WHERE COALESCE(a.paid_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM ad_support_payments x WHERE x.ad_support_id = a.id
  );


-- ============================================================
-- ✅ DONE
-- ============================================================
