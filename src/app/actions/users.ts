"use server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isAdmin } from "@/lib/auth"

const userSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["Admin", "Manager", "Staff"]).default("Staff"),
})

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
})

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

const roleSchema = z.enum(["Admin", "Manager", "Staff"])

export async function createTeamMember(formData: FormData) {
  try {
    const { user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isAdmin(role)) return { success: false, error: "Only admins can create members" }

    const validatedData = userSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    })

    const adminClient = createAdminClient()

    // 1. Create user in Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: true,
      user_metadata: { name: validatedData.name },
    })

    if (authError) throw authError

    // 2. Create profile (bypasses RLS via service role)
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: authData.user.id,
      name: validatedData.name,
      email: validatedData.email,
      role: validatedData.role,
    })

    if (profileError) {
      // Cleanup auth user if profile fails
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    revalidatePath("/settings")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to create member:", error)
    return { success: false, error: error?.message || "Failed to create member" }
  }
}

export async function updateUserRole(userId: string, role: string) {
  try {
    const { supabase, user, role: actorRole } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isAdmin(actorRole)) return { success: false, error: "Only admins can change roles" }
    if (userId === user.id) return { success: false, error: "You cannot change your own role" }

    const validated = roleSchema.parse(role)

    const { error } = await supabase.from('profiles').update({ role: validated }).eq('id', userId)
    if (error) throw error

    revalidatePath("/settings")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update role:", error)
    return { success: false, error: error?.message || "Failed to update role" }
  }
}

export async function deleteUser(userId: string) {
  try {
    const { user, role: actorRole } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isAdmin(actorRole)) return { success: false, error: "Only admins can delete users" }
    if (userId === user.id) return { success: false, error: "You cannot delete your own account" }

    const adminClient = createAdminClient()

    // Remove auth user too — cascades nicely with the profile row
    const { error: authErr } = await adminClient.auth.admin.deleteUser(userId)
    if (authErr) throw authErr

    // Profile row will cascade if FK to auth.users is set; otherwise delete explicitly
    await adminClient.from('profiles').delete().eq('id', userId)

    revalidatePath("/settings")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete user:", error)
    return { success: false, error: error?.message || "Failed to delete user" }
  }
}

export async function updatePassword(formData: FormData) {
  try {
    const { supabase, user } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const validated = passwordSchema.parse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    })

    const { error } = await supabase.auth.updateUser({ password: validated.password })
    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error("Failed to update password:", error)
    return { success: false, error: error?.message || "Failed to update password" }
  }
}

export async function updateOwnProfile(formData: FormData) {
  try {
    const { supabase, user } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }

    const validated = profileUpdateSchema.parse({
      name: formData.get("name"),
    })

    const { error } = await supabase
      .from('profiles')
      .update({ name: validated.name })
      .eq('id', user.id)
    if (error) throw error

    revalidatePath("/settings/profile")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to update profile:", error)
    return { success: false, error: error?.message || "Failed to update profile" }
  }
}
