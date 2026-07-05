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
    collectionsRes
  ] = await Promise.all([
    supabase.from('clients').select('*').order('company', { ascending: true }),
    supabase.from('ad_support').select('*').order('date', { ascending: false }),
    supabase.from('ad_support_payments').select('*').order('date', { ascending: false })
  ])

  const clients = clientsRes.data || []
  const adSupport = adSupportRes.data || []
  // Collection history is hidden until SUPABASE_AUDIT2_PATCH.sql is run
  const collectionsEnabled = !collectionsRes.error

  return (
    <AdSupportClient
      initialData={adSupport || []}
      clients={clients || []}
      currentUser={currentUser}
      collections={collectionsRes.data || []}
      collectionsEnabled={collectionsEnabled}
    />
  )
}
