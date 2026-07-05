import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { ProjectsClient } from "./ProjectsClient"

export default async function ProjectsPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  // Staff only work with their own projects — scope at the source so the
  // page payload never carries other people's financials.
  const isStaff = currentUser.role === 'Staff'

  let projectsQuery = supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (isStaff) projectsQuery = projectsQuery.eq('created_by', currentUser.id)

  const [
    { data: projects = [] },
    { data: clients = [] },
    { data: ledgers = [] },
    { data: profiles = [] }
  ] = await Promise.all([
    projectsQuery,
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
