import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { ensureMonthlyInvoices } from "@/app/actions/billing"
import { PaymentsClient } from "./PaymentsClient"

export default async function LedgerPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) return null

  // Staff see only their own clients/projects here — ledgers, payments and
  // invoices are already scoped to the owner by RLS.
  const isStaff = currentUser.role === 'Staff'
  let clientsQuery = supabase.from('clients').select('*').order('company', { ascending: true })
  let projectsQuery = supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (isStaff) {
    clientsQuery = clientsQuery.eq('created_by', currentUser.id)
    projectsQuery = projectsQuery.eq('created_by', currentUser.id)
  }

  // Lazily open this month's bills (no-op until the billing migration runs).
  // Only the invoices read waits for it — everything else loads in parallel,
  // instead of the whole page stalling behind the RPC round-trip.
  const invoicesPromise = ensureMonthlyInvoices().then(() =>
    supabase.from('invoices').select('*').order('period_start', { ascending: false })
  )

  const [
    { data: clients = [] },
    { data: projects = [] },
    { data: ledgers = [] },
    { data: payments = [] },
    { data: profiles = [] },
    invoicesRes,
  ] = await Promise.all([
    clientsQuery,
    projectsQuery,
    supabase.from('ledgers').select('*').order('created_at', { ascending: false }),
    // Only the columns the UI actually reads — smaller payload, faster render
    supabase.from('payments').select('id, ledger_id, method'),
    supabase.from('profiles').select('id, name'),
    invoicesPromise,
  ])

  // Billing UI stays hidden until the invoices table exists.
  const billingEnabled = !invoicesRes.error

  return (
    <PaymentsClient
      clients={clients || []}
      projects={projects || []}
      users={profiles || []}
      ledgers={ledgers || []}
      payments={payments || []}
      invoices={invoicesRes.data || []}
      billingEnabled={billingEnabled}
      currentUser={currentUser}
    />
  )
}
