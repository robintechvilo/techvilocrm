// Hand-written shapes for the CRM tables, derived from the migration and
// server-action inserts. Adopt these incrementally in place of `any[]`.
// You can regenerate a fuller version once the Supabase CLI is pointed at
// this project's database:  supabase gen types typescript --linked > db.gen.ts

export type Role = "Admin" | "Manager" | "Staff"
export type ClientStatus = "Lead" | "Active" | "Inactive"
export type ProjectStatus = "Active" | "In Progress" | "Completed"
export type LedgerStatus = "Paid" | "Partial" | "Due"

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  avatar_url?: string | null
  created_at?: string
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

export interface Ledger {
  id: string
  client_id: string
  project_id: string
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
