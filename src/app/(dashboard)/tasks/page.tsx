import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { TasksClient } from "./TasksClient"

export default async function TasksPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) return null

  // Staff pick from their own clients/projects when linking a task
  const isStaff = currentUser.role === "Staff"
  let clientsQuery = supabase.from("clients").select("id, name, company").order("company", { ascending: true })
  let projectsQuery = supabase.from("projects").select("id, name, client_id").order("created_at", { ascending: false })
  if (isStaff) {
    clientsQuery = clientsQuery.eq("created_by", currentUser.id)
    projectsQuery = projectsQuery.eq("created_by", currentUser.id)
  }

  const [tasksRes, commentsRes, { data: clients = [] }, { data: projects = [] }, { data: profiles = [] }] =
    await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_comments").select("*").order("created_at", { ascending: true }),
      clientsQuery,
      projectsQuery,
      supabase.from("profiles").select("id, name, role"),
    ])

  // Table missing → migration not run yet
  const setupNeeded = !!tasksRes.error

  return (
    <TasksClient
      tasks={tasksRes.data || []}
      comments={commentsRes.data || []}
      clients={clients || []}
      projects={projects || []}
      users={profiles || []}
      currentUser={currentUser}
      setupNeeded={setupNeeded}
    />
  )
}
