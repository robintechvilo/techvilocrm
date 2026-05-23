import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { ClientProfileClient } from "./ClientProfileClient"
import { notFound } from "next/navigation"

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  const { id: clientId } = await params
  
  if (!currentUser) return null

  const [
    { data: client },
    { data: projects = [] },
    { data: ledgers = [] }
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('projects').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('ledgers').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  ])

  if (!client) {
    return notFound()
  }

  return (
    <ClientProfileClient 
      client={client} 
      projects={projects || []}
      ledgers={ledgers || []}
      currentUser={currentUser} 
    />
  )
}
