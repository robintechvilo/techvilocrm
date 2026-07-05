"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isManagerOrAbove } from "@/lib/auth"
import { recalcProjectTotals } from "@/lib/billing-helpers"
import { autoCreateInvoiceForPayment } from "@/lib/invoice-auto"

const invoicePaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.string().trim().min(1, "Payment method is required"),
  payDate: z.string().trim().min(1, "Payment date is required"),
})

const waiveSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(3, "Please give a short reason (e.g. client left, discount)"),
})

// Lazily generate the current month's bills for all active recurring
// projects. Called from the Payments page on load — the first visit of a
// new month creates that month's bills. Silently no-ops if the billing
// migration hasn't been run yet.
export async function ensureMonthlyInvoices() {
  try {
    const { supabase, user } = await getAuthContext()
    if (!user) return { success: false }
    const { error } = await supabase.rpc("generate_monthly_invoices")
    return { success: !error }
  } catch {
    return { success: false }
  }
}

// Record an installment against a monthly bill. Also writes the normal
// ledger + payment-log rows so history, monthly reports and CSV exports
// keep working unchanged.
export async function recordInvoicePayment(formData: FormData) {
  try {
    const v = invoicePaymentSchema.parse({
      invoiceId: formData.get("invoiceId"),
      amount: formData.get("amount"),
      method: formData.get("method"),
      payDate: formData.get("payDate"),
    })

    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", v.invoiceId)
      .single()
    if (!invoice) return { success: false, error: "Bill not found" }

    if (!isManagerOrAbove(role) && invoice.created_by !== user.id) {
      return { success: false, error: "You don't have permission to collect this bill" }
    }

    if (invoice.status === "Waived") {
      return { success: false, error: "This bill was written off. Un-waive it first (Admin/Manager)." }
    }

    const remaining = Math.max(0, (Number(invoice.amount) || 0) - (Number(invoice.paid_amount) || 0))
    if (remaining <= 0) return { success: false, error: "This bill is already fully paid" }
    if (v.amount > remaining) {
      return { success: false, error: `Amount exceeds this bill. Max: ৳${remaining.toLocaleString()}` }
    }

    const newPaid = (Number(invoice.paid_amount) || 0) + v.amount
    const isFull = newPaid >= (Number(invoice.amount) || 0)

    // 1. Installment row in the ledger (unified payment history)
    const { data: ledgerRow, error: ledgErr } = await supabase.from("ledgers").insert({
      client_id: invoice.client_id,
      project_id: invoice.project_id,
      invoice_id: invoice.id,
      total_amount: invoice.amount,
      paid_amount: v.amount,
      due_amount: Math.max(0, (Number(invoice.amount) || 0) - newPaid),
      status: isFull ? "Paid" : "Partial",
      pay_date: v.payDate,
      payment_month: invoice.billing_month,
      full_amount: isFull ? "Yes" : "No",
      created_by: user.id,
    }).select("id").single()
    if (ledgErr || !ledgerRow) throw ledgErr || new Error("Failed to write ledger")

    // 2. Payment log
    const { error: payErr } = await supabase.from("payments").insert({
      project_id: invoice.project_id,
      ledger_id: ledgerRow.id,
      invoice_id: invoice.id,
      amount: v.amount,
      method: v.method,
      date: v.payDate,
      billing_period: invoice.billing_month,
      created_by: user.id,
    })
    if (payErr) {
      await supabase.from("ledgers").delete().eq("id", ledgerRow.id)
      throw payErr
    }

    // 3. Update the bill + re-derive the project totals
    const { error: invErr } = await supabase.from("invoices").update({
      paid_amount: newPaid,
      status: isFull ? "Paid" : "Partial",
    }).eq("id", invoice.id)
    if (invErr) throw invErr

    await recalcProjectTotals(supabase, invoice.project_id)

    // Auto-generate a "Paid" invoice document for this collection
    const { data: billProject } = await supabase
      .from("projects")
      .select("name")
      .eq("id", invoice.project_id)
      .single()
    await autoCreateInvoiceForPayment(supabase, {
      clientId: invoice.client_id,
      projectName: billProject?.name || "Monthly service",
      amount: v.amount,
      billingMonth: invoice.billing_month,
      payDate: v.payDate,
      method: v.method,
      ledgerId: ledgerRow.id,
      userId: user.id,
    })

    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/")
    revalidatePath("/invoices")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to record bill payment:", error)
    return { success: false, error: error?.message || "Failed to record bill payment" }
  }
}

// Write off a bill — client left without paying, goodwill discount, etc.
// The remaining amount stops counting toward outstanding due, but any
// installments already collected stay in history.
export async function waiveInvoice(formData: FormData) {
  try {
    const v = waiveSchema.parse({
      invoiceId: formData.get("invoiceId"),
      reason: formData.get("reason"),
    })

    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isManagerOrAbove(role)) {
      return { success: false, error: "Only Admin and Manager can write off bills" }
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", v.invoiceId)
      .single()
    if (!invoice) return { success: false, error: "Bill not found" }
    if (invoice.status === "Paid") {
      return { success: false, error: "This bill is already fully paid — nothing to write off" }
    }

    const { error } = await supabase.from("invoices").update({
      status: "Waived",
      waive_reason: v.reason,
    }).eq("id", v.invoiceId)
    if (error) throw error

    await recalcProjectTotals(supabase, invoice.project_id)

    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to waive bill:", error)
    return { success: false, error: error?.message || "Failed to waive bill" }
  }
}

// Restore a written-off bill (mistake, or the client came back).
export async function unwaiveInvoice(invoiceId: string) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isManagerOrAbove(role)) {
      return { success: false, error: "Only Admin and Manager can restore bills" }
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single()
    if (!invoice) return { success: false, error: "Bill not found" }
    if (invoice.status !== "Waived") return { success: false, error: "This bill is not written off" }

    const paid = Number(invoice.paid_amount) || 0
    const status = paid <= 0 ? "Due" : paid >= (Number(invoice.amount) || 0) ? "Paid" : "Partial"

    const { error } = await supabase.from("invoices").update({
      status,
      waive_reason: null,
    }).eq("id", invoiceId)
    if (error) throw error

    await recalcProjectTotals(supabase, invoice.project_id)

    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to restore bill:", error)
    return { success: false, error: error?.message || "Failed to restore bill" }
  }
}

// Delete a bill created by mistake. Only allowed while nothing has been
// collected against it — otherwise delete the payments first.
export async function deleteInvoice(invoiceId: string) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isManagerOrAbove(role)) {
      return { success: false, error: "Only Admin and Manager can delete bills" }
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single()
    if (!invoice) return { success: false, error: "Bill not found" }

    if ((Number(invoice.paid_amount) || 0) > 0) {
      return {
        success: false,
        error: "Payments exist against this bill — delete those payment records first",
      }
    }

    const { error } = await supabase.from("invoices").delete().eq("id", invoiceId)
    if (error) throw error

    await recalcProjectTotals(supabase, invoice.project_id)

    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete bill:", error)
    return { success: false, error: error?.message || "Failed to delete bill" }
  }
}
