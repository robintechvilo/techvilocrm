// Client-safe permission helpers. Deliberately NOT importing from
// "@/lib/auth" (which pulls in server-only Supabase code) so these can be
// used inside "use client" components without bloating the client bundle.

type WithRole = { role?: string | null } | null | undefined
type WithId = { id?: string | null } | null | undefined
type Owned = { created_by?: string | null } | null | undefined

export function isAdminOrManager(user: WithRole): boolean {
  return user?.role === "Admin" || user?.role === "Manager"
}

export function isStaffRole(user: WithRole): boolean {
  return user?.role === "Staff"
}

export function isOwner(entity: Owned, user: WithId): boolean {
  return !!entity?.created_by && !!user?.id && entity.created_by === user.id
}

// True when the user may edit/delete the entity (owner, or a manager+).
export function canControl(entity: Owned, user: (WithRole & WithId)): boolean {
  return isAdminOrManager(user) || isOwner(entity, user)
}

// Invoice access: Admin/Manager always; Staff only when the admin has
// switched on their per-user toggle (profiles.can_create_invoices).
export function canCreateInvoices(
  user: (WithRole & { can_create_invoices?: boolean | null }) | null | undefined,
): boolean {
  return isAdminOrManager(user) || !!user?.can_create_invoices
}

export function getOwnerName(
  entity: Owned,
  users: Array<{ id: string; name?: string | null }>,
): string {
  return users.find((u) => u.id === entity?.created_by)?.name || "Unknown"
}
