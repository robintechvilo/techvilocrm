import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

export type Role = "Admin" | "Manager" | "Staff"

// Wrapped in React.cache so the auth check (auth.getUser + profile query)
// runs at most once per request even though the layout AND the page both
// call it. cache() is request-scoped, so there is no cross-request leakage.
export const getAuthContext = cache(async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null, profile: null, role: null as Role | null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    supabase,
    user,
    profile,
    role: (profile?.role as Role) ?? null,
  }
})

export function isAdmin(role: Role | null) {
  return role === 'Admin'
}

export function isManagerOrAbove(role: Role | null) {
  return role === 'Admin' || role === 'Manager'
}

export function canModifyOwned(
  ownerId: string | null | undefined,
  userId: string,
  role: Role | null,
) {
  if (isManagerOrAbove(role)) return true
  return ownerId != null && ownerId === userId
}
