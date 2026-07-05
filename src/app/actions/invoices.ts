"use server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthContext, isAdmin, isManagerOrAbove } from "@/lib/auth"
import { invoiceTotal, CURRENCIES } from "@/lib/invoice-utils"

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().trim().optional(),
  amount: z.coerce.number().min(0),
})

const invoiceSchema = z.object({
  invoiceNo: z.string().trim().min(1, "Invoice number is required"),
  title: z.string().trim().min(2, "Title is required"),
  clientId: z.string().uuid("Select a client"),
  invoiceDate: z.string().trim().min(1, "Invoice date is required"),
  dueDate: z.string().optional().nullable().transform((v) => (v ? v : null)),
  currency: z.enum(Object.keys(CURRENCIES) as [string, ...string[]]),
  // Items arrive as a JSON string from the editor
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s)
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid items" })
        return z.NEVER
      }
    })
    .pipe(z.array(itemSchema).min(1, "Add at least one item")),
  billedToAddress: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  terms: z.string().trim().optional(),
  status: z.enum(["Draft", "Sent", "Paid", "Cancelled"]).default("Draft"),
})

function canInvoice(role: string | null, profile: any): boolean {
  return role === "Admin" || role === "Manager" || !!profile?.can_create_invoices
}

function parseInvoiceForm(formData: FormData) {
  return invoiceSchema.parse({
    invoiceNo: formData.get("invoiceNo"),
    title: formData.get("title"),
    clientId: formData.get("clientId"),
    invoiceDate: formData.get("invoiceDate"),
    dueDate: formData.get("dueDate") || null,
    currency: formData.get("currency") || "BDT",
    items: formData.get("items") || "[]",
    billedToAddress: formData.get("billedToAddress") || "",
    notes: formData.get("notes") || "",
    terms: formData.get("terms") || "",
    status: formData.get("status") || "Draft",
  })
}

async function buildBilledTo(supabase: any, clientId: string, address?: string) {
  const { data: client } = await supabase
    .from("clients")
    .select("name, company, email, phone")
    .eq("id", clientId)
    .single()
  return {
    company: client?.company || "",
    name: client?.name || "",
    email: client?.email || "",
    phone: client?.phone || "",
    address: address || "",
  }
}

export async function createInvoice(formData: FormData) {
  try {
    const { supabase, user, role, profile } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!canInvoice(role, profile)) {
      return { success: false, error: "You don't have invoice access — ask an admin" }
    }

    const v = parseInvoiceForm(formData)
    const billedTo = await buildBilledTo(supabase, v.clientId, v.billedToAddress)

    const { data: created, error } = await supabase.from("client_invoices").insert({
      invoice_no: v.invoiceNo,
      title: v.title,
      client_id: v.clientId,
      billed_to: billedTo,
      invoice_date: v.invoiceDate,
      due_date: v.dueDate,
      currency: v.currency,
      items: v.items,
      total: invoiceTotal(v.items),
      notes: v.notes || null,
      terms: v.terms || null,
      status: v.status,
      source: "manual",
      created_by: user.id,
    }).select("id").single()

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Invoice number "${v.invoiceNo}" already exists — pick another` }
      }
      if (error.code === "42P01") {
        return { success: false, error: "Invoices table missing — run SUPABASE_INVOICES.sql first" }
      }
      throw error
    }

    revalidatePath("/invoices")
    return { success: true, id: created?.id }
  } catch (error: any) {
    console.error("Failed to create invoice:", error)
    return { success: false, error: error?.message || "Failed to create invoice" }
  }
}

export async function updateInvoice(invoiceId: string, formData: FormData) {
  try {
    const { supabase, user, role, profile } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!canInvoice(role, profile)) {
      return { success: false, error: "You don't have invoice access — ask an admin" }
    }

    const { data: existing } = await supabase
      .from("client_invoices")
      .select("id, created_by")
      .eq("id", invoiceId)
      .single()
    if (!existing) return { success: false, error: "Invoice not found" }
    if (!isManagerOrAbove(role) && existing.created_by !== user.id) {
      return { success: false, error: "You don't have permission to edit this invoice" }
    }

    const v = parseInvoiceForm(formData)
    const billedTo = await buildBilledTo(supabase, v.clientId, v.billedToAddress)

    const { error } = await supabase.from("client_invoices").update({
      invoice_no: v.invoiceNo,
      title: v.title,
      client_id: v.clientId,
      billed_to: billedTo,
      invoice_date: v.invoiceDate,
      due_date: v.dueDate,
      currency: v.currency,
      items: v.items,
      total: invoiceTotal(v.items),
      notes: v.notes || null,
      terms: v.terms || null,
      status: v.status,
      updated_at: new Date().toISOString(),
    }).eq("id", invoiceId)

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Invoice number "${v.invoiceNo}" already exists — pick another` }
      }
      throw error
    }

    revalidatePath("/invoices")
    return { success: true, id: invoiceId }
  } catch (error: any) {
    console.error("Failed to update invoice:", error)
    return { success: false, error: error?.message || "Failed to update invoice" }
  }
}

