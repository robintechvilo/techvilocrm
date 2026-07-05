"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, FileText, Download, Save } from "lucide-react"
import { toast } from "sonner"
import { CURRENCIES, formatMoney, amountInWords, invoiceTotal, type InvoiceItem } from "@/lib/invoice-utils"
import { createInvoice, updateInvoice } from "@/app/actions/invoices"

type EditorItem = { name: string; description: string; amount: string }

export function InvoiceEditor({
  clients,
  settings,
  invoice,
  suggestedNo,
}: {
  clients: any[]
  settings: any
  invoice?: any
  suggestedNo?: string
}) {
  const router = useRouter()
  const isEdit = !!invoice

  const [title, setTitle] = useState<string>(invoice?.title || "")
  const [invoiceNo, setInvoiceNo] = useState<string>(invoice?.invoice_no || suggestedNo || "")
  const [clientId, setClientId] = useState<string>(invoice?.client_id || "")
  const [invoiceDate, setInvoiceDate] = useState<string>(invoice?.invoice_date || new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState<string>(invoice?.due_date || "")
  const [currency, setCurrency] = useState<string>(invoice?.currency || "BDT")
  const [status, setStatus] = useState<string>(invoice?.status || "Draft")
  const [billedToAddress, setBilledToAddress] = useState<string>(invoice?.billed_to?.address || "")
  const [notes, setNotes] = useState<string>(invoice?.notes ?? (settings?.bank_details || ""))
  const [terms, setTerms] = useState<string>(invoice?.terms ?? (settings?.default_terms || ""))
  const [items, setItems] = useState<EditorItem[]>(
    invoice?.items?.length
      ? invoice.items.map((it: any) => ({
          name: it.name || "",
          description: it.description || "",
          amount: String(it.amount ?? ""),
        }))
      : [{ name: "", description: "", amount: "" }]
  )
  const [saving, setSaving] = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)

  const parsedItems: InvoiceItem[] = items
    .filter(it => it.name.trim() !== "" || it.amount !== "")
    .map(it => ({
      name: it.name.trim(),
      description: it.description.trim() || undefined,
      amount: parseFloat(it.amount) || 0,
    }))
  const total = invoiceTotal(parsedItems)

  const setItem = (idx: number, patch: Partial<EditorItem>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const submit = async (goToPdf: boolean) => {
    if (!title.trim()) return toast.error("Give the invoice a title")
    if (!invoiceNo.trim()) return toast.error("Invoice number is required")
    if (!clientId) return toast.error("Select a client (Billed To)")
    if (parsedItems.length === 0 || parsedItems.every(i => !i.name)) return toast.error("Add at least one item")

    setSaving(true)
    const formData = new FormData()
    formData.append("invoiceNo", invoiceNo.trim())
    formData.append("title", title.trim())
    formData.append("clientId", clientId)
    formData.append("invoiceDate", invoiceDate)
    formData.append("dueDate", dueDate || "")
    formData.append("currency", currency)
    formData.append("items", JSON.stringify(parsedItems))
    formData.append("billedToAddress", billedToAddress)
    formData.append("notes", notes)
    formData.append("terms", terms)
    formData.append("status", status)

    const res = isEdit ? await updateInvoice(invoice.id, formData) : await createInvoice(formData)
    if (res.success) {
      toast.success(isEdit ? "Invoice updated" : "Invoice created")
      if (goToPdf && res.id) {
        window.open(`/invoice-print/${res.id}`, "_blank")
        router.push("/invoices")
      } else {
        router.push("/invoices")
      }
      router.refresh()
    } else {
      toast.error(res.error || "Failed to save invoice")
    }
    setSaving(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <Link href="/invoices">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="size-6 text-indigo-400" />
            {isEdit ? "Edit Invoice" : "New Invoice"}
          </h1>
          <p className="text-zinc-400 text-sm">Fill in the details — the PDF follows your brand template.</p>
        </div>
      </div>

      {/* Header info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-2">
            <Label className="text-zinc-300">Invoice Title</Label>
            <Input
              placeholder="e.g. Video Shoot National Polytechnic Institute (NPI)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-white text-lg font-semibold"
            />
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label className="text-zinc-300">Invoice No</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="bg-zinc-950 border-zinc-800 text-white font-mono" />
            </div>
            <div className="grid gap-2">
              <Label className="text-zinc-300">Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="bg-zinc-950 border-zinc-800 text-white" />
            </div>
            <div className="grid gap-2">
              <Label className="text-zinc-300">Due Date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-zinc-950 border-zinc-800 text-white" />
            </div>
            <div className="grid gap-2">
              <Label className="text-zinc-300">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v || "BDT")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                  <SelectValue>{CURRENCIES[currency as keyof typeof CURRENCIES]?.label || currency}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  {Object.entries(CURRENCIES).map(([code, c]) => (
                    <SelectItem key={code} value={code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billed By / Billed To */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-indigo-400 text-base">Billed By <span className="text-zinc-500 text-xs font-normal">(Your Details)</span></CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-300 space-y-1">
            <p className="font-semibold text-white">{settings?.name || "Techvilo Ltd"}</p>
            <p className="whitespace-pre-line text-zinc-400">{settings?.address || "—"}</p>
            {settings?.phone && <p className="text-zinc-400">Phone: {settings.phone}</p>}
            {settings?.email && <p className="text-zinc-400">Email: {settings.email}</p>}
            <p className="text-[10px] text-zinc-600 pt-2">Change these in Team Settings → Company Details.</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-indigo-400 text-base">Billed To <span className="text-zinc-500 text-xs font-normal">(Client&apos;s Details)</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={clientId} onValueChange={(v) => setClientId(v || "")}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full">
                <SelectValue placeholder="Select a client">
                  {selectedClient ? `${selectedClient.company} (${selectedClient.name})` : "Select a client"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[220px]">
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.company} ({c.name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClient && (
              <div className="text-sm space-y-1">
                <p className="font-semibold text-white">{selectedClient.company}</p>
                <p className="text-zinc-400">{selectedClient.name}</p>
                {selectedClient.phone && <p className="text-zinc-400">Phone: {selectedClient.phone}</p>}
                {selectedClient.email && <p className="text-zinc-400">Email: {selectedClient.email}</p>}
              </div>
            )}
            <div className="grid gap-2">
              <Label className="text-zinc-400 text-xs">Client Address (shown on PDF)</Label>
              <textarea
                value={billedToAddress}
                onChange={(e) => setBilledToAddress(e.target.value)}
                rows={2}
                placeholder="Street, City, Country"
                className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-zinc-100">Items</CardTitle>
              <CardDescription className="text-zinc-400">Line items shown on the invoice.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
              onClick={() => setItems(prev => [...prev, { name: "", description: "", amount: "" }])}
            >
              <Plus className="size-3.5" /> Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/40 space-y-2">
              <div className="flex gap-2">
                <span className="text-zinc-500 text-sm font-bold pt-2 w-6 shrink-0">{idx + 1}.</span>
                <div className="flex-1 grid sm:grid-cols-[1fr_180px] gap-2">
                  <Input
                    placeholder="Item name / service"
                    value={it.name}
                    onChange={(e) => setItem(idx, { name: e.target.value })}
                    className="bg-zinc-900 border-zinc-800 text-white"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-zinc-500 text-sm">
                      {CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={it.amount}
                      onChange={(e) => setItem(idx, { amount: e.target.value })}
                      className="pl-8 bg-zinc-900 border-zinc-800 text-white text-right font-semibold"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                  onClick={() => setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="pl-8 pr-11">
                <Input
                  placeholder="Description (optional) — e.g. 50% end of June 2026, 50% beginning of July 2026"
                  value={it.description}
                  onChange={(e) => setItem(idx, { description: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800/60 text-zinc-300 text-sm"
                />
              </div>
            </div>
          ))}

          {/* Live total */}
          <div className="flex flex-col items-end gap-1 pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-6">
              <span className="text-sm font-semibold text-zinc-400">Total ({currency})</span>
              <span className="text-2xl font-bold text-white">{formatMoney(total, currency)}</span>
            </div>
            <p className="text-[11px] text-zinc-500 italic">
              {total > 0 ? amountInWords(total, currency) : "Add items to see the total in words"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Terms */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-100 text-base">Additional Notes</CardTitle>
            <CardDescription className="text-zinc-400 text-xs">Bank details are pre-filled — edit freely.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={7}
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm p-3 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"
            />
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-100 text-base">Terms & Conditions</CardTitle>
            <CardDescription className="text-zinc-400 text-xs">Optional — shown under the notes on the PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={7}
              placeholder="e.g. Invoice without VAT according to § 13b German VAT Act..."
              className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"
            />
          </CardContent>
        </Card>
      </div>

      {/* Save bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center gap-3">
          <Label className="text-zinc-400 text-sm">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v || "Draft")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-[140px]">
              <SelectValue>{status}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Sent">Sent</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2 flex-1 sm:flex-initial"
            onClick={() => submit(false)}
            disabled={saving}
          >
            <Save className="size-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 flex-1 sm:flex-initial"
            onClick={() => submit(true)}
            disabled={saving}
          >
            <Download className="size-4" />
            {saving ? "Saving..." : "Save & Open PDF"}
          </Button>
        </div>
      </div>
    </div>
  )
}
