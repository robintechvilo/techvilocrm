-- ============================================================
-- TechVilo CRM — INVOICES & PROPOSALS (Phase 1: Invoices)
-- ============================================================
-- HOW TO USE:
--   1. Run the previous SQL files first (MIGRATION → SECURITY_PATCH →
--      RECURRING_BILLING → AUDIT2_PATCH)
--   2. Supabase Dashboard → SQL Editor → paste THIS file → Run
--
-- This script is IDEMPOTENT — safe to run multiple times.
--
-- What it adds:
--   • client_invoices — the invoice documents (manual + auto from payments)
--   • company_settings — your "Billed By" block + bank details, editable
--     from Team Settings so you never retype them
--   • profiles.can_create_invoices — per-staff invoice access toggle
--     (Admin/Manager always have access)
-- ============================================================


-- ------------------------------------------------------------
-- 1. Per-staff invoice permission
-- ------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_create_invoices BOOLEAN NOT NULL DEFAULT false;

-- Helper: may this user work with invoices?
CREATE OR REPLACE FUNCTION public.user_can_invoice(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role IN ('Admin','Manager') OR can_create_invoices
     FROM profiles WHERE id = uid),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_invoice(UUID) TO authenticated;


-- ------------------------------------------------------------
-- 2. Company settings (single row) — the "Billed By" block
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name          TEXT NOT NULL DEFAULT 'Techvilo Ltd',
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  logo_url      TEXT DEFAULT '/logo.png',
  bank_details  TEXT,      -- goes into "Additional Notes" by default
  default_terms TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed with the details from your current invoice template (editable later)
INSERT INTO company_settings (id, name, address, phone, bank_details)
VALUES (
  1,
  'Techvilo Ltd',
  E'Flat 3, Prince George House 5 Upper George Street\nLuton LU1 2QX,\nUnited Kingdom (UK)',
  '+44 7412 995940',
  E'BUSINESS ACCOUNT\nTECHVILO LTD\nSort Code: 30-54-66\nAccount Number: 54359560\nIBAN: GB70LOYD30546654359560\nBIC: LOYDGB21F95'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
CREATE POLICY "company_settings_select" ON company_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "company_settings_write" ON company_settings;
CREATE POLICY "company_settings_write" ON company_settings
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'Admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'Admin');


-- ------------------------------------------------------------
-- 3. Invoice documents
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_invoices (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_no   TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  -- Snapshot of the "Billed To" block, so the invoice stays intact even
  -- if the client is later edited or deleted
  billed_to    JSONB NOT NULL DEFAULT '{}'::jsonb,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE,
  currency     TEXT NOT NULL DEFAULT 'BDT',   -- BDT | USD | EUR | GBP
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  total        NUMERIC NOT NULL DEFAULT 0,
  notes        TEXT,                          -- bank details / additional notes
  terms        TEXT,
  status       TEXT NOT NULL DEFAULT 'Draft', -- Draft | Sent | Paid | Cancelled
  source       TEXT NOT NULL DEFAULT 'manual',-- manual | auto
  ledger_id    UUID REFERENCES ledgers(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cinv_client     ON client_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_cinv_created_by ON client_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_cinv_status     ON client_invoices(status);

ALTER TABLE client_invoices ENABLE ROW LEVEL SECURITY;

-- Staff (with access) see their own invoices; managers see everything
DROP POLICY IF EXISTS "cinv_select" ON client_invoices;
CREATE POLICY "cinv_select" ON client_invoices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

DROP POLICY IF EXISTS "cinv_insert" ON client_invoices;
CREATE POLICY "cinv_insert" ON client_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_can_invoice(auth.uid())
  );

DROP POLICY IF EXISTS "cinv_update" ON client_invoices;
CREATE POLICY "cinv_update" ON client_invoices
  FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND public.user_can_invoice(auth.uid()))
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

DROP POLICY IF EXISTS "cinv_delete" ON client_invoices;
CREATE POLICY "cinv_delete" ON client_invoices
  FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid() AND public.user_can_invoice(auth.uid()))
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ============================================================
-- ✅ DONE
-- ============================================================
-- After running this:
--   • /invoices page works (list, builder, PDF print view)
--   • Payments auto-create a "Paid" invoice for each collection
--   • Team Settings → toggle invoice access per staff member
--   • Team Settings → edit your Billed By details & bank info
-- ============================================================
