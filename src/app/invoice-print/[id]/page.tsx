import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { notFound, redirect } from "next/navigation"
import { formatMoney, amountInWords } from "@/lib/invoice-utils"
import { PrintActions } from "./PrintActions"

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect("/admin")

  const supabase = await createClient()
  const [{ data: invoice }, settingsRes] = await Promise.all([
    supabase.from("client_invoices").select("*").eq("id", id).single(),
    supabase.from("company_settings").select("*").eq("id", 1).single(),
  ])

  if (!invoice) return notFound()
  const settings = settingsRes.data

  const billedTo = invoice.billed_to || {}
  const items: Array<{ name: string; description?: string; amount: number }> = invoice.items || []
  const total = Number(invoice.total) || 0

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
      : "-"

  return (
    <div className="min-h-screen bg-zinc-900 print:bg-white">
      <PrintActions invoiceId={invoice.id} />

      {/* A4 document — colors forced so the PDF keeps the brand styling */}
      <div
        className="max-w-[820px] mx-auto my-6 print:my-0 bg-white text-zinc-900 shadow-2xl print:shadow-none rounded-lg print:rounded-none"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
      >
        <div className="p-10 print:p-8">
          {/* Header: title + invoice meta + logo */}
          <div className="flex items-start justify-between gap-6 mb-8">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-indigo-600 leading-tight mb-4">
                {invoice.title}
              </h1>
              <div className="space-y-1 text-sm">
                <div className="flex gap-3">
                  <span className="text-zinc-500 w-28">Invoice No #</span>
                  <span className="font-semibold text-zinc-900">{invoice.invoice_no}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-500 w-28">Invoice Date</span>
                  <span className="font-semibold text-zinc-900">{fmtDate(invoice.invoice_date)}</span>
                </div>
                {invoice.due_date && (
                  <div className="flex gap-3">
                    <span className="text-zinc-500 w-28">Due Date</span>
                    <span className="font-semibold text-zinc-900">{fmtDate(invoice.due_date)}</span>
                  </div>
                )}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings?.logo_url || "/logo.png"}
              alt={settings?.name || "Logo"}
              className="h-16 w-auto object-contain shrink-0"
            />
          </div>

          {/* Billed By / Billed To */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl bg-indigo-50 p-6">
              <h2 className="text-lg font-semibold text-indigo-600 mb-2">Billed By</h2>
              <p className="font-bold text-sm mb-1">{settings?.name || "Techvilo Ltd"}</p>
              {settings?.address && (
                <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed">{settings.address}</p>
              )}
              {settings?.phone && (
                <p className="text-sm text-zinc-700 mt-1">
                  <span className="font-bold">Phone:</span> {settings.phone}
                </p>
              )}
              {settings?.email && (
                <p className="text-sm text-zinc-700">
                  <span className="font-bold">Email:</span> {settings.email}
                </p>
              )}
            </div>
            <div className="rounded-2xl bg-indigo-50 p-6">
              <h2 className="text-lg font-semibold text-indigo-600 mb-2">Billed To</h2>
              <p className="font-bold text-sm mb-1">{billedTo.company || "—"}</p>
              {billedTo.name && billedTo.name !== billedTo.company && (
                <p className="text-sm text-zinc-700">{billedTo.name}</p>
              )}
              {billedTo.address && (
                <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed">{billedTo.address}</p>
              )}
              {billedTo.phone && (
                <p className="text-sm text-zinc-700 mt-1">
                  <span className="font-bold">Phone:</span> {billedTo.phone}
                </p>
              )}
              {billedTo.email && (
                <p className="text-sm text-zinc-700">
                  <span className="font-bold">Email:</span> {billedTo.email}
                </p>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-indigo-600 text-white">
                  <th className="text-left font-semibold px-4 py-3 w-10"></th>
                  <th className="text-left font-semibold px-2 py-3">Item</th>
                  <th className="text-right font-semibold px-4 py-3 w-36">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="bg-indigo-50/70 border-b-4 border-white align-top">
                    <td className="px-4 py-4 text-zinc-600 font-medium">{idx + 1}.</td>
                    <td className="px-2 py-4">
                      <p className="font-medium text-zinc-900">{it.name}</p>
                      {it.description && (
                        <p className="text-zinc-600 mt-0.5 leading-relaxed">{it.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-zinc-900 whitespace-nowrap">
                      {formatMoney(Number(it.amount) || 0, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total in words + total */}
          <div className="flex items-end justify-between gap-6 mb-10">
            <p className="text-sm font-bold text-zinc-900">
              Total (in words) : {amountInWords(total, invoice.currency)}
            </p>
            <div className="shrink-0 border-t-2 border-b-2 border-zinc-800 py-2 px-1 min-w-[260px]">
              <div className="flex items-center justify-between gap-8">
                <span className="text-xl font-semibold text-zinc-900">Total ({invoice.currency})</span>
                <span className="text-xl font-bold text-zinc-900">{formatMoney(total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Additional notes (bank details) */}
          {invoice.notes && (
            <div className="mb-8">
              <h3 className="text-base font-semibold text-indigo-600 mb-2">Additional Notes</h3>
              <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          {/* Terms */}
          {invoice.terms && (
            <div className="mb-8">
              <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed">{invoice.terms}</p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-8 mt-10 border-t border-zinc-200">
            <p className="text-[11px] text-zinc-500">
              This is an electronically generated document, no signature is required.
            </p>
          </div>
        </div>
      </div>

      <div className="h-8 print:hidden" />
    </div>
  )
}
