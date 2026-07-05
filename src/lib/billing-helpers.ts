// Server-side billing reconciliation helpers. Imported by server actions
// only — never from client components.
//
// Source-of-truth model:
//   • ledgers  = the installment log (every taka collected, one row each)
//   • invoices = the monthly bills for recurring projects
//   • projects.paid_amount / due_amount = DERIVED running totals
//
// Whenever an installment or bill changes, call these to re-derive the
// totals instead of hand-adjusting them (hand-adjusting is what caused
// the double-counting bugs found in the audit).

export function isRecurring(billingType: unknown): boolean {
  return String(billingType || "").toLowerCase().startsWith("recurring")
}

// Recompute an invoice's paid_amount/status from its linked ledger rows.
// A Waived bill stays Waived regardless of payments.
export async function recalcInvoiceFromLedgers(supabase: any, invoiceId: string) {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single()
  if (!invoice) return

  const { data: rows } = await supabase
    .from("ledgers")
    .select("paid_amount")
    .eq("invoice_id", invoiceId)

  const paid = (rows || []).reduce(
    (s: number, r: any) => s + (Number(r.paid_amount) || 0),
    0,
  )

  const status =
    invoice.status === "Waived"
      ? "Waived"
      : paid <= 0
        ? "Due"
        : paid >= (Number(invoice.amount) || 0)
          ? "Paid"
          : "Partial"

  await supabase
    .from("invoices")
    .update({ paid_amount: paid, status })
    .eq("id", invoiceId)
}

// Recompute a project's paid/due (and, for one-time projects, its
// Completed status) from the ledgers + invoices that belong to it.
//   • paid  = sum of all installments ever collected
//   • due   = one-time:  amount − paid
//             recurring: sum of remaining on non-Waived bills
export async function recalcProjectTotals(
  supabase: any,
  projectId: string,
  opts: { reopenCompleted?: boolean } = {},
) {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single()
  if (!project) return

  const { data: ledgerRows } = await supabase
    .from("ledgers")
    .select("paid_amount")
    .eq("project_id", projectId)

  const paid = (ledgerRows || []).reduce(
    (s: number, l: any) => s + (Number(l.paid_amount) || 0),
    0,
  )

  const recurring = isRecurring(project.billing_type)
  let due: number

  if (recurring) {
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("amount, paid_amount, status")
      .eq("project_id", projectId)

    if (error) {
      // invoices table not migrated yet — keep the legacy formula
      due = Math.max(0, (Number(project.amount) || 0) - paid)
    } else {
      due = (invoices || [])
        .filter((i: any) => i.status !== "Waived")
        .reduce(
          (s: number, i: any) =>
            s + Math.max(0, (Number(i.amount) || 0) - (Number(i.paid_amount) || 0)),
          0,
        )
    }
  } else {
    due = Math.max(0, (Number(project.amount) || 0) - paid)
  }

  // One-time projects auto-complete when settled. They only reopen
  // (Completed → Active) when the caller asks for it — e.g. after deleting
  // a payment — so a user's deliberate "Completed with due" (the Action
  // Center "Ready to Invoice" state) is preserved. Recurring projects keep
  // whatever status the user set; they end only when someone marks them
  // Completed/Paused/Cancelled.
  let status = project.status
  if (!recurring) {
    if (due <= 0 && (Number(project.amount) || 0) > 0) status = "Completed"
    else if (opts.reopenCompleted && project.status === "Completed" && due > 0) status = "Active"
  }

  await supabase
    .from("projects")
    .update({ paid_amount: paid, due_amount: due, status })
    .eq("id", projectId)
}
