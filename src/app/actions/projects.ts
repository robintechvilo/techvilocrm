"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isManagerOrAbove } from "@/lib/auth"
import { isRecurring, recalcProjectTotals } from "@/lib/billing-helpers"

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters"),
  client_id: z.string().uuid("Invalid client selection"),
  service: z.string().trim().min(1, "Service type is required"),
  // Paused = billing temporarily stops (client on hold)
  // Cancelled = project ended abruptly; no more monthly bills
  status: z.enum(["Active", "In Progress", "Completed", "Paused", "Cancelled"]).default("Active"),
  billing_type: z.string().trim().min(1, "Billing type is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  next_payment_date: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
})

async function assertCanModifyProject(projectId: string) {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return { error: "Unauthorized" as const }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error || !project) return { error: "Project not found" as const }

  if (!isManagerOrAbove(role) && project.created_by !== user.id) {
    return { error: "You don't have permission to modify this project" as const }
  }

  return { supabase, user, role, project }
}

function readProjectFormData(formData: FormData) {
  let service = formData.get("service") as string
  if (service === "Custom") {
    service = formData.get("customService") as string
  }
  return {
    name: formData.get("projectName"),
    client_id: formData.get("client"),
    service,
    status: formData.get("status") || "Active",
    billing_type: formData.get("billing"),
    amount: formData.get("total"),
    next_payment_date: formData.get("nextDate") || null,
  }
}

export async function addProject(formData: FormData) {
  try {
    const { supabase, user } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const validatedData = projectSchema.parse(readProjectFormData(formData))

    const { data: created, error } = await supabase
      .from('projects')
      .insert({
        ...validatedData,
        paid_amount: 0,
        due_amount: validatedData.amount,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) throw error

    // Recurring project → open its first monthly bill right away, so it can
    // be collected from the Payments page without waiting for generation.
    // Best-effort: if the billing migration hasn't been run, skip silently
    // (the legacy flow still works, project due stays = amount either way).
    if (created && isRecurring(validatedData.billing_type) &&
        (validatedData.status === "Active" || validatedData.status === "In Progress")) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      await supabase.from('invoices').insert({
        project_id: created.id,
        client_id: validatedData.client_id,
        period_start: iso(start),
        billing_month: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        amount: validatedData.amount,
        due_date: iso(end),
        created_by: user.id,
      })
    }

    revalidatePath("/projects")
    revalidatePath("/payments")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to add project:", error)
    return { success: false, error: error?.message || "Failed to add project" }
  }
}

export async function updateProject(projectId: string, formData: FormData) {
  try {
    const guard = await assertCanModifyProject(projectId)
    if ("error" in guard) return { success: false, error: guard.error }

    const validatedData = projectSchema.parse(readProjectFormData(formData))

    const { error } = await guard.supabase
      .from('projects')
      .update(validatedData)
      .eq('id', projectId)

    if (error) throw error

    // Re-derive paid/due from ledgers + bills (for recurring, due is the sum
    // of unpaid non-waived monthly bills; for one-time, amount − paid).
    await recalcProjectTotals(guard.supabase, projectId)

    revalidatePath("/projects")
    revalidatePath("/payments")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to update project" }
  }
}

export async function deleteProject(projectId: string) {
  try {
    const guard = await assertCanModifyProject(projectId)
    if ("error" in guard) return { success: false, error: guard.error }

    const { error } = await guard.supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) throw error
    revalidatePath("/projects")
    revalidatePath("/payments")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to delete project" }
  }
}
