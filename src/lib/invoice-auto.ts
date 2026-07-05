// Auto-create a "Paid" invoice document whenever a payment is recorded.
// Best-effort: if SUPABASE_INVOICES.sql hasn't been run yet, every step
// fails silently and the payment flow is unaffected.

type AutoInvoiceInput = {
  clientId: string
  projectName: string
  amount: number
  billingMonth?: string | null
  payDate: string
  method?: string | null
  ledgerId?: string | null
  userId: string
}

async function nextInvoiceNo(supabase: any): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const { data } = await supabase
    .from("client_invoices")
    .select("invoice_no")
    .like("invoice_no", `${prefix}%`)
  let max = 0
  for (const row of data || []) {
    const n = parseInt(String(row.invoice_no).slice(prefix.length), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`
}

export async function autoCreateInvoiceForPayment(supabase: any, input: AutoInvoiceInput) {
  try {
    const [{ data: client }, { data: settings }] = await Promise.all([
      supabase.from("clients").select("name, company, email, phone").eq("id", input.clientId).single(),
      supabase.from("company_settings").select("bank_details").eq("id", 1).single(),
    ])

    const description = [
      input.billingMonth ? `Billing period: ${input.billingMonth}` : null,
      input.method ? `Paid via ${input.method}` : null,
    ].filter(Boolean).join(" · ")

    // Retry a couple of times in case two payments race for the same number
    for (let attempt = 0; attempt < 3; attempt++) {
      const invoiceNo = await nextInvoiceNo(supabase)
      const { error } = await supabase.from("client_invoices").insert({
        invoice_no: attempt === 0 ? invoiceNo : `${invoiceNo}-${attempt}`,
        title: `${input.projectName}${input.billingMonth ? ` — ${input.billingMonth}` : ""}`,
        client_id: input.clientId,
        billed_to: {
          company: client?.company || "",
          name: client?.name || "",
          email: client?.email || "",
          phone: client?.phone || "",
          address: "",
        },
        invoice_date: input.payDate,
        currency: "BDT",
        items: [
          {
            name: input.projectName,
            description,
            amount: input.amount,
          },
        ],
        total: input.amount,
        notes: settings?.bank_details || null,
        status: "Paid",
        source: "auto",
        ledger_id: input.ledgerId || null,
        created_by: input.userId,
      })
      if (!error) return
      if (error.code !== "23505") return // table missing / RLS — silently skip
    }
  } catch {
    // Never let invoice generation break a payment
  }
}
