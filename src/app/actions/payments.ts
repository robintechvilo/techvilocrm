"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isManagerOrAbove } from "@/lib/auth"
import { isRecurring, recalcInvoiceFromLedgers, recalcProjectTotals } from "@/lib/billing-helpers"
import { autoCreateInvoiceForPayment } from "@/lib/invoice-auto"

const paymentSchema = z.object({
  projectId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.string().trim().min(1, "Payment method is required"),
  payDate: z.string().trim().min(1, "Payment date is required"),
  billingMonth: z.string().trim().min(1, "Billing period is required"),
  nextPaymentDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
})

const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.string().trim().min(1, "Payment method is required"),
  payDate: z.string().trim().min(1, "Payment date is required"),
  billingMonth: z.string().trim().min(1, "Billing period is required"),
  nextPaymentDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
})

async function loadProjectForWrite(projectId: string) {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return { error: "Unauthorized" as const }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error || !project) return { error: "Project not found" as const }

  if (!isManagerOrAbove(role) && project.created_by !== user.id) {
    return { error: "You don't have permission to record payments for this project" as const }
  }

  return { supabase, user, role, project }
}

export async function recordPayment(formData: FormData) {
  try {
    const validatedData = paymentSchema.parse({
      projectId: formData.get("projectId"),
      amount: formData.get("amount"),
      method: formData.get("method"),
      payDate: formData.get("payDate"),
      billingMonth: formData.get("billingMonth"),
      nextPaymentDate: formData.get("nextPaymentDate") || null,
    })

    const guard = await loadProjectForWrite(validatedData.projectId)
    if ("error" in guard) return { success: false, error: guard.error }

    const { supabase, user, project } = guard

    // Recurring projects with monthly bills must be collected through their
    // bill (Payments page → Monthly Bills), otherwise the project totals and
    // the invoice totals drift apart. If the billing migration hasn't been
    // run yet (no invoices exist), the legacy flow below still works.
    if (isRecurring(project.billing_type)) {
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('project_id', project.id)
        .limit(1)
      if (existingInvoices && existingInvoices.length > 0) {
        return {
          success: false,
          error: "This is a recurring project — collect it from its monthly bill in the Payments page.",
        }
      }
    }

    const projectAmount = Number(project.amount) || 0
    const projectPaid = Number(project.paid_amount) || 0
    const projectDue = Number(project.due_amount) || 0

    const actualAmount = Math.min(validatedData.amount, projectDue)
    if (actualAmount <= 0) {
      return { success: false, error: "Due amount is already zero" }
    }

    const newPaid = projectPaid + actualAmount
    const newDue = Math.max(0, projectAmount - newPaid)
    const isFullyPaid = newDue <= 0
    const newStatus = isFullyPaid ? 'Completed' : project.status

    // 1. Insert ledger entry FIRST so we can link the payment to it
    const { data: ledgerRow, error: ledgErr } = await supabase.from('ledgers').insert({
      client_id: project.client_id,
      project_id: validatedData.projectId,
      total_amount: projectAmount,
      paid_amount: actualAmount,
      due_amount: newDue,
      status: isFullyPaid ? 'Paid' : 'Partial',
      pay_date: validatedData.payDate,
      next_payment_date: isFullyPaid ? null : validatedData.nextPaymentDate,
      payment_month: validatedData.billingMonth,
      full_amount: isFullyPaid ? 'Yes' : 'No',
      created_by: user.id,
    }).select('id').single()
    if (ledgErr || !ledgerRow) throw ledgErr || new Error("Failed to write ledger")

    // 2. Insert payment log (now linked via ledger_id)
    const { error: payErr } = await supabase.from('payments').insert({
      project_id: validatedData.projectId,
      ledger_id: ledgerRow.id,
      amount: actualAmount,
      method: validatedData.method,
      date: validatedData.payDate,
      billing_period: validatedData.billingMonth,
      created_by: user.id,
    })
    if (payErr) {
      // Rollback ledger insert
      await supabase.from('ledgers').delete().eq('id', ledgerRow.id)
      throw payErr
    }

    // 3. Update project
    const { error: pUpdateErr } = await supabase.from('projects').update({
      paid_amount: newPaid,
      due_amount: newDue,
      status: newStatus,
      // Use exactly what the user entered. Falling back to the old
      // project.next_payment_date kept a now-past date, which made the
      // project show as permanently "Overdue" even after being paid.
      next_payment_date: isFullyPaid ? null : validatedData.nextPaymentDate,
    }).eq('id', validatedData.projectId)

    if (pUpdateErr) throw pUpdateErr

    // Auto-generate a "Paid" invoice document for this collection
    // (no-op until SUPABASE_INVOICES.sql is run)
    await autoCreateInvoiceForPayment(supabase, {
      clientId: project.client_id,
      projectName: project.name,
      amount: actualAmount,
      billingMonth: validatedData.billingMonth,
      payDate: validatedData.payDate,
      method: validatedData.method,
      ledgerId: ledgerRow.id,
      userId: user.id,
    })

    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/")
    revalidatePath("/invoices")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to record payment:", error)
    return { success: false, error: error?.message || "Failed to record payment" }
  }
}

