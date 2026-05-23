import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { AdSupportClient } from "./AdSupportClient"

export default async function AdSupportPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  const [
    clientsRes,
    adSupportRes,
    profilesRes
  ] = await Promise.all([
    supabase.from('clients').select('*').order('company', { ascending: true }),
    supabase.from('ad_support').select('*').order('date', { ascending: false }),
    supabase.from('profiles').select('*')
  ])

  const clients = clientsRes.data || []
  const adSupport = adSupportRes.data || []
  const profiles = profilesRes.data || []

  return (
    <AdSupportClient 
      initialData={adSupport || []} 
      clients={clients || []} 
      currentUser={currentUser}
      users={profiles || []}
    />
  )
}
