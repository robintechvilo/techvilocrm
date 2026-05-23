import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { PaymentsClient } from "./PaymentsClient"

export default async function LedgerPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  const [
    { data: clients = [] },
    { data: projects = [] },
    { data: ledgers = [] },
    { data: profiles = [] }
  ] = await Promise.all([
    supabase.from('clients').select('*').order('company', { ascending: true }),
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('ledgers').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*')
  ])

  return (
    <PaymentsClient 
      clients={clients || []} 
      projects={projects || []}
      users={profiles || []}
      ledgers={ledgers || []}
      currentUser={currentUser} 
    />
  )
}