export async function updatePayment(ledgerId: string, formData: FormData) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const validated = updatePaymentSchema.parse({
      amount: formData.get("amount"),
      method: formData.get("method") || "Bank Transfer",
      payDate: formData.get("payDate") || "",
      billingMonth: formData.get("billingMonth") || "",
      nextPaymentDate: formData.get("nextPaymentDate") || null,
    })

    const { data: oldLedger } = await supabase
      .from('ledgers')
      .select('*')
      .eq('id', ledgerId)
      .single()
    if (!oldLedger) return { success: false, error: "Ledger not found" }

    if (!isManagerOrAbove(role) && oldLedger.created_by !== user.id) {
      return { success: false, error: "You don't have permission to modify this payment" }
    }

    // Installments that pay a monthly bill reconcile against the bill,
    // not against the project's one-time total.
    if (oldLedger.invoice_id) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', oldLedger.invoice_id)
        .single()
      if (!invoice) return { success: false, error: "Linked bill not found" }

      const otherPaid = Math.max(0, (Number(invoice.paid_amount) || 0) - (Number(oldLedger.paid_amount) || 0))
      const maxAllowed = Math.max(0, (Number(invoice.amount) || 0) - otherPaid)
      if (validated.amount > maxAllowed) {
        return { success: false, error: `Amount exceeds this bill. Max: ৳${maxAllowed.toLocaleString()}` }
      }

      const billRemaining = Math.max(0, (Number(invoice.amount) || 0) - (otherPaid + validated.amount))

      const { error: ledgErr } = await supabase.from('ledgers').update({
        paid_amount: validated.amount,
        due_amount: billRemaining,
        status: billRemaining <= 0 ? 'Paid' : 'Partial',
        pay_date: validated.payDate,
        // The billing month stays locked to the bill's month
        payment_month: invoice.billing_month,
        full_amount: billRemaining <= 0 ? 'Yes' : 'No',
      }).eq('id', ledgerId)
      if (ledgErr) throw ledgErr

      await supabase.from('payments').update({
        amount: validated.amount,
        method: validated.method,
        date: validated.payDate,
        billing_period: invoice.billing_month,
      }).eq('ledger_id', ledgerId)

      await recalcInvoiceFromLedgers(supabase, invoice.id)
      await recalcProjectTotals(supabase, oldLedger.project_id)

      revalidatePath("/payments")
      revalidatePath("/projects")
      revalidatePath("/")
      return { success: true }
    }

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', oldLedger.project_id)
      .single()
    if (!project) return { success: false, error: "Project not found" }

    const projectAmount = Number(project.amount) || 0
    const projectPaid = Number(project.paid_amount) || 0
    const oldLedgerPaid = Number(oldLedger.paid_amount) || 0

    const amountDiff = validated.amount - oldLedgerPaid
    const newPaid = Math.max(0, projectPaid + amountDiff)

    // Cap newPaid at the project amount (cannot pay more than total)
    if (newPaid > projectAmount) {
      return {
        success: false,
        error: `Amount exceeds project total. Max allowed: ৳${(projectAmount - projectPaid + oldLedgerPaid).toLocaleString()}`,
      }
    }

    const newDue = Math.max(0, projectAmount - newPaid)
    const isFullyPaid = newDue <= 0
    const newStatus = isFullyPaid
      ? 'Completed'
      : (project.status === 'Completed' ? 'Active' : project.status)

    // Update ledger
    const { error: ledgErr } = await supabase.from('ledgers').update({
      paid_amount: validated.amount,
      due_amount: newDue,
      status: isFullyPaid ? 'Paid' : 'Partial',
      payment_month: validated.billingMonth,
      pay_date: validated.payDate,
      next_payment_date: isFullyPaid ? null : validated.nextPaymentDate,
      full_amount: isFullyPaid ? 'Yes' : 'No',
    }).eq('id', ledgerId)
    if (ledgErr) throw ledgErr

    // Keep the linked payment log in sync
    await supabase.from('payments').update({
      amount: validated.amount,
      method: validated.method,
      date: validated.payDate,
      billing_period: validated.billingMonth,
    }).eq('ledger_id', ledgerId)

    // Update project totals
    const { error: pUpdateErr } = await supabase.from('projects').update({
      paid_amount: newPaid,
      due_amount: newDue,
      status: newStatus,
      next_payment_date: isFullyPaid ? null : validated.nextPaymentDate,
    }).eq('id', project.id)
    if (pUpdateErr) throw pUpdateErr

    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update payment:", error)
    return { success: false, error: error?.message || "Failed to update payment" }
  }
}

export async function deletePayment(ledgerId: string) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const { data: ledger } = await supabase
      .from('ledgers')
      .select('*')
      .eq('id', ledgerId)
      .single()
    if (!ledger) return { success: false, error: "Ledger not found" }

    if (!isManagerOrAbove(role) && ledger.created_by !== user.id) {
      return { success: false, error: "You don't have permission to delete this payment" }
    }

    // Delete the linked payment log via ledger_id (precise — no soft match)
    await supabase.from('payments').delete().eq('ledger_id', ledgerId)

    // Delete the ledger row itself
    const { error } = await supabase.from('ledgers').delete().eq('id', ledgerId)
    if (error) throw error

    // Re-derive totals from what's left instead of hand-adjusting them.
    // Handles both one-time projects and monthly-bill installments.
    if (ledger.invoice_id) {
      await recalcInvoiceFromLedgers(supabase, ledger.invoice_id)
    }
    await recalcProjectTotals(supabase, ledger.project_id, { reopenCompleted: true })

    revalidatePath("/payments")
    revalidatePath("/projects")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete payment:", error)
    return { success: false, error: error?.message || "Failed to delete payment" }
  }
}
