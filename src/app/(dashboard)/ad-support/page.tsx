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
    // Only what the table + dialogs display
    supabase.from('clients').select('id, name, company').order('company', { ascending: true }),
    supabase.from('ad_support').select('*').order('date', { ascending: false }),
    supabase.from('ad_support_payments').select('id, ad_support_id, amount, method, date, note').order('date', { ascending: false })
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
