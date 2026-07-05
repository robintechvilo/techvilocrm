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
    if (v.paidAmount > totalBdt) {
      return { success: false, error: `Paid amount exceeds the total. Max: ৳${totalBdt.toLocaleString()}` }
    }
    const dueAmount = Math.max(0, totalBdt - v.paidAmount)

    const { data: created, error } = await guard.supabase.from('ad_support').insert({
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
    }).select('id').single()

    if (error) throw error

    // Money collected at entry time also goes into the installment history
    // (best-effort — skipped silently if the table hasn't been migrated yet)
    if (created && v.paidAmount > 0) {
      await guard.supabase.from('ad_support_payments').insert({
        ad_support_id: created.id,
        amount: v.paidAmount,
        method: 'Recorded at entry',
        date: v.date,
        created_by: guard.user.id,
      })
    }

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

    // When the collections table exists, paid is DERIVED from the
    // installment history — editing the record can no longer distort the
    // totals. Falls back to the submitted value pre-migration.
    let paidAmount = v.paidAmount
    const { data: collections, error: collErr } = await guard.supabase
      .from('ad_support_payments')
      .select('amount')
      .eq('ad_support_id', id)
    if (!collErr && collections) {
      paidAmount = collections.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0)
    }

    if (paidAmount > totalBdt) {
      return {
        success: false,
        error: `Already collected ৳${paidAmount.toLocaleString()} — the new total (৳${totalBdt.toLocaleString()}) can't be lower than that`,
      }
    }
    const dueAmount = Math.max(0, totalBdt - paidAmount)

    const { error } = await guard.supabase.from('ad_support').update({
      client_id: v.clientId,
      dollar_amount: v.dollarAmount,
      rate: v.rate,
      total_bdt: totalBdt,
      paid_amount: paidAmount,
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

const adCollectionSchema = z.object({
  adSupportId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.string().trim().min(1, "Payment method is required"),
  date: z.string().trim().min(1, "Date is required"),
  note: z.string().trim().optional(),
})

// Recompute a record's paid/due from its installment history.
async function recalcAdSupport(supabase: any, adSupportId: string) {
  const { data: record } = await supabase
    .from('ad_support')
    .select('*')
    .eq('id', adSupportId)
    .single()
  if (!record) return

  const { data: rows, error } = await supabase
    .from('ad_support_payments')
    .select('amount')
    .eq('ad_support_id', adSupportId)
  if (error) return // collections table not migrated yet

  const paid = (rows || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
  await supabase.from('ad_support').update({
    paid_amount: paid,
    due_amount: Math.max(0, (Number(record.total_bdt) || 0) - paid),
  }).eq('id', adSupportId)
}

// Collect an installment against an ad support record — with history,
// method, and overpay protection.
export async function collectAdSupportPayment(formData: FormData) {
  try {
    const guard = await assertCanWriteAdSupport()
    if ("error" in guard) return { success: false, error: guard.error }

    const v = adCollectionSchema.parse({
      adSupportId: formData.get("adSupportId"),
      amount: formData.get("amount"),
      method: formData.get("method"),
      date: formData.get("date"),
      note: formData.get("note") || "",
    })

    const { data: record } = await guard.supabase
      .from('ad_support')
      .select('*')
      .eq('id', v.adSupportId)
      .single()
    if (!record) return { success: false, error: "Record not found" }

    const remaining = Math.max(0, (Number(record.total_bdt) || 0) - (Number(record.paid_amount) || 0))
    if (remaining <= 0) return { success: false, error: "This record is already fully collected" }
    if (v.amount > remaining) {
      return { success: false, error: `Amount exceeds remaining due. Max: ৳${remaining.toLocaleString()}` }
    }

    const { error } = await guard.supabase.from('ad_support_payments').insert({
      ad_support_id: v.adSupportId,
      amount: v.amount,
      method: v.method,
      date: v.date,
      note: v.note || null,
      created_by: guard.user.id,
    })
    if (error) {
      if (error.code === '42P01') {
        return { success: false, error: "Collections table missing — run SUPABASE_AUDIT2_PATCH.sql first" }
      }
      throw error
    }

    await recalcAdSupport(guard.supabase, v.adSupportId)

    revalidatePath("/ad-support")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to collect ad support payment:", error)
    return { success: false, error: error?.message || "Failed to collect payment" }
  }
}

// Remove a wrongly-entered installment; totals re-derive automatically.
export async function deleteAdSupportCollection(collectionId: string) {
  try {
    const guard = await assertCanWriteAdSupport()
    if ("error" in guard) return { success: false, error: guard.error }

    const { data: row } = await guard.supabase
      .from('ad_support_payments')
      .select('*')
      .eq('id', collectionId)
      .single()
    if (!row) return { success: false, error: "Collection entry not found" }

    const { error } = await guard.supabase
      .from('ad_support_payments')
      .delete()
      .eq('id', collectionId)
    if (error) throw error

    await recalcAdSupport(guard.supabase, row.ad_support_id)

    revalidatePath("/ad-support")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete collection entry:", error)
    return { success: false, error: error?.message || "Failed to delete collection entry" }
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
