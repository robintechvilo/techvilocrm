"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isManagerOrAbove } from "@/lib/auth"

const clientSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  company: z.string().trim().min(2, "Company must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  status: z.enum(["Lead", "Active", "Inactive"]).default("Lead"),
})

const statusSchema = z.enum(["Lead", "Active", "Inactive"])

async function assertCanModifyClient(clientId: string) {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return { error: "Unauthorized" as const }

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, created_by')
    .eq('id', clientId)
    .single()

  if (error || !client) return { error: "Client not found" as const }

  if (!isManagerOrAbove(role) && client.created_by !== user.id) {
    return { error: "You don't have permission to modify this client" as const }
  }

  return { supabase, user, role, client }
}

export async function addClient(formData: FormData) {
  try {
    const { supabase, user } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const validatedData = clientSchema.parse({
      name: formData.get("name"),
      company: formData.get("company"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      status: formData.get("status"),
    })

    const { error } = await supabase
      .from('clients')
      .insert({
        ...validatedData,
        email: validatedData.email || null,
        created_by: user.id,
      })

    if (error) throw error

    revalidatePath("/clients")
    revalidatePath("/clients/pipeline")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to add client:", error)
    return { success: false, error: error?.message || "Failed to add client" }
  }
}

export async function updateClientStatus(clientId: string, newStatus: string) {
  try {
    const validated = statusSchema.parse(newStatus)
    const guard = await assertCanModifyClient(clientId)
    if ("error" in guard) return { success: false, error: guard.error }

    const { error } = await guard.supabase
      .from('clients')
      .update({ status: validated })
      .eq('id', clientId)

    if (error) throw error

    revalidatePath("/clients")
    revalidatePath("/clients/pipeline")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update status:", error)
    return { success: false, error: error?.message || "Failed to update status" }
  }
}

export async function updateClient(clientId: string, formData: FormData) {
  try {
    const guard = await assertCanModifyClient(clientId)
    if ("error" in guard) return { success: false, error: guard.error }

    const validatedData = clientSchema.parse({
      name: formData.get("name"),
      company: formData.get("company"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      status: formData.get("status"),
    })

    const { error } = await guard.supabase
      .from('clients')
      .update({
        ...validatedData,
        email: validatedData.email || null,
      })
      .eq('id', clientId)

    if (error) throw error
    revalidatePath("/clients")
    revalidatePath("/clients/pipeline")
    revalidatePath(`/clients/${clientId}`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to update client" }
  }
}

export async function deleteClient(clientId: string) {
  try {
    const guard = await assertCanModifyClient(clientId)
    if ("error" in guard) return { success: false, error: guard.error }

    const { error } = await guard.supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (error) throw error
    revalidatePath("/clients")
    revalidatePath("/clients/pipeline")
    revalidatePath("/projects")
    revalidatePath("/payments")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to delete client" }
  }
}
