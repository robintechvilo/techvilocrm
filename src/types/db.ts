// Hand-written shapes for the CRM tables, derived from the migration and
// server-action inserts. Adopt these incrementally in place of `any[]`.
// You can regenerate a fuller version once the Supabase CLI is pointed at
// this project's database:  supabase gen types typescript --linked > db.gen.ts

export type Role = "Admin" | "Manager" | "Staff"
export type ClientStatus = "Lead" | "Active" | "Inactive"
export type ProjectStatus = "Active" | "In Progress" | "Completed" | "Paused" | "Cancelled"
export type LedgerStatus = "Paid" | "Partial" | "Due"
export type InvoiceStatus = "Due" | "Partial" | "Paid" | "Waived"

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  avatar_url?: string | null
  can_create_invoices?: boolean
  created_at?: string
}

export type ClientInvoiceStatus = "Draft" | "Sent" | "Paid" | "Cancelled"

// Invoice documents (manual + auto-generated from payments)
export interface ClientInvoice {
  id: string
  invoice_no: string
  title: string
  client_id: string | null
  billed_to: { company?: string; name?: string; address?: string; phone?: string; email?: string }
  invoice_date: string
  due_date: string | null
  currency: string
  items: Array<{ name: string; description?: string; amount: number }>
  total: number
  notes: string | null
  terms: string | null
  status: ClientInvoiceStatus
  source: "manual" | "auto"
  ledger_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: number
  name: string
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  bank_details: string | null
  default_terms: string | null
  updated_at: string
}

export interface Client {
  id: string
  name: string
  company: string
  email: string | null
  phone: string | null
  status: ClientStatus
  created_by: string
  created_at: string
}

export interface Project {
  id: string
  name: string
  client_id: string
  service: string
  status: ProjectStatus
  billing_type: string
  amount: number
  paid_amount: number
  due_amount: number
  next_payment_date: string | null
  created_by: string
  created_at: string
}

// One bill per recurring project per month (Phase C billing)
export interface Invoice {
  id: string
  project_id: string
  client_id: string
  period_start: string
  billing_month: string
  amount: number
  paid_amount: number
  status: InvoiceStatus
  waive_reason: string | null
  due_date: string | null
  created_by: string | null
  created_at: string
}

export interface Ledger {
  id: string
  client_id: string
  project_id: string
  invoice_id?: string | null
  total_amount: number
  paid_amount: number
  due_amount: number
  status: LedgerStatus
  pay_date: string | null
  next_payment_date: string | null
  payment_month: string | null
  full_amount: "Yes" | "No"
  created_by: string
  created_at: string
}

export interface Payment {
  id: string
  project_id: string
  ledger_id: string | null
  invoice_id?: string | null
  amount: number
  method: string
  date: string
  billing_period: string | null
  created_by: string
  created_at: string
}

export interface Expense {
  id: string
  description: string
  category: string
  amount: number
  date: string
  created_by: string
  created_at: string
}

// Installment history for ad support collections (audit #2, Phase E)
export interface AdSupportPayment {
  id: string
  ad_support_id: string
  amount: number
  method: string | null
  date: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface AdSupport {
  id: string
  client_id: string
  dollar_amount: number
  rate: number
  total_bdt: number
  paid_amount: number
  due_amount: number
  next_payment_date: string | null
  description: string | null
  date: string
  created_by: string
  created_at: string
}
