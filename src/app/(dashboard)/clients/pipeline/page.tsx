import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { PipelineClient } from "./PipelineClient"

export default async function PipelinePage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  const [
    { data: clients = [] },
    { data: profiles = [] }
  ] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*')
  ])

  return (
    <PipelineClient 
      initialClients={clients || []} 
      currentUser={currentUser} 
      users={profiles || []} 
    />
  )
}
