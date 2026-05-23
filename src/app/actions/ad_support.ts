"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isManagerOrAbove } from "@/lib/auth"

const adSupportSchema = z.object({
  clientId: z.string().uuid("Invalid client selection"),
  dollarAmount: z.coerce.number().positive("Amount must be greater than 0"),
  rate: z.coerce.number().positive("Rate must be greater than 0"),
  paidAmount: z.coerce.number().min(0).default(0),
  description: z.string().trim().optional(),
  date: z.string().trim().min(1, "Date is required"),
  nextPaymentDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
})

async function assertCanWriteAdSupport() {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return { error: "Unauthorized" as const }
  if (!isManagerOrAbove(role)) {
    return { error: "Only Admin and Manager can manage ad support" as const }
  }
  return { supabase, user, role }
}

function parseAdSupport(formData: FormData) {
  return adSupportSchema.parse({
    clientId: formData.get("clientId"),
    dollarAmount: formData.get("dollarAmount"),
    rate: formData.get("rate"),
    paidAmount: formData.get("paidAmount") || 0,
    description: formData.get("description") || "",
    date: formData.get("date"),
    nextPaymentDate: formData.get("nextPaymentDate") || null,
  })
}

export async function recordAdSupport(formData: FormData) {
  try {
    const guard = await assertCanWriteAdSupport()
    if ("error" in guard) return { success: false, error: guard.error }

    const v = parseAdSupport(formData)

    const totalBdt = v.dollarAmount * v.rate
    const dueAmount = Math.max(0, totalBdt - v.paidAmount)

    const { error } = await guard.supabase.from('ad_support').insert({
      client_id: v.clientId,
      dollar_amount: v.dollarAmount,
      rate: v.rate,
      total_bdt: totalBdt,
      paid_amount: v.paidAmount,
      due_amount: dueAmount,
      next_payment_date: v.nextPaymentDate,
      description: v.description || null,
      date: v.date,
      created_by: guard.user.id,
    })

    if (error) throw error

    revalidatePath("/ad-support")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to record ad support:", error)
    return { success: false, error: error?.message || "Failed to record ad support" }
  }
}

export async function updateAdSupport(id: string, formData: FormData) {
  try {
    const guard = await assertCanWriteAdSupport()
    if ("error" in guard) return { success: false, error: guard.error }

    const v = parseAdSupport(formData)

    const totalBdt = v.dollarAmount * v.rate
    const dueAmount = Math.max(0, totalBdt - v.paidAmount)

    const { error } = await guard.supabase.from('ad_support').update({
      client_id: v.clientId,
      dollar_amount: v.dollarAmount,
      rate: v.rate,
      total_bdt: totalBdt,
      paid_amount: v.paidAmount,
      due_amount: dueAmount,
      next_payment_date: v.nextPaymentDate,
      description: v.description || null,
      date: v.date,
    }).eq('id', id)

    if (error) throw error

    revalidatePath("/ad-support")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update ad support:", error)
    return { success: false, error: error?.message || "Failed to update ad support" }
  }
}

export async function deleteAdSupport(id: string) {
  try {
    const guard = await assertCanWriteAdSupport()
    if ("error" in guard) return { success: false, error: guard.error }

    const { error } = await guard.supabase.from('ad_support').delete().eq('id', id)
    if (error) throw error

    revalidatePath("/ad-support")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete ad support:", error)
    return { success: false, error: error?.message || "Failed to delete ad support" }
  }
}
