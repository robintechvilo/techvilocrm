-- ============================================================
-- TechVilo CRM — SECURITY PATCH (run AFTER SUPABASE_MIGRATION.sql)
-- ============================================================
-- HOW TO USE:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Paste THIS ENTIRE file → Run
--
-- This script is IDEMPOTENT — safe to run multiple times.
-- It fixes the audit findings:
--   • #1 Privilege escalation: a Staff/Manager can no longer make
--        themselves Admin by editing their own profile row directly.
--   • #2 Finance data leak: Staff can no longer read every client's
--        ledgers/payments at the database level ("no global finance").
--   • Adds created_by indexes used by the ownership checks.
--
-- NOTE: leaked-password protection (#4) is a Dashboard toggle, not SQL.
--   Enable it at: Authentication → Policies → "Leaked password protection".
-- ============================================================


-- ------------------------------------------------------------
-- 0. Ensure the role helper exists (also created by the main migration)
-- ------------------------------------------------------------
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
-- 1. FIX #1 — Prevent self privilege-escalation on profiles
-- ============================================================
-- The RLS policy "profiles_self_update" lets a user update their own
-- row (needed for changing their name). But without this guard they
-- could also set role='Admin' or change email via the raw REST API.
-- This BEFORE UPDATE trigger blocks any role/email change unless the
-- actor is an Admin.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins (acting through the app with their own session) may change anything.
  IF public.get_user_role(auth.uid()) = 'Admin' THEN
    RETURN NEW;
  END IF;

  -- Everyone else: role and email are immutable.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not allowed to change email';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_priv_esc ON profiles;
CREATE TRIGGER trg_prevent_profile_priv_esc
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();


-- ============================================================
-- 2. FIX #2 — Scope financial reads (ledgers / payments)
-- ============================================================
-- Staff role is meant to have "no global finance visibility".
-- Restrict SELECT on the money tables to the row owner or a manager.
-- (expenses is already Admin/Manager-only in the main migration.)

DROP POLICY IF EXISTS "ledgers_select" ON ledgers;
CREATE POLICY "ledgers_select" ON ledgers
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

-- clients / projects SELECT stay open (the UI intentionally shows Staff
-- the full contact & project list read-only). ad_support SELECT is left
-- open too; tighten it the same way if Staff should not see it.


-- ============================================================
-- 3. Indexes for the ownership checks
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_created_by    ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_by   ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_ledgers_created_by    ON ledgers(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_created_by   ON payments(created_by);
CREATE INDEX IF NOT EXISTS idx_ad_support_created_by ON ad_support(created_by);


-- ============================================================
-- ✅ DONE
-- ============================================================
-- Verify quickly (run as a Staff user's JWT in the API, or check policies):
--   SELECT * FROM pg_policies WHERE tablename IN ('ledgers','payments');
-- ============================================================
