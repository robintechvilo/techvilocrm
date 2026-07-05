import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { ensureMonthlyInvoices } from "@/app/actions/billing"
import { PaymentsClient } from "./PaymentsClient"

export default async function LedgerPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) return null

  // Lazily open this month's bills for active recurring projects.
  // No-op until the billing migration has been run.
  await ensureMonthlyInvoices()

  // Staff see only their own clients/projects here — ledgers, payments and
  // invoices are already scoped to the owner by RLS.
  const isStaff = currentUser.role === 'Staff'
  let clientsQuery = supabase.from('clients').select('*').order('company', { ascending: true })
  let projectsQuery = supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (isStaff) {
    clientsQuery = clientsQuery.eq('created_by', currentUser.id)
    projectsQuery = projectsQuery.eq('created_by', currentUser.id)
  }

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
    supabase.from('payments').select('*'),
    supabase.from('profiles').select('*'),
    supabase.from('invoices').select('*').order('period_start', { ascending: false }),
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
