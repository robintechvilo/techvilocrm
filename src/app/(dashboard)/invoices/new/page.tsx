import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { redirect } from "next/navigation"
import { InvoiceEditor } from "../InvoiceEditor"

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) return null

  const hasAccess =
    currentUser.role === "Admin" ||
    currentUser.role === "Manager" ||
    !!currentUser.can_create_invoices
  if (!hasAccess) redirect("/invoices")

  // Staff work only with their own clients (same scoping as Payments)
  let clientsQuery = supabase.from("clients").select("*").order("company", { ascending: true })
  if (currentUser.role === "Staff") clientsQuery = clientsQuery.eq("created_by", currentUser.id)

  const [{ data: clients = [] }, settingsRes, invoiceNosRes] = await Promise.all([
    clientsQuery,
    supabase.from("company_settings").select("*").eq("id", 1).single(),
    supabase.from("client_invoices").select("invoice_no"),
  ])

  // Suggest the next number in this year's INV-YYYY-NNN sequence
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  let max = 0
  for (const row of invoiceNosRes.data || []) {
    if (String(row.invoice_no).startsWith(prefix)) {
      const n = parseInt(String(row.invoice_no).slice(prefix.length), 10)
      if (!isNaN(n) && n > max) max = n
    }
  }
  const suggestedNo = `${prefix}${String(max + 1).padStart(3, "0")}`

  return (
    <InvoiceEditor
      clients={clients || []}
      settings={settingsRes.data || null}
      suggestedNo={suggestedNo}
    />
  )
}
