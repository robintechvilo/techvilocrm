"use client"

import { Fragment, useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Download, FileSpreadsheet, Building2, CalendarDays, CreditCard, AlertCircle, Ban, Edit2, Trash2, Undo2, Receipt } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatDate, escapeCsv } from "@/lib/utils"
import * as perm from "@/lib/permissions"
import { toast } from "sonner"
import { recordPayment, updatePayment, deletePayment } from "@/app/actions/payments"
import { recordInvoicePayment, waiveInvoice, unwaiveInvoice } from "@/app/actions/billing"
import { TablePagination } from "@/components/ui/table-pagination"
import { buttonVariants } from "@/components/ui/button"

export function PaymentsClient({
  clients,
  projects,
  users,
  ledgers,
  payments,
  invoices,
  billingEnabled,
  currentUser
}: {
  clients: any[],
  projects: any[],
  users: any[],
  ledgers: any[],
  payments: any[],
  invoices: any[],
  billingEnabled: boolean,
  currentUser: any
}) {
  const isAdminOrManager = perm.isAdminOrManager(currentUser)
  const isStaff = perm.isStaffRole(currentUser)

  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'Lead')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(activeClients.length > 0 ? activeClients[0].id : null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("Bank Transfer")
  const [editLedgerId, setEditLedgerId] = useState<string | null>(null)
  const [deleteLedgerId, setDeleteLedgerId] = useState<string | null>(null)
  const [collectInvoice, setCollectInvoice] = useState<any | null>(null)
  const [waiveTarget, setWaiveTarget] = useState<any | null>(null)
  const [collectMethod, setCollectMethod] = useState<string>("Bank Transfer")
  const [isLoading, setIsLoading] = useState(false)

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const clientLedger = ledgers.filter(l => l.client_id === selectedClientId)

  const isOwnClient = (client: any) => perm.isOwner(client, currentUser)
  const getOwnerName = (entity: any) => perm.getOwnerName(entity, users)
  const canRecordPayment = selectedClient ? (isAdminOrManager || isOwnClient(selectedClient)) : false

  const clientProjects = useMemo(() => {
    if (!selectedClient) return []
    return projects.filter(p => p.client_id === selectedClient.id)
  }, [selectedClient, projects])

  const selectedProject = clientProjects.find(p => p.id === selectedProjectId)

  const clientSummary = useMemo(() => {
    const totalValue = clientProjects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const totalPaid = clientProjects.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0)
    const totalDue = clientProjects.reduce((sum, p) => sum + (Number(p.due_amount) || 0), 0)
    return { totalValue, totalPaid, totalDue }
  }, [clientProjects])

  // Method lives on the linked payment log row, not the ledger snapshot.
  const getMethod = (ledgerId: string) =>
    payments.find(p => p.ledger_id === ledgerId)?.method || "—"

  // Group installments by billing month so 2-3 partial payments in the same
  // month read as ONE month with a subtotal, instead of repeated rows that
  // look like separate full bills. clientLedger is already newest-first, so
  // insertion order keeps the most recent month on top.
  const groupedLedger = useMemo(() => {
    const groups: { month: string; entries: any[]; paid: number }[] = []
    const index = new Map<string, number>()
    for (const entry of clientLedger) {
      const key = entry.payment_month || "No billing period"
      if (!index.has(key)) {
        index.set(key, groups.length)
        groups.push({ month: key, entries: [], paid: 0 })
      }
      const group = groups[index.get(key)!]
      group.entries.push(entry)
      group.paid += Number(entry.paid_amount) || 0
    }
    return groups
  }, [clientLedger])

  const totalCollected = clientLedger.reduce((sum, e) => sum + (Number(e.paid_amount) || 0), 0)

  // Paginate the ledger by month-group (6 months per page) and the bills
  // list by row — both reset when switching client.
  const GROUPS_PER_PAGE = 6
  const BILLS_PER_PAGE = 10
  const [ledgerPage, setLedgerPage] = useState(1)
  const [billsPage, setBillsPage] = useState(1)
  useEffect(() => {
    setLedgerPage(1)
    setBillsPage(1)
  }, [selectedClientId])
  const pagedGroups = groupedLedger.slice((ledgerPage - 1) * GROUPS_PER_PAGE, ledgerPage * GROUPS_PER_PAGE)

  // ---- Monthly bills (recurring projects) ----
  const clientInvoices = billingEnabled && selectedClientId
    ? invoices.filter(inv => inv.client_id === selectedClientId)
    : []
  const pagedInvoices = clientInvoices.slice((billsPage - 1) * BILLS_PER_PAGE, billsPage * BILLS_PER_PAGE)
  const todayStr = new Date().toISOString().split("T")[0]
  const isOverdueBill = (inv: any) =>
    (inv.status === "Due" || inv.status === "Partial") && inv.due_date && inv.due_date < todayStr
  const billRemaining = (inv: any) =>
    Math.max(0, (Number(inv.amount) || 0) - (Number(inv.paid_amount) || 0))
  const unpaidBillTotal = clientInvoices
    .filter(inv => inv.status !== "Waived")
    .reduce((s, inv) => s + billRemaining(inv), 0)

  const handleCollectSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!collectInvoice) return
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append("invoiceId", collectInvoice.id)
    try {
      const result = await recordInvoicePayment(formData)
      if (result.success) {
        toast.success("Bill payment recorded")
        setCollectInvoice(null)
      } else {
        toast.error(result.error || "Failed to record bill payment")
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleWaiveSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!waiveTarget) return
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append("invoiceId", waiveTarget.id)
    try {
      const result = await waiveInvoice(formData)
      if (result.success) {
        toast.success("Bill written off")
        setWaiveTarget(null)
      } else {
        toast.error(result.error || "Failed to write off bill")
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnwaive = async (invoiceId: string) => {
    setIsLoading(true)
    try {
      const result = await unwaiveInvoice(invoiceId)
      if (result.success) toast.success("Bill restored")
      else toast.error(result.error || "Failed to restore bill")
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecordPaymentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const result = await recordPayment(formData)
      if (result.success) {
        toast.success("Payment recorded successfully")
        setIsDialogOpen(false)
        setSelectedProjectId("")
      } else {
        toast.error(result.error || "Failed to record payment")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error("Failed to record payment:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditPaymentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editLedgerId) return
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const result = await updatePayment(editLedgerId, formData)
      if (result.success) {
        toast.success("Payment updated successfully")
        setEditLedgerId(null)
      } else {
        toast.error(result.error || "Failed to update payment")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
      console.error("Failed to update payment:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePaymentSubmit = async () => {
    if (deleteLedgerId) {
      setIsLoading(true)
      try {
        const result = await deletePayment(deleteLedgerId)
        if (result.success) {
          toast.success("Payment deleted successfully")
          setDeleteLedgerId(null)
        } else {
          toast.error(result.error || "Failed to delete payment")
        }
      } catch (error) {
        toast.error("An unexpected error occurred")
        console.error("Failed to delete payment:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleExportCSV = () => {
    if (!selectedClient || clientLedger.length === 0) return
    // Export the payment log (one row per installment) plus a correct summary
    // derived from projects. Per-row "Total"/"Due" snapshots were removed —
    // summing them double-counted months paid in multiple installments.
    const headers = ['Billing Month', 'Project/Service', 'Amount Paid', 'Method', 'Pay Date', 'Next Payment']
    const rows = clientLedger.map(entry => {
      const project = projects.find(p => p.id === entry.project_id)
      return [
        entry.payment_month || '-',
        project?.name || 'N/A',
        (Number(entry.paid_amount) || 0).toString(),
        getMethod(entry.id),
        entry.pay_date || '-',
        entry.next_payment_date || '-',
      ]
    })
    const summary = [
      [],
      ['Total Project Value', clientSummary.totalValue.toString()],
      ['Total Collected', clientSummary.totalPaid.toString()],
      ['Outstanding Due', clientSummary.totalDue.toString()],
    ]
    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(r => r.map(escapeCsv).join(',')),
      ...summary.map(r => r.map(escapeCsv).join(',')),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeCompany = (selectedClient.company || 'client').replace(/[^a-z0-9]+/gi, '_')
    link.download = `techvilo_ledger_${safeCompany}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Recurring projects are collected through their monthly bills once
  // billing is enabled — keep them out of the legacy one-time dialog.
  const isRecurringProject = (p: any) => String(p.billing_type || "").toLowerCase().startsWith("recurring")
  const legacyPayableProjects = clientProjects.filter(
    p => (Number(p.due_amount) || 0) > 0 && !(billingEnabled && isRecurringProject(p))
  )
  const hasOutstandingDue = legacyPayableProjects.length > 0

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Client List</h1>
          <p className="text-zinc-400">Detailed month-by-month billing and payment history.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2"
            onClick={handleExportCSV}
            disabled={!selectedClient || clientLedger.length === 0}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) setSelectedProjectId("")
          }}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-500 text-white gap-2 disabled:opacity-50 disabled:pointer-events-none")} disabled={!selectedClientId || !hasOutstandingDue || !canRecordPayment}>
                <Plus className="size-4" />
                Record Payment
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <form onSubmit={handleRecordPaymentSubmit}>
                <DialogHeader>
                  <DialogTitle>Record Payment for {selectedClient?.company}</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Select a project and record the payment.
                  </DialogDescription>
                </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Project / Service</Label>
                  <Select name="projectId" value={selectedProjectId} onValueChange={(val) => setSelectedProjectId(val || "")} required>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue placeholder="Select a project">
                        {selectedProjectId 
                          ? (clientProjects.find(p => p.id === selectedProjectId)?.name || "Select a project")
                          : "Select a project"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[200px]">
                      {legacyPayableProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex flex-row items-center justify-between w-[350px]">
                            <span className="font-medium text-zinc-200 truncate pr-4">{p.name}</span>
                            <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full whitespace-nowrap border border-rose-500/20 shrink-0">
                              Due: ৳{(Number(p.due_amount) || 0).toLocaleString()}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProject && (
                  <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase">Total</p>
                        <p className="text-sm font-bold text-zinc-100">৳ {(Number(selectedProject.amount) || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase">Paid</p>
                        <p className="text-sm font-bold text-emerald-400">৳ {(Number(selectedProject.paid_amount) || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase">Remaining</p>
                        <p className="text-sm font-bold text-rose-400">৳ {(Number(selectedProject.due_amount) || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-zinc-300">Amount Received (BDT)</Label>
                    <Input 
                      name="amount" 
                      type="number" 
                      placeholder={selectedProject ? `Max ৳${(Number(selectedProject.due_amount) || 0).toLocaleString()}` : "0"}
                      max={selectedProject ? Number(selectedProject.due_amount) : undefined}
                      className="bg-zinc-900 border-zinc-800 text-white" 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-zinc-300">Payment Method</Label>
                    <Select name="method" value={paymentMethod} onValueChange={(v) => setPaymentMethod(v || "Bank Transfer")}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectValue>{paymentMethod}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="bKash">bKash</SelectItem>
                        <SelectItem value="Nagad">Nagad</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Online Payment">Online Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-zinc-300">Pay Date</Label>
                    <Input name="payDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="bg-zinc-900 border-zinc-800 text-white" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-zinc-300">Next Payment Date</Label>
                    <Input name="nextPaymentDate" type="date" className="bg-zinc-900 border-zinc-800 text-white" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Billing Period</Label>
                  <Input 
                    name="billingMonth" 
                    placeholder="e.g. May 2026" 
                    defaultValue={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    className="bg-zinc-900 border-zinc-800 text-white" 
                    required 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!selectedProjectId || isLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white w-full">
                  <CreditCard className="size-4 mr-2" />
                  {isLoading ? "Recording..." : "Record Payment"}
                </Button>
              </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={!!editLedgerId} onOpenChange={(open) => !open && setEditLedgerId(null)}>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <form onSubmit={handleEditPaymentSubmit}>
                <DialogHeader>
                  <DialogTitle>Edit Payment Record</DialogTitle>
                </DialogHeader>
                {(() => {
                  const entryToEdit = clientLedger.find(l => l.id === editLedgerId)
                  if (!entryToEdit) return null
                  const linkedPayment = payments.find(p => p.ledger_id === entryToEdit.id)
                  return (
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label className="text-zinc-300">Amount Paid</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-zinc-500">৳</span>
                            <Input
                              name="amount"
                              type="number"
                              defaultValue={entryToEdit.paid_amount}
                              className="pl-7 bg-zinc-900 border-zinc-800 text-emerald-400 font-medium"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-zinc-300">Payment Method</Label>
                          <Select name="method" defaultValue={linkedPayment?.method || "Bank Transfer"}>
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                              <SelectItem value="bKash">bKash</SelectItem>
                              <SelectItem value="Nagad">Nagad</SelectItem>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                              <SelectItem value="Online Payment">Online Payment</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label className="text-zinc-300">Pay Date</Label>
                          <Input name="payDate" type="date" defaultValue={entryToEdit.pay_date || new Date().toISOString().split('T')[0]} className="bg-zinc-900 border-zinc-800 text-white" />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-zinc-300">Next Payment Date</Label>
                          <Input name="nextPaymentDate" type="date" defaultValue={entryToEdit.next_payment_date} className="bg-zinc-900 border-zinc-800 text-white" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-zinc-300">Billing Period</Label>
                        <Input 
                          name="billingMonth" 
                          defaultValue={entryToEdit.payment_month}
                          className="bg-zinc-900 border-zinc-800 text-white" 
                          required 
                        />
                      </div>
                    </div>
                  )
                })()}
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setEditLedgerId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
                  <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={!!deleteLedgerId} onOpenChange={(open) => !open && setDeleteLedgerId(null)}>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <DialogHeader>
                <DialogTitle className="text-rose-400 flex items-center gap-2">
                  <AlertCircle className="size-5" /> Confirm Deletion
                </DialogTitle>
                <DialogDescription className="text-zinc-400 pt-3">
                  Are you sure you want to delete this payment record?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4">
                <Button variant="ghost" onClick={() => setDeleteLedgerId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
                <Button variant="destructive" onClick={handleDeletePaymentSubmit} disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
                  {isLoading ? "Deleting..." : "Delete Record"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Collect against a monthly bill */}
          <Dialog open={!!collectInvoice} onOpenChange={(open) => !open && setCollectInvoice(null)}>
            <DialogContent className="sm:max-w-[460px] bg-zinc-950 border-zinc-800 text-zinc-100">
              {collectInvoice && (
              <form onSubmit={handleCollectSubmit} key={collectInvoice.id}>
                <DialogHeader>
                  <DialogTitle>Collect Bill — {collectInvoice.billing_month}</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    {projects.find(p => p.id === collectInvoice.project_id)?.name || "Project"} · partial amounts are fine, the rest stays due on this bill.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Bill</p>
                      <p className="text-sm font-bold text-zinc-100">৳ {(Number(collectInvoice.amount) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Paid</p>
                      <p className="text-sm font-bold text-emerald-400">৳ {(Number(collectInvoice.paid_amount) || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase">Remaining</p>
                      <p className="text-sm font-bold text-rose-400">৳ {billRemaining(collectInvoice).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="text-zinc-300">Amount Received (BDT)</Label>
                      <Input
                        name="amount"
                        type="number"
                        defaultValue={billRemaining(collectInvoice)}
                        max={billRemaining(collectInvoice)}
                        min={1}
                        className="bg-zinc-900 border-zinc-800 text-white"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-zinc-300">Payment Method</Label>
                      <Select name="method" value={collectMethod} onValueChange={(v) => setCollectMethod(v || "Bank Transfer")}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectValue>{collectMethod}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="bKash">bKash</SelectItem>
                          <SelectItem value="Nagad">Nagad</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Online Payment">Online Payment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-zinc-300">Pay Date</Label>
                    <Input name="payDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="bg-zinc-900 border-zinc-800 text-white" required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white w-full">
                    <CreditCard className="size-4 mr-2" />
                    {isLoading ? "Recording..." : "Record Payment"}
                  </Button>
                </DialogFooter>
              </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Write off a bill (client left without paying, discount, etc.) */}
          <Dialog open={!!waiveTarget} onOpenChange={(open) => !open && setWaiveTarget(null)}>
            <DialogContent className="sm:max-w-[440px] bg-zinc-950 border-zinc-800 text-zinc-100">
              {waiveTarget && (
              <form onSubmit={handleWaiveSubmit} key={waiveTarget.id}>
                <DialogHeader>
                  <DialogTitle className="text-rose-400 flex items-center gap-2">
                    <Ban className="size-5" /> Write Off Bill
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400 pt-2">
                    <span className="text-zinc-200 font-medium">{waiveTarget.billing_month}</span> —
                    remaining <span className="text-rose-400 font-medium">৳ {billRemaining(waiveTarget).toLocaleString()}</span> will
                    stop counting as due. Payments already collected stay in history. You can restore this bill later.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 py-4">
                  <Label className="text-zinc-300">Reason</Label>
                  <Input
                    name="reason"
                    placeholder="e.g. Client left without paying / goodwill discount"
                    className="bg-zinc-900 border-zinc-800 text-white"
                    minLength={3}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setWaiveTarget(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
                  <Button type="submit" disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
                    {isLoading ? "Writing off..." : "Write Off"}
                  </Button>
                </DialogFooter>
              </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid lg:grid-cols-6 gap-6 items-start">
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Building2 className="size-4" /> Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {activeClients.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No active clients found.</p>
              ) : (
                activeClients.map(client => {
                  const cProjects = projects.filter(p => p.client_id === client.id)
                  const cDue = cProjects.reduce((sum, p) => sum + (Number(p.due_amount) || 0), 0)
                  const isMine = isOwnClient(client)
                  return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors",
                      selectedClientId === client.id 
                        ? "bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20" 
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent",
                      isStaff && !isMine && "opacity-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="truncate">{client.company}</div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {isStaff && (
                          <span className={cn(
                            "text-[9px] font-medium px-1 rounded",
                            isMine ? "bg-indigo-500/10 text-indigo-400" : "bg-zinc-800/50 text-zinc-500"
                          )}>
                            {getOwnerName(client)}
                          </span>
                        )}
                        {cDue > 0 && (
                          <span className="text-[10px] text-rose-400 font-medium">
                            ৳{cDue.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs opacity-70 truncate">{client.name}</div>
                  </button>
                )})
              )}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-5 space-y-4">
          {selectedClient && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase font-medium">Total Project Value</p>
                <p className="text-lg font-bold text-white mt-0.5">৳ {clientSummary.totalValue.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-[10px] text-emerald-400/60 uppercase font-medium">Total Collected</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">৳ {clientSummary.totalPaid.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                <p className="text-[10px] text-rose-400/60 uppercase font-medium">Outstanding Due</p>
                <p className="text-lg font-bold text-rose-400 mt-0.5">৳ {clientSummary.totalDue.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* MONTHLY BILLS — recurring projects. One bill per month; partial
              installments accumulate against it; dead bills can be waived. */}
          {billingEnabled && selectedClient && clientInvoices.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-zinc-100 flex items-center gap-2">
                      <Receipt className="size-5 text-indigo-400" />
                      Monthly Bills
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                      Recurring bills for {selectedClient.company}. Collect installments, or write off a bill if the client left.
                    </CardDescription>
                  </div>
                  {unpaidBillTotal > 0 && (
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 shrink-0">
                      ৳ {unpaidBillTotal.toLocaleString()} unpaid
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-zinc-800 overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800 hover:bg-transparent whitespace-nowrap">
                        <TableHead className="text-zinc-400">Month</TableHead>
                        <TableHead className="text-zinc-400">Project</TableHead>
                        <TableHead className="text-zinc-400 text-right">Bill</TableHead>
                        <TableHead className="text-zinc-400 text-right">Paid</TableHead>
                        <TableHead className="text-zinc-400 text-right">Remaining</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedInvoices.map((inv) => {
                        const project = projects.find(p => p.id === inv.project_id)
                        const remaining = billRemaining(inv)
                        const overdue = isOverdueBill(inv)
                        const isWaived = inv.status === "Waived"
                        const isPaid = inv.status === "Paid"
                        return (
                          <TableRow key={inv.id} className={cn(
                            "border-zinc-800 hover:bg-zinc-800/50 transition-colors whitespace-nowrap",
                            isWaived && "opacity-50"
                          )}>
                            <TableCell className="font-medium text-zinc-100">{inv.billing_month}</TableCell>
                            <TableCell className="text-zinc-300">{project?.name || "N/A"}</TableCell>
                            <TableCell className="text-right text-zinc-300">৳ {(Number(inv.amount) || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-emerald-400 font-medium">৳ {(Number(inv.paid_amount) || 0).toLocaleString()}</TableCell>
                            <TableCell className={cn("text-right font-medium", remaining > 0 && !isWaived ? "text-rose-400" : "text-zinc-500")}>
                              {isWaived ? <span className="line-through">৳ {remaining.toLocaleString()}</span> : remaining > 0 ? `৳ ${remaining.toLocaleString()}` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                title={isWaived ? (inv.waive_reason || undefined) : undefined}
                                className={
                                  isPaid ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                  isWaived ? "bg-zinc-800/50 text-zinc-500 border-zinc-700" :
                                  overdue ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                  inv.status === "Partial" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                  "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                }
                              >
                                {isWaived ? "Written off" : overdue ? "Overdue" : inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isPaid && !isWaived && canRecordPayment && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 bg-emerald-600/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20 hover:text-emerald-300 text-xs"
                                    onClick={() => {
                                      setCollectMethod("Bank Transfer")
                                      setCollectInvoice(inv)
                                    }}
                                  >
                                    Collect
                                  </Button>
                                )}
                                {!isPaid && !isWaived && isAdminOrManager && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Write off this bill (client left, discount, etc.)"
                                    className="size-7 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                                    onClick={() => setWaiveTarget(inv)}
                                  >
                                    <Ban className="size-3.5" />
                                  </Button>
                                )}
                                {isWaived && isAdminOrManager && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Restore this bill"
                                    className="size-7 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={() => handleUnwaive(inv.id)}
                                    disabled={isLoading}
                                  >
                                    <Undo2 className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  page={billsPage}
                  pageSize={BILLS_PER_PAGE}
                  totalItems={clientInvoices.length}
                  onPageChange={setBillsPage}
                />
              </CardContent>
            </Card>
          )}

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-indigo-400" />
                {selectedClient ? `${selectedClient.company} — Payment Ledger` : "Select a client"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedClient ? (
                <div className="text-center py-8 text-zinc-500">
                  <Building2 className="size-8 mx-auto mb-2 text-zinc-700" />
                  <p>Select a client from the sidebar to view their ledger.</p>
                </div>
              ) : clientLedger.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <AlertCircle className="size-8 mx-auto mb-2 text-zinc-700" />
                  <p>No payment records for this client yet.</p>
                </div>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-x-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800 hover:bg-transparent whitespace-nowrap">
                        <TableHead className="text-zinc-400">Project/Service</TableHead>
                        <TableHead className="text-zinc-400 text-right">Amount Paid</TableHead>
                        <TableHead className="text-zinc-400">Method</TableHead>
                        <TableHead className="text-zinc-400">Pay Date</TableHead>
                        <TableHead className="text-zinc-400">Next Payment</TableHead>
                        <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedGroups.map((group) => (
                        <Fragment key={group.month}>
                          {/* Month header — installments in the same billing
                              month roll up under one subtotal */}
                          <TableRow className="border-zinc-800 bg-zinc-950/70 hover:bg-zinc-950/70">
                            <TableCell colSpan={6} className="py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <CalendarDays className="size-3.5 text-indigo-400" />
                                  <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{group.month}</span>
                                  <span className="text-[10px] text-zinc-500">
                                    {group.entries.length} payment{group.entries.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-emerald-400">
                                  ৳ {group.paid.toLocaleString()} collected
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {group.entries.map((entry) => {
                            const project = projects.find(p => p.id === entry.project_id)
                            return (
                            <TableRow key={entry.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors whitespace-nowrap">
                              <TableCell className="font-medium text-zinc-100">
                                <div>{project?.name || 'N/A'}</div>
                                {project?.service && (
                                  <div className="text-[10px] text-zinc-500 font-normal">{project.service}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-emerald-400 font-medium">৳ {(Number(entry.paid_amount) || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700 text-[10px]">
                                  {getMethod(entry.id)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-zinc-400">{formatDate(entry.pay_date)}</TableCell>
                              <TableCell className="text-zinc-400">{formatDate(entry.next_payment_date)}</TableCell>
                              <TableCell className="text-right">
                                {canRecordPayment ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="size-8 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10" onClick={() => setEditLedgerId(entry.id)}>
                                      <Edit2 className="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10" onClick={() => setDeleteLedgerId(entry.id)}>
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-zinc-600">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          )})}
                        </Fragment>
                      ))}
                      {/* Grand totals — value & due come from the client's
                          projects so they always match the summary cards */}
                      <TableRow className="border-zinc-800 bg-zinc-950/80 font-bold hover:bg-zinc-950/80">
                        <TableCell className="text-zinc-100">Total Collected</TableCell>
                        <TableCell className="text-right text-emerald-400">
                          ৳ {totalCollected.toLocaleString()}
                        </TableCell>
                        <TableCell colSpan={3} className="text-right text-zinc-500 text-xs font-normal">
                          Current outstanding (all projects)
                        </TableCell>
                        <TableCell className="text-right text-rose-400">
                          {clientSummary.totalDue > 0 ? `৳ ${clientSummary.totalDue.toLocaleString()}` : '৳ 0'}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
              {selectedClient && clientLedger.length > 0 && (
                <TablePagination
                  page={ledgerPage}
                  pageSize={GROUPS_PER_PAGE}
                  totalItems={groupedLedger.length}
                  onPageChange={setLedgerPage}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
