import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { ClientsClient } from "./ClientsClient"

export default async function ClientsPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  const [
    { data: clients = [] },
    { data: profiles = [] }
  ] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    // Only used for the "Owner" name lookup
    supabase.from('profiles').select('id, name')
  ])

  return (
    <ClientsClient 
      initialClients={clients || []} 
      currentUser={currentUser} 
      users={profiles || []} 
    />
  )
}
