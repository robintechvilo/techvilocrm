import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  const [{ data: profiles = [] }, companyRes] = await Promise.all([
    supabase.from('profiles').select('*').order('name', { ascending: true }),
    supabase.from('company_settings').select('*').eq('id', 1).single(),
  ])

  return (
    <SettingsClient
      users={profiles || []}
      currentUser={currentUser}
      companySettings={companyRes.data || null}
    />
  )
}
