import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { notFound, redirect } from "next/navigation"
import { InvoiceEditor } from "../../InvoiceEditor"

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  const { id } = await params

  if (!currentUser) return null

  const hasAccess =
    currentUser.role === "Admin" ||
    currentUser.role === "Manager" ||
    !!currentUser.can_create_invoices
  if (!hasAccess) redirect("/invoices")

  let clientsQuery = supabase.from("clients").select("*").order("company", { ascending: true })
  if (currentUser.role === "Staff") clientsQuery = clientsQuery.eq("created_by", currentUser.id)

  const [{ data: invoice }, { data: clients = [] }, settingsRes] = await Promise.all([
    supabase.from("client_invoices").select("*").eq("id", id).single(),
    clientsQuery,
    supabase.from("company_settings").select("*").eq("id", 1).single(),
  ])

  if (!invoice) return notFound()

  return (
    <InvoiceEditor
      clients={clients || []}
      settings={settingsRes.data || null}
      invoice={invoice}
    />
  )
}
