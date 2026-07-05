"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, FileText, Search, Eye, Edit2, Trash2, AlertCircle, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { cn, formatDate } from "@/lib/utils"
import * as perm from "@/lib/permissions"
import { formatMoney } from "@/lib/invoice-utils"
import { setInvoiceStatus, deleteInvoice } from "@/app/actions/invoices"
import { TablePagination } from "@/components/ui/table-pagination"

const STATUSES = ["Draft", "Sent", "Paid", "Cancelled"] as const
type StatusFilter = "All" | (typeof STATUSES)[number]

const STATUS_CLASSES: Record<string, string> = {
  Draft: "bg-zinc-800/50 text-zinc-400 border-zinc-700",
  Sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/20",
}

export function InvoicesClient({
  invoices,
  clients,
  currentUser,
  setupNeeded,
}: {
  invoices: any[]
  clients: any[]
  currentUser: any
  setupNeeded: boolean
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const hasAccess = perm.canCreateInvoices(currentUser)

  if (!hasAccess) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-white">No Invoice Access</h2>
          <p className="text-zinc-400 max-w-xs">Ask an admin to enable invoice access for your account in Team Settings.</p>
        </div>
      </div>
    )
  }

  const clientLabel = (inv: any) =>
    inv.billed_to?.company || clients.find(c => c.id === inv.client_id)?.company || "—"

  const filtered = invoices.filter(inv => {
    if (statusFilter !== "All" && inv.status !== statusFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      String(inv.invoice_no).toLowerCase().includes(q) ||
      String(inv.title).toLowerCase().includes(q) ||
      clientLabel(inv).toLowerCase().includes(q)
    )
  })

  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [search, statusFilter])
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleStatusChange = async (id: string, status: string) => {
    const res = await setInvoiceStatus(id, status)
    if (res.success) toast.success(`Marked as ${status}`)
    else toast.error(res.error || "Failed to update status")
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setLoading(true)
    const res = await deleteInvoice(deleteId)
    if (res.success) {
      toast.success("Invoice deleted")
      setDeleteId(null)
    } else {
      toast.error(res.error || "Failed to delete invoice")
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="size-6 text-indigo-400" /> Invoices
          </h1>
          <p className="text-zinc-400">Create, download and track client invoices. Payments auto-generate one.</p>
        </div>
        <Link
          href="/invoices/new"
          className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-500 text-white gap-2")}
        >
          <Plus className="size-4" />
          New Invoice
        </Link>
      </div>

      {setupNeeded && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>
            Invoices table not found — run <span className="font-mono text-amber-200">SUPABASE_INVOICES.sql</span> on
            your database (SQL Editor) to activate this module.
          </span>
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-zinc-100">All Invoices</CardTitle>
              <CardDescription className="text-zinc-400">{filtered.length} of {invoices.length} shown</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-1 p-1 bg-zinc-950/50 border border-zinc-800 rounded-lg overflow-x-auto">
                {(["All", ...STATUSES] as StatusFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                      statusFilter === s
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : "text-zinc-400 hover:text-zinc-200 border border-transparent",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                  placeholder="Search no, title, client..."
                  className="pl-9 bg-zinc-950 border-zinc-800"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="size-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Invoices</h3>
              <p className="text-zinc-500 text-sm">Create one manually, or record a payment — an invoice is generated automatically.</p>
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800 overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-zinc-950/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent whitespace-nowrap">
                    <TableHead className="text-zinc-400">Invoice No</TableHead>
                    <TableHead className="text-zinc-400">Title / Client</TableHead>
                    <TableHead className="text-zinc-400">Date</TableHead>
                    <TableHead className="text-zinc-400 text-right">Total</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map(inv => (
                    <TableRow key={inv.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors whitespace-nowrap">
                      <TableCell className="font-mono text-sm text-zinc-100">
                        {inv.invoice_no}
                        {inv.source === "auto" && (
                          <span className="ml-2 text-[9px] uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded px-1 py-0.5">auto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-zinc-100 truncate max-w-[260px]">{inv.title}</div>
                        <div className="text-xs text-zinc-500">{clientLabel(inv)}</div>
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm">{formatDate(inv.invoice_date)}</TableCell>
                      <TableCell className="text-right font-semibold text-zinc-100">
                        {formatMoney(Number(inv.total) || 0, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="outline-none">
                            <Badge variant="outline" className={cn("cursor-pointer", STATUS_CLASSES[inv.status] || STATUS_CLASSES.Draft)}>
                              {inv.status}
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                            <DropdownMenuLabel className="text-xs text-zinc-500">Set status</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            {STATUSES.filter(s => s !== inv.status).map(s => (
                              <DropdownMenuItem
                                key={s}
                                className="cursor-pointer focus:bg-zinc-800"
                                onClick={() => handleStatusChange(inv.id, s)}
                              >
                                {s}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/invoice-print/${inv.id}`} target="_blank">
                            <Button variant="ghost" size="icon" title="View / Download PDF" className="size-8 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10">
                              <Eye className="size-3.5" />
                            </Button>
                          </Link>
                          <Link href={`/invoices/${inv.id}/edit`}>
                            <Button variant="ghost" size="icon" title="Edit" className="size-8 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10">
                              <Edit2 className="size-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            className="size-8 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => setDeleteId(inv.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={filtered.length}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <AlertCircle className="size-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-3">
              Are you sure you want to delete this invoice? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {loading ? "Deleting..." : "Delete Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