export async function setInvoiceStatus(invoiceId: string, status: string) {
  try {
    const validated = z.enum(["Draft", "Sent", "Paid", "Cancelled"]).parse(status)
    const { supabase, user, role, profile } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!canInvoice(role, profile)) return { success: false, error: "No invoice access" }

    const { data: existing } = await supabase
      .from("client_invoices")
      .select("id, created_by")
      .eq("id", invoiceId)
      .single()
    if (!existing) return { success: false, error: "Invoice not found" }
    if (!isManagerOrAbove(role) && existing.created_by !== user.id) {
      return { success: false, error: "You don't have permission to modify this invoice" }
    }

    const { error } = await supabase
      .from("client_invoices")
      .update({ status: validated, updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
    if (error) throw error

    revalidatePath("/invoices")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to update status" }
  }
}

export async function deleteInvoice(invoiceId: string) {
  try {
    const { supabase, user, role, profile } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!canInvoice(role, profile)) return { success: false, error: "No invoice access" }

    const { data: existing } = await supabase
      .from("client_invoices")
      .select("id, created_by")
      .eq("id", invoiceId)
      .single()
    if (!existing) return { success: false, error: "Invoice not found" }
    if (!isManagerOrAbove(role) && existing.created_by !== user.id) {
      return { success: false, error: "You don't have permission to delete this invoice" }
    }

    const { error } = await supabase.from("client_invoices").delete().eq("id", invoiceId)
    if (error) throw error

    revalidatePath("/invoices")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to delete invoice" }
  }
}

// ---- Company settings (the "Billed By" block) — Admin only ----

const companySchema = z.object({
  name: z.string().trim().min(2, "Company name is required"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  logo_url: z.string().trim().optional(),
  bank_details: z.string().trim().optional(),
  default_terms: z.string().trim().optional(),
})

export async function saveCompanySettings(formData: FormData) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isAdmin(role)) return { success: false, error: "Only admins can edit company settings" }

    const v = companySchema.parse({
      name: formData.get("name"),
      address: formData.get("address") || "",
      phone: formData.get("phone") || "",
      email: formData.get("email") || "",
      logo_url: formData.get("logo_url") || "",
      bank_details: formData.get("bank_details") || "",
      default_terms: formData.get("default_terms") || "",
    })

    const { error } = await supabase.from("company_settings").upsert({
      id: 1,
      name: v.name,
      address: v.address || null,
      phone: v.phone || null,
      email: v.email || null,
      logo_url: v.logo_url || "/logo.png",
      bank_details: v.bank_details || null,
      default_terms: v.default_terms || null,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error

    revalidatePath("/settings")
    revalidatePath("/invoices")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to save company settings:", error)
    return { success: false, error: error?.message || "Failed to save company settings" }
  }
}

// ---- Per-staff invoice access toggle — Admin only ----

export async function toggleInvoiceAccess(userId: string, allowed: boolean) {
  try {
    const { supabase, user, role } = await getAuthContext()
    if (!user) return { success: false, error: "Unauthorized" }
    if (!isAdmin(role)) return { success: false, error: "Only admins can change invoice access" }

    const { error } = await supabase
      .from("profiles")
      .update({ can_create_invoices: allowed })
      .eq("id", userId)
    if (error) throw error

    revalidatePath("/settings")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to change invoice access" }
  }
}
