"use server"

import { createClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function login(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = (formData.get("email") as string)?.trim()
    const password = formData.get("password") as string

    if (!email || !password) {
      return { success: false, error: "Email and password are required" }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }
  } catch (error: any) {
    return { success: false, error: error?.message || "An unexpected error occurred" }
  }

  redirect("/")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/admin")
}

export async function getCurrentUser() {
  // Reuses the request-cached auth context so layout + page don't each
  // hit the database. Falls back to sign-out if the profile row is missing.
  const { supabase, user, profile } = await getAuthContext()

  if (!user) return null

  // Auth user exists but profile missing — sign them out to avoid redirect loop
  if (!profile) {
    await supabase.auth.signOut()
    return null
  }

  return profile
}
