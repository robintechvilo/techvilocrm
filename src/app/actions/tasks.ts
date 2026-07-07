"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isManagerOrAbove, type Role } from "@/lib/auth"

const checklistSchema = z.array(
  z.object({
    text: z.string().trim().min(1),
    done: z.boolean().default(false),
  }),
)

const taskSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters"),
  description: z.string().trim().optional(),
  clientId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  // Arrives as JSON strings from the editor
  assignedTo: z
    .string()
    .transform((s, ctx) => {
      try { return JSON.parse(s) } catch { ctx.addIssue({ code: "custom", message: "Invalid assignees" }); return z.NEVER }
    })
    .pipe(z.array(z.string().uuid())),
  checklist: z
    .string()
    .transform((s, ctx) => {
      try { return JSON.parse(s) } catch { ctx.addIssue({ code: "custom", message: "Invalid checklist" }); return z.NEVER }
    })
    .pipe(checklistSchema),
  status: z.enum(["To Do", "Doing", "Done"]).default("To Do"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  startDate: z.string().optional().nullable().transform((v) => (v ? v : null)),
  dueDate: z.string().optional().nullable().transform((v) => (v ? v : null)),
}).refine(
  (d) => !d.startDate || !d.dueDate || d.dueDate >= d.startDate,
  { message: "Due date can't be before the start date", path: ["dueDate"] },
)

const statusSchema = z.enum(["To Do", "Doing", "Done"])

function parseTaskForm(formData: FormData) {
  return taskSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    clientId: formData.get("clientId") || null,
    projectId: formData.get("projectId") || null,
    assignedTo: formData.get("assignedTo") || "[]",
    checklist: formData.get("checklist") || "[]",
    status: formData.get("status") || "To Do",
    priority: formData.get("priority") || "Medium",
    startDate: formData.get("startDate") || null,
    dueDate: formData.get("dueDate") || null,
  })
}

// Who may touch this task at all (status/checklist level)
function canWork(task: any, userId: string, role: Role | null) {
  return (
    isManagerOrAbove(role) ||
    task.created_by === userId ||
    (task.assigned_to || []).includes(userId)
  )
}

// Who may edit everything / delete
function canManage(task: any, userId: string, role: Role | null) {
  return isManagerOrAbove(role) || task.created_by === userId
}

export async function createTask(formData: FormData) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const v = parseTaskForm(formData)

    // Staff may only assign themselves (or leave unassigned)
    if (!isManagerOrAbove(role) && v.assignedTo.some((id) => id !== user.id)) {
      return { success: false, error: "Staff can only assign tasks to themselves" }
    }

    const { error } = await supabase.from("tasks").insert({
      title: v.title,
      description: v.description || null,
      client_id: v.clientId || null,
      project_id: v.projectId || null,
      assigned_to: v.assignedTo,
      status: v.status,
      priority: v.priority,
      start_date: v.startDate,
      due_date: v.dueDate,
      checklist: v.checklist,
      completed_at: v.status === "Done" ? new Date().toISOString() : null,
      created_by: user.id,
    })
    if (error) {
      if (error.code === "42P01") {
        return { success: false, error: "Tasks table missing — run SUPABASE_TASKS.sql first" }
      }
      throw error
    }

    revalidatePath("/tasks")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to create task:", error)
    return { success: false, error: error?.message || "Failed to create task" }
  }
}

export async function updateTask(taskId: string, formData: FormData) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single()
    if (!task) return { success: false, error: "Task not found" }
    if (!canManage(task, user.id, role)) {
      return { success: false, error: "Only the creator or a manager can edit task details" }
    }

    const v = parseTaskForm(formData)

    if (!isManagerOrAbove(role) && v.assignedTo.some((id) => id !== user.id)) {
      return { success: false, error: "Staff can only assign tasks to themselves" }
    }

    const { error } = await supabase.from("tasks").update({
      title: v.title,
      description: v.description || null,
      client_id: v.clientId || null,
      project_id: v.projectId || null,
      assigned_to: v.assignedTo,
      status: v.status,
      priority: v.priority,
      start_date: v.startDate,
      due_date: v.dueDate,
      checklist: v.checklist,
      completed_at:
        v.status === "Done"
          ? (task.completed_at || new Date().toISOString())
          : null,
      updated_at: new Date().toISOString(),
    }).eq("id", taskId)
    if (error) throw error

    revalidatePath("/tasks")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update task:", error)
    return { success: false, error: error?.message || "Failed to update task" }
  }
}

// Quick move between board columns — allowed for assignees too
export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const validated = statusSchema.parse(status)
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single()
    if (!task) return { success: false, error: "Task not found" }
    if (!canWork(task, user.id, role)) {
      return { success: false, error: "This task is not assigned to you" }
    }

    const { error } = await supabase.from("tasks").update({
      status: validated,
      completed_at:
        validated === "Done"
          ? (task.completed_at || new Date().toISOString())
          : null,
      updated_at: new Date().toISOString(),
    }).eq("id", taskId)
    if (error) throw error

    revalidatePath("/tasks")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to move task:", error)
    return { success: false, error: error?.message || "Failed to move task" }
  }
}

// Tick/untick checklist items — allowed for assignees too
export async function updateTaskChecklist(taskId: string, checklistJson: string) {
  try {
    const checklist = checklistSchema.parse(JSON.parse(checklistJson))
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single()
    if (!task) return { success: false, error: "Task not found" }
    if (!canWork(task, user.id, role)) {
      return { success: false, error: "This task is not assigned to you" }
    }

    const { error } = await supabase.from("tasks").update({
      checklist,
      updated_at: new Date().toISOString(),
    }).eq("id", taskId)
    if (error) throw error

    revalidatePath("/tasks")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update checklist:", error)
    return { success: false, error: error?.message || "Failed to update checklist" }
  }
}

export async function deleteTask(taskId: string) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single()
    if (!task) return { success: false, error: "Task not found" }
    if (!canManage(task, user.id, role)) {
      return { success: false, error: "Only the creator or a manager can delete a task" }
    }

    const { error } = await supabase.from("tasks").delete().eq("id", taskId)
    if (error) throw error

    revalidatePath("/tasks")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete task:", error)
    return { success: false, error: error?.message || "Failed to delete task" }
  }
}
