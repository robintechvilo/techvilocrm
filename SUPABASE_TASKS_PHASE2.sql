-- ============================================================
-- TechVilo CRM — TASKS PHASE 2: COMMENT THREADS
-- ============================================================
-- HOW TO USE:
--   1. Run SUPABASE_TASKS.sql first
--   2. Supabase Dashboard → SQL Editor → paste THIS file → Run
--
-- This script is IDEMPOTENT — safe to run multiple times.
--
-- Adds task_comments — Asana-style discussion under each task.
-- Visibility follows the task itself: whoever can see the task
-- (creator, assignees, managers) can read & write comments.
-- ============================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task    ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author  ON task_comments(created_by);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Read a comment if you can see its task
DROP POLICY IF EXISTS "task_comments_select" ON task_comments;
CREATE POLICY "task_comments_select" ON task_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
        AND (
          t.created_by = auth.uid()
          OR auth.uid() = ANY(t.assigned_to)
          OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
        )
    )
  );

-- Comment as yourself, on tasks you can see
DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
CREATE POLICY "task_comments_insert" ON task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
        AND (
          t.created_by = auth.uid()
          OR auth.uid() = ANY(t.assigned_to)
          OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
        )
    )
  );

-- Delete your own comment; managers can moderate
DROP POLICY IF EXISTS "task_comments_delete" ON task_comments;
CREATE POLICY "task_comments_delete" ON task_comments
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('Admin', 'Manager')
  );

-- ============================================================
-- ✅ DONE
-- ============================================================
