-- ============================================================
-- TechVilo CRM — Schema Fixes, Cascade & Security (RLS)
-- ============================================================
-- HOW TO USE:
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste THIS ENTIRE file
--   3. Click "Run"
--
-- This script is IDEMPOTENT — safe to run multiple times.
-- It will:
--   • Add ledger_id to payments table (fixes delete bug)
--   • Add ON DELETE CASCADE on foreign keys (no orphan rows)
--   • Backfill ledger_id for existing payments
--   • Enable Row Level Security (RLS) on all tables
--   • Create role-based policies (Admin / Manager / Staff)
--   • Create an audit_log table for change tracking
-- ============================================================


-- ============================================================
-- 1. SCHEMA FIXES — payments.ledger_id + CASCADE deletes
-- ============================================================

-- Add ledger_id column to payments (fixes deletePayment soft-match bug)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS ledger_id UUID;

-- Backfill ledger_id for existing payment rows (best-effort match)
UPDATE payments p
SET ledger_id = sub.ledger_id
FROM (
  SELECT DISTINCT ON (p2.id)
    p2.id AS payment_id,
    l.id AS ledger_id
  FROM payments p2
  JOIN ledgers l
    ON l.project_id = p2.project_id
   AND l.paid_amount = p2.amount
   AND l.pay_date    = p2.date
  ORDER BY p2.id, l.created_at DESC
) sub
WHERE p.id = sub.payment_id
  AND p.ledger_id IS NULL;

-- Now bind the FK with CASCADE
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_ledger_id_fkey;
ALTER TABLE payments
  ADD CONSTRAINT payments_ledger_id_fkey
  FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payments_ledger_id ON payments(ledger_id);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_project_id ON ledgers(project_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_client_id ON ledgers(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_support_client_id ON ad_support(client_id);

-- Cascade other foreign keys (clean up orphans when parent deleted)
ALTER TABLE ledgers DROP CONSTRAINT IF EXISTS ledgers_project_id_fkey;
ALTER TABLE ledgers
  ADD CONSTRAINT ledgers_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE ledgers DROP CONSTRAINT IF EXISTS ledgers_client_id_fkey;
ALTER TABLE ledgers
  ADD CONSTRAINT ledgers_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_project_id_fkey;
ALTER TABLE payments
  ADD CONSTRAINT payments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_client_id_fkey;
ALTER TABLE projects
  ADD CONSTRAINT projects_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE ad_support DROP CONSTRAINT IF EXISTS ad_support_client_id_fkey;
ALTER TABLE ad_support
  ADD CONSTRAINT ad_support_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;


-- ============================================================
-- 2. HELPER FUNCTION — read role without RLS recursion
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = uid;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;


-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_support  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. POLICIES — PROFILES
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_all"     ON profiles;
DROP POLICY IF EXISTS "profiles_admin_write"    ON profiles;
DROP POLICY IF EXISTS "profiles_self_update"    ON profiles;

-- Everyone authenticated can read profiles (needed for "Owner" name lookup)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Admin can do anything
CREATE POLICY "profiles_admin_write" ON profiles
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'Admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'Admin');

-- Users can update their OWN profile (name, avatar) — role/email unchanged on app side
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ============================================================
-- 5. POLICIES — CLIENTS
-- ============================================================

DROP POLICY IF EXISTS "clients_select"  ON clients;
DROP POLICY IF EXISTS "clients_insert"  ON clients;
DROP POLICY IF EXISTS "clients_update"  ON clients;
DROP POLICY IF EXISTS "clients_delete"  ON clients;

CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clients_insert" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "clients_update" ON clients
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

CREATE POLICY "clients_delete" ON clients
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ============================================================
-- 6. POLICIES — PROJECTS
-- ============================================================

DROP POLICY IF EXISTS "projects_select"  ON projects;
DROP POLICY IF EXISTS "projects_insert"  ON projects;
DROP POLICY IF EXISTS "projects_update"  ON projects;
DROP POLICY IF EXISTS "projects_delete"  ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

CREATE POLICY "projects_delete" ON projects
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ============================================================
-- 7. POLICIES — LEDGERS
-- ============================================================

DROP POLICY IF EXISTS "ledgers_select" ON ledgers;
DROP POLICY IF EXISTS "ledgers_write"  ON ledgers;

CREATE POLICY "ledgers_select" ON ledgers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ledgers_write" ON ledgers
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ============================================================
-- 8. POLICIES — PAYMENTS
-- ============================================================

DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_write"  ON payments;

CREATE POLICY "payments_select" ON payments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "payments_write" ON payments
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ============================================================
-- 9. POLICIES — EXPENSES (Admin + Manager only)
-- ============================================================

DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_write"  ON expenses;

CREATE POLICY "expenses_select" ON expenses
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('Admin', 'Manager'));

CREATE POLICY "expenses_write" ON expenses
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('Admin', 'Manager'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('Admin', 'Manager'));


-- ============================================================
-- 10. POLICIES — AD SUPPORT
-- ============================================================

DROP POLICY IF EXISTS "ad_support_select" ON ad_support;
DROP POLICY IF EXISTS "ad_support_write"  ON ad_support;

CREATE POLICY "ad_support_select" ON ad_support
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "ad_support_write" ON ad_support
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ============================================================
-- 11. AUDIT LOG (optional, for change tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  table_name  TEXT NOT NULL,
  record_id   UUID,
  action      TEXT NOT NULL,         -- INSERT / UPDATE / DELETE
  changes     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table  ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_date   ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_read"  ON audit_log;
DROP POLICY IF EXISTS "audit_log_user_insert" ON audit_log;

CREATE POLICY "audit_log_admin_read" ON audit_log
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'Admin');

CREATE POLICY "audit_log_user_insert" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- ✅ DONE
-- ============================================================
-- After running this:
--   • RLS is now enforcing role + ownership at the database
--   • Project deletes auto-clean ledgers and payments
--   • Client deletes auto-clean projects, ledgers, payments, ad_support
--   • payments.ledger_id now reliably links each payment to its ledger
-- ============================================================
