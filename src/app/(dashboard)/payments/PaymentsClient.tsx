"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Download, FileSpreadsheet, Building2, CreditCard, AlertCircle, Edit2, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { recordPayment, updatePayment, deletePayment } from "@/app/actions/payments"
import { buttonVariants } from "@/components/ui/button"
import { escapeCsv } from "@/lib/auth"

export function PaymentsClient({ 
  clients, 
  projects, 
  users, 
  ledgers, 
  currentUser 
}: { 
  clients: any[], 
  projects: any[], 
  users: any[], 
  ledgers: any[], 
  currentUser: any 
}) {
  const isAdminOrManager = currentUser?.role === 'Admin' || currentUser?.role === 'Manager'
  const isStaff = currentUser?.role === 'Staff'

  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'Lead')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(activeClients.length > 0 ? activeClients[0].id : null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("Bank Transfer")
  const [editLedgerId, setEditLedgerId] = useState<string | null>(null)
  const [deleteLedgerId, setDeleteLedgerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const clientLedger = ledgers.filter(l => l.client_id === selectedClientId)

  const isOwnClient = (client: any) => client.created_by === currentUser?.id
  const getOwnerName = (entity: any) => {
    const owner = users.find(u => u.id === entity.created_by)
    return owner?.name || 'Unknown'
  }
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
    const headers = ['Project/Service', 'Billing Month', 'Total Amount', 'Paid', 'Due', 'Pay Date', 'Next Payment', 'Status']
    const rows = clientLedger.map(entry => {
      const project = projects.find(p => p.id === entry.project_id)
      return [
        project?.name || 'N/A',
        entry.payment_month,
        (Number(entry.total_amount) || 0).toString(),
        (Number(entry.paid_amount) || 0).toString(),
        (Number(entry.due_amount) || 0).toString(),
        entry.pay_date || '-',
        entry.next_payment_date || '-',
        entry.status,
      ]
    })
    const csvContent = [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeCompany = (selectedClient.company || 'client').replace(/[^a-z0-9]+/gi, '_')
    link.download = `techvilo_ledger_${safeCompany}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasOutstandingDue = clientProjects.some(p => (Number(p.due_amount) || 0) > 0)

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
                      {clientProjects.filter(p => (Number(p.due_amount) || 0) > 0).map(p => (
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
                  return (
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-zinc-300">Amount Paid</Label>
                        <div className="col-span-3 relative">
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
                  <Table className="min-w-[900px]">
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800 hover:bg-transparent whitespace-nowrap">
                        <TableHead className="text-zinc-400">Project/Service</TableHead>
                        <TableHead className="text-zinc-400">Billing Period</TableHead>
                        <TableHead className="text-zinc-400 text-right">Project Total</TableHead>
                        <TableHead className="text-zinc-400 text-right">Amount Paid</TableHead>
                        <TableHead className="text-zinc-400 text-right">Remaining Due</TableHead>
                        <TableHead className="text-zinc-400">Pay Date</TableHead>
                        <TableHead className="text-zinc-400">Next Payment</TableHead>
                        <TableHead className="text-zinc-400 text-right">Status</TableHead>
                        <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientLedger.map((entry) => {
                        const project = projects.find(p => p.id === entry.project_id)
                        return (
                        <TableRow key={entry.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors whitespace-nowrap">
                          <TableCell className="font-medium text-zinc-100">{project?.name || 'N/A'}</TableCell>
                          <TableCell className="text-zinc-300">{entry.payment_month}</TableCell>
                          <TableCell className="text-right text-zinc-300">৳ {(Number(entry.total_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-emerald-400 font-medium">৳ {(Number(entry.paid_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-rose-400 font-medium">
                            {(Number(entry.due_amount) || 0) > 0 ? `৳ ${(Number(entry.due_amount) || 0).toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-zinc-400">{formatDate(entry.pay_date)}</TableCell>
                          <TableCell className="text-zinc-400">{formatDate(entry.next_payment_date)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline"
                              className={
                                entry.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                entry.status === 'Partial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }
                            >
                              {entry.status}
                            </Badge>
                          </TableCell>
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
                      <TableRow className="border-zinc-800 bg-zinc-950/80 font-bold hover:bg-zinc-950/80">
                        <TableCell colSpan={2} className="text-zinc-100">Total</TableCell>
                        <TableCell className="text-right text-zinc-100">
                          ৳ {clientLedger.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-emerald-400">
                          ৳ {clientLedger.reduce((sum, e) => sum + (Number(e.paid_amount) || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-rose-400">
                          ৳ {clientLedger.reduce((sum, e) => sum + (Number(e.due_amount) || 0), 0).toLocaleString()}
                        </TableCell>
                        <TableCell colSpan={4}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
