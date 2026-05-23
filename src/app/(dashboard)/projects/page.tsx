import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { ProjectsClient } from "./ProjectsClient"

export default async function ProjectsPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  const [
    { data: projects = [] },
    { data: clients = [] },
    { data: ledgers = [] },
    { data: profiles = [] }
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('*').order('company', { ascending: true }),
    supabase.from('ledgers').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*')
  ])

  return (
    <ProjectsClient 
      initialProjects={projects || []} 
      initialClients={clients || []}
      currentUser={currentUser} 
      users={profiles || []} 
      ledgers={ledgers || []}
    />
  )
}
