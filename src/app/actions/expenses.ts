"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isManagerOrAbove } from "@/lib/auth"

const expenseSchema = z.object({
  description: z.string().trim().min(2, "Description must be at least 2 characters"),
  category: z.string().trim().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().trim().min(1, "Date is required"),
})

async function assertCanWriteExpense() {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return { error: "Unauthorized" as const }
  if (!isManagerOrAbove(role)) {
    return { error: "Only Admin and Manager can manage expenses" as const }
  }
  return { supabase, user, role }
}

export async function addExpense(formData: FormData) {
  try {
    const guard = await assertCanWriteExpense()
    if ("error" in guard) return { success: false, error: guard.error }

    const validatedData = expenseSchema.parse({
      description: formData.get("title"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      date: formData.get("date"),
    })

    const { error } = await guard.supabase.from('expenses').insert({
      ...validatedData,
      created_by: guard.user.id,
    })

    if (error) throw error

    revalidatePath("/expenses")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to add expense:", error)
    return { success: false, error: error?.message || "Failed to add expense" }
  }
}

export async function updateExpense(expenseId: string, formData: FormData) {
  try {
    const guard = await assertCanWriteExpense()
    if ("error" in guard) return { success: false, error: guard.error }

    const validatedData = expenseSchema.parse({
      description: formData.get("title"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      date: formData.get("date"),
    })

    const { error } = await guard.supabase
      .from('expenses')
      .update(validatedData)
      .eq('id', expenseId)
    if (error) throw error

    revalidatePath("/expenses")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to update expense" }
  }
}

export async function deleteExpense(expenseId: string) {
  try {
    const guard = await assertCanWriteExpense()
    if ("error" in guard) return { success: false, error: guard.error }

    const { error } = await guard.supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId)
    if (error) throw error

    revalidatePath("/expenses")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to delete expense" }
  }
}
