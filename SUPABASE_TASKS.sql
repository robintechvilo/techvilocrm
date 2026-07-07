-- ============================================================
-- TechVilo CRM — TASKS / WORK BOARD
-- ============================================================
-- HOW TO USE:
--   1. Run the previous SQL files first (MIGRATION → SECURITY_PATCH →
--      RECURRING_BILLING → AUDIT2_PATCH → INVOICES)
--   2. Supabase Dashboard → SQL Editor → paste THIS file → Run
--
-- This script is IDEMPOTENT — safe to run multiple times.
--
-- What it adds:
--   • tasks — Kanban work items (To Do / Doing / Done) with
--     multi-assignee, priority, due date, checklist & client link
--   • RLS:
--       - Admin/Manager see & manage everything
--       - Staff see tasks they created or are assigned to
--       - Staff may create tasks only for themselves
-- ============================================================


CREATE TABLE IF NOT EXISTS tasks (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,   -- null = internal task
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  assigned_to  UUID[] NOT NULL DEFAULT '{}',                     -- multi-assignee
  status       TEXT NOT NULL DEFAULT 'To Do',                    -- To Do | Doing | Done
  priority     TEXT NOT NULL DEFAULT 'Medium',                   -- Low | Medium | High | Urgent
  start_date   DATE,                                             -- which day the work is scheduled for
  due_date     DATE,                                             -- deadline (finish by)
  checklist    JSONB NOT NULL DEFAULT '[]'::jsonb,               -- [{text, done}]
  completed_at TIMESTAMPTZ,                                      -- set when moved to Done
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Safety for anyone who ran an earlier version of this file
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;

CREATE INDEX IF NOT EXISTS idx_tasks_client     ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dates      ON tasks(start_date, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees  ON tasks USING GIN (assigned_to);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- See a task if you created it, you're assigned to it, or you're a manager+
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR auth.uid() = ANY(assigned_to)
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

-- Managers assign anyone; Staff may only create tasks assigned to
-- themselves (or unassigned personal to-dos)
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
      OR assigned_to <@ ARRAY[auth.uid()]
    )
  );

-- Creator, assignees and managers may update (the app limits assignees
-- to status/checklist changes)
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR auth.uid() = ANY(assigned_to)
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR auth.uid() = ANY(assigned_to)
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

-- Only the creator or a manager+ may delete
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );


-- ============================================================
-- ✅ DONE
-- ============================================================
-- After running this the /tasks Kanban board is fully active.
-- ============================================================
