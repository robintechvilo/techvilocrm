import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { InvoicesClient } from "./InvoicesClient"

export default async function InvoicesPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) return null

  const [invoicesRes, clientsRes] = await Promise.all([
    supabase.from('client_invoices').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name, company').order('company', { ascending: true }),
  ])

  // Table missing → the migration hasn't been run yet
  const setupNeeded = !!invoicesRes.error

  return (
    <InvoicesClient
      invoices={invoicesRes.data || []}
      clients={clientsRes.data || []}
      currentUser={currentUser}
      setupNeeded={setupNeeded}
    />
  )
}
