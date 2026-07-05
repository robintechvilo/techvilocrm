"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn, formatDate, escapeCsv } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  Globe,
  AlertCircle,
  History,
  Download,
  CreditCard,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { recordAdSupport, updateAdSupport, deleteAdSupport, collectAdSupportPayment, deleteAdSupportCollection } from "@/app/actions/ad_support"
import { TablePagination } from "@/components/ui/table-pagination"
import { toast } from "sonner"
import * as perm from "@/lib/permissions"
import { buttonVariants } from "@/components/ui/button"

interface AdSupportClientProps {
  initialData: any[]
  clients: any[]
  currentUser: any
  collections: any[]
  collectionsEnabled: boolean
}

export function AdSupportClient({ initialData, clients, currentUser, collections, collectionsEnabled }: AdSupportClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [monthFilter, setMonthFilter] = useState<string>("all")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [collectTarget, setCollectTarget] = useState<any>(null)
  const [collectMethod, setCollectMethod] = useState<string>("Bank Transfer")
  const [historyTarget, setHistoryTarget] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Add-form fields are controlled so USD ⇄ BDT auto-calculate:
  //   dollar + rate  → paid auto-fills with the full BDT total
  //   paid + rate    → dollar amount auto-fills
  // `moneySource` remembers which money field the USER typed in — that field
  // drives the calculation and the other one keeps auto-updating. (Checking
  // "is the other field empty" broke after the first keystroke.)
  const [addDollar, setAddDollar] = useState("")
  const [addRate, setAddRate] = useState("")
  const [addPaid, setAddPaid] = useState("")
  const [moneySource, setMoneySource] = useState<"dollar" | "paid" | null>(null)

  const round2 = (n: number) => Math.round(n * 100) / 100

  const resetAddCalc = () => {
    setAddDollar("")
    setAddRate("")
    setAddPaid("")
    setMoneySource(null)
  }

  const onDollarChange = (v: string) => {
    setAddDollar(v)
    if (v === "") {
      // Field cleared — let the paid field drive from now on (if it has a value)
      setMoneySource(addPaid !== "" ? "paid" : null)
      return
    }
    setMoneySource("dollar")
    const d = parseFloat(v), r = parseFloat(addRate)
    if (!isNaN(d) && !isNaN(r) && r > 0) setAddPaid(String(round2(d * r)))
  }

  const onPaidChange = (v: string) => {
    setAddPaid(v)
    // If the user typed the dollar amount himself, editing paid means a
    // PARTIAL payment — never touch the dollar figure then.
    if (moneySource === "dollar") return
    if (v === "") {
      setAddDollar("")
      setMoneySource(null)
      return
    }
    setMoneySource("paid")
    const p = parseFloat(v), r = parseFloat(addRate)
    if (!isNaN(p) && !isNaN(r) && r > 0) setAddDollar(String(round2(p / r)))
  }

  const onRateChange = (v: string) => {
    setAddRate(v)
    const r = parseFloat(v)
    if (v === "" || isNaN(r) || r <= 0) return
    const d = parseFloat(addDollar), p = parseFloat(addPaid)
    if (moneySource === "paid" && addPaid !== "" && !isNaN(p)) {
      setAddDollar(String(round2(p / r)))
    } else if (addDollar !== "" && !isNaN(d)) {
      setAddPaid(String(round2(d * r)))
    } else if (addPaid !== "" && !isNaN(p)) {
      setAddDollar(String(round2(p / r)))
    }
  }

  const addTotalBdt =
    addDollar !== "" && addRate !== "" && !isNaN(parseFloat(addDollar)) && !isNaN(parseFloat(addRate))
      ? round2(parseFloat(addDollar) * parseFloat(addRate))
      : null
  const addDue = addTotalBdt != null
    ? Math.max(0, addTotalBdt - (parseFloat(addPaid) || 0))
    : null

  const canManage = perm.isAdminOrManager(currentUser)

  // Last 12 months for the filter dropdown
  const months = useMemo(() => {
    const arr: { key: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      })
    }
    return arr
  }, [])

  const filteredData = initialData.filter(item => {
    if (monthFilter !== "all" && !(item.date || "").startsWith(monthFilter)) return false
    const client = clients.find(c => c.id === item.client_id)
    const q = searchTerm.toLowerCase()
    return (
      (client?.company?.toLowerCase().includes(q)) ||
      (client?.name?.toLowerCase().includes(q)) ||
      (item.description?.toLowerCase().includes(q))
    )
  })

  // Pagination over the filtered rows
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [searchTerm, monthFilter])
  const pagedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Stat cards follow the active month/search filter
  const totalUsd = filteredData.reduce((sum, item) => sum + (Number(item.dollar_amount) || 0), 0)
  const totalPaid = filteredData.reduce((sum, item) => sum + (Number(item.paid_amount) || 0), 0)
  const totalDue = filteredData.reduce((sum, item) => sum + (Number(item.due_amount) || 0), 0)

  const recordRemaining = (item: any) =>
    Math.max(0, (Number(item.total_bdt) || 0) - (Number(item.paid_amount) || 0))
  const historyEntries = historyTarget
    ? collections.filter(c => c.ad_support_id === historyTarget.id)
    : []

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)

    const res = await recordAdSupport(formData)
    if (res.success) {
      toast.success("Ad support recorded successfully")
      setIsAddModalOpen(false)
      setSelectedClientId("")
      form.reset()
      resetAddCalc()
      router.refresh()
    } else {
      toast.error(res.error || "Failed to record ad support")
    }
    setLoading(false)
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const res = await updateAdSupport(editingRecord.id, formData)
    if (res.success) {
      toast.success("Ad support updated successfully")
      setIsEditModalOpen(false)
      setEditingRecord(null)
      router.refresh()
    } else {
      toast.error(res.error || "Failed to update ad support")
    }
    setLoading(false)
  }

  async function confirmDelete() {
    if (!deleteId) return
    setLoading(true)
    const res = await deleteAdSupport(deleteId)
    if (res.success) {
      toast.success("Record deleted")
      setDeleteId(null)
      router.refresh()
    } else {
      toast.error(res.error || "Failed to delete record")
    }
    setLoading(false)
  }

  async function handleCollect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!collectTarget) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append("adSupportId", collectTarget.id)
    const res = await collectAdSupportPayment(formData)
    if (res.success) {
      toast.success("Collection recorded")
      setCollectTarget(null)
      router.refresh()
    } else {
      toast.error(res.error || "Failed to record collection")
    }
    setLoading(false)
  }

  async function handleDeleteCollection(collectionId: string) {
    setLoading(true)
    const res = await deleteAdSupportCollection(collectionId)
    if (res.success) {
      toast.success("Collection entry removed")
      router.refresh()
    } else {
      toast.error(res.error || "Failed to remove entry")
    }
    setLoading(false)
  }

  function handleExportCSV() {
    if (filteredData.length === 0) return
    const headers = ['Date', 'Client', 'Company', 'USD Amount', 'Rate', 'Total BDT', 'Paid', 'Due', 'Followup', 'Description']
    const rows = filteredData.map(item => {
      const client = clients.find(c => c.id === item.client_id)
      return [
        item.date || '-',
        client?.name || 'Unknown',
        client?.company || '-',
        (Number(item.dollar_amount) || 0).toString(),
        (Number(item.rate) || 0).toString(),
        (Number(item.total_bdt) || 0).toString(),
        (Number(item.paid_amount) || 0).toString(),
        (Number(item.due_amount) || 0).toString(),
        item.next_payment_date || '-',
        item.description || '-',
      ]
    })
    const summary = [
      [],
      ['Total USD', totalUsd.toString()],
      ['Total Collected (BDT)', totalPaid.toString()],
      ['Outstanding Due (BDT)', totalDue.toString()],
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
    link.download = `techvilo_ad_support_${monthFilter === 'all' ? 'all' : monthFilter}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Globe className="text-indigo-400 size-6" /> Ad Support Management
          </h1>
          <p className="text-zinc-400">Track dollar funding and ad support for clients.</p>
        </div>
        
        {canManage && (
          <Dialog open={isAddModalOpen} onOpenChange={(open) => {
            setIsAddModalOpen(open)
            if (!open) resetAddCalc()
          }}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-700 text-white")}>
              <Plus className="mr-2 h-4 w-4" /> Record Ad Support
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg">
              <DialogHeader>
                <DialogTitle>Record New Ad Support</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="clientId">Client</Label>
                    <Select 
                      value={selectedClientId} 
                      onValueChange={(val) => setSelectedClientId(val || "")}
                      required
                    >
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 w-full">
                        <SelectValue>
                          {selectedClientId 
                            ? clients.find(c => c.id === selectedClientId)?.name 
                            : "Select client"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {`${client.name} (${client.company})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="clientId" value={selectedClientId} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dollarAmount">Dollar Amount ($)</Label>
                    <Input
                      id="dollarAmount"
                      name="dollarAmount"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 100"
                      value={addDollar}
                      onChange={(e) => onDollarChange(e.target.value)}
                      required
                      className="bg-zinc-950 border-zinc-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rate">Rate (BDT per $)</Label>
                    <Input
                      id="rate"
                      name="rate"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 140"
                      value={addRate}
                      onChange={(e) => onRateChange(e.target.value)}
                      required
                      className="bg-zinc-950 border-zinc-800"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paidAmount">Paid Amount (BDT)</Label>
                    <Input
                      id="paidAmount"
                      name="paidAmount"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 5000"
                      value={addPaid}
                      onChange={(e) => onPaidChange(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-emerald-400 font-bold"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Auto-fills from $ × rate — lower it for a partial payment.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nextPaymentDate">Next Payment Date</Label>
                    <Input
                      id="nextPaymentDate"
                      name="nextPaymentDate"
                      type="date"
                      className="bg-zinc-950 border-zinc-800"
                    />
                  </div>

                  {/* Live summary — updates as you type */}
                  {addTotalBdt != null && (
                    <div className="col-span-2 p-3 rounded-lg border border-zinc-800 bg-zinc-950/60">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">Total BDT</p>
                          <p className="text-sm font-bold text-zinc-100">৳ {addTotalBdt.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">Paying Now</p>
                          <p className="text-sm font-bold text-emerald-400">৳ {(parseFloat(addPaid) || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">Due</p>
                          <p className={cn("text-sm font-bold", (addDue || 0) > 0 ? "text-rose-400" : "text-zinc-500")}>
                            ৳ {(addDue || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input 
                      id="date" 
                      name="date" 
                      type="date" 
                      defaultValue={new Date().toISOString().split('T')[0]} 
                      required 
                      className="bg-zinc-950 border-zinc-800"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description / Reference</Label>
                    <Input 
                      id="description" 
                      name="description" 
                      placeholder="e.g. Facebook Ads for Client X" 
                      className="bg-zinc-950 border-zinc-800"
                    />
                  </div>
                </div>
                
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="border-zinc-700 text-zinc-300">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {loading ? "Recording..." : "Save Record"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-indigo-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total USD Support</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">$ {totalUsd.toLocaleString()}</div>
            <p className="text-xs text-zinc-500 mt-1">Gross dollar volume provided.</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">৳ {totalPaid.toLocaleString()}</div>
            <p className="text-xs text-zinc-500 mt-1">Amount received from clients.</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Outstanding Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-400">৳ {totalDue.toLocaleString()}</div>
            <p className="text-xs text-zinc-500 mt-1">Pending payments to be collected.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-zinc-100">Ad Support Records</CardTitle>
              <CardDescription className="text-zinc-400">Detailed list of all dollar support transactions.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v || "all")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[180px]">
                  <SelectValue>
                    {monthFilter === "all" ? "All months" : months.find(m => m.key === monthFilter)?.label || "All months"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[280px]">
                  <SelectItem value="all">All months</SelectItem>
                  {months.map(m => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search clients or descriptions..."
                  className="pl-9 bg-zinc-950 border-zinc-800"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2 shrink-0"
                onClick={handleExportCSV}
                disabled={filteredData.length === 0}
              >
                <Download className="size-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-zinc-800 overflow-x-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-zinc-950/50">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Date</TableHead>
                  <TableHead className="text-zinc-400">Client</TableHead>
                  <TableHead className="text-zinc-400">USD Amount</TableHead>
                  <TableHead className="text-zinc-400">Total BDT</TableHead>
                  <TableHead className="text-zinc-400">Paid</TableHead>
                  <TableHead className="text-zinc-400">Due</TableHead>
                  <TableHead className="text-zinc-400 hidden lg:table-cell">Followup</TableHead>
                  <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-zinc-500 py-10">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedData.map((item) => {
                    const client = clients.find(c => c.id === item.client_id)
                    return (
                      <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                        <TableCell className="text-zinc-400 font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                        <TableCell>
                          <div className="font-bold text-zinc-100">{client?.name || "Unknown"}</div>
                          <div className="text-[10px] text-zinc-500">{client?.company}</div>
                        </TableCell>
                        <TableCell className="text-zinc-100 font-bold whitespace-nowrap">$ {Number(item.dollar_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-zinc-400 whitespace-nowrap">৳ {Number(item.total_bdt).toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-400 font-bold whitespace-nowrap">৳ {Number(item.paid_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-rose-400 font-black whitespace-nowrap">
                          {Number(item.due_amount) > 0 ? `৳ ${Number(item.due_amount).toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell whitespace-nowrap">
                          {item.next_payment_date ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
                              {formatDate(item.next_payment_date)}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {collectionsEnabled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Collection history"
                                className="size-8 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                                onClick={() => setHistoryTarget(item)}
                              >
                                <History className="size-4" />
                              </Button>
                            )}
                            {canManage && collectionsEnabled && recordRemaining(item) > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 bg-emerald-600/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20 hover:text-emerald-300 text-xs"
                                onClick={() => {
                                  setCollectMethod("Bank Transfer")
                                  setCollectTarget(item)
                                }}
                              >
                                Collect
                              </Button>
                            )}
                            {canManage ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800")}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                  <DropdownMenuItem
                                    className="cursor-pointer hover:bg-zinc-800"
                                    onClick={() => {
                                      setEditingRecord(item)
                                      setIsEditModalOpen(true)
                                    }}
                                  >
                                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-rose-400 hover:bg-rose-500/10 hover:text-rose-400"
                                    onClick={() => setDeleteId(item.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-zinc-600 px-2">-</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={filteredData.length}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editingRecord && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Ad Support Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="clientId">Client</Label>
                  <Select 
                    value={editingRecord.client_id} 
                    onValueChange={(val) => setEditingRecord({...editingRecord, client_id: val || ""})}
                    required
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 w-full">
                      <SelectValue>
                        {clients.find(c => c.id === editingRecord.client_id)?.name || "Select client"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {`${client.name} (${client.company})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="clientId" value={editingRecord.client_id} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dollarAmount">Dollar Amount ($)</Label>
                  <Input 
                    id="dollarAmount" 
                    name="dollarAmount" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingRecord.dollar_amount}
                    required 
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate">Rate (BDT per $)</Label>
                  <Input 
                    id="rate" 
                    name="rate" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingRecord.rate}
                    required 
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                {collectionsEnabled ? (
                  <div className="space-y-2">
                    <Label>Paid Amount (BDT)</Label>
                    <div className="h-9 px-3 flex items-center rounded-md bg-zinc-950/60 border border-zinc-800 text-emerald-400 font-bold text-sm">
                      ৳ {(Number(editingRecord.paid_amount) || 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Derived from collection history — use the Collect button to add payments.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="paidAmount">Paid Amount (BDT)</Label>
                    <Input
                      id="paidAmount"
                      name="paidAmount"
                      type="number"
                      defaultValue={editingRecord.paid_amount}
                      className="bg-zinc-950 border-zinc-800 text-emerald-400 font-bold"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="nextPaymentDate">Next Payment Date</Label>
                  <Input
                    id="nextPaymentDate"
                    name="nextPaymentDate"
                    type="date"
                    defaultValue={editingRecord.next_payment_date}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input 
                    id="date" 
                    name="date" 
                    type="date" 
                    defaultValue={editingRecord.date} 
                    required 
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description / Reference</Label>
                  <Input 
                    id="description" 
                    name="description" 
                    defaultValue={editingRecord.description}
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
              </div>
              
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="border-zinc-700 text-zinc-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {loading ? "Updating..." : "Update Record"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <AlertCircle className="size-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-3">
              Are you sure you want to delete this ad support record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={loading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {loading ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect an installment */}
      <Dialog open={!!collectTarget} onOpenChange={(open) => !open && setCollectTarget(null)}>
        <DialogContent className="sm:max-w-[460px] bg-zinc-950 border-zinc-800 text-zinc-100">
          {collectTarget && (
          <form onSubmit={handleCollect} key={collectTarget.id}>
            <DialogHeader>
              <DialogTitle>Collect Payment</DialogTitle>
              <DialogDescription className="text-zinc-400">
                {clients.find(c => c.id === collectTarget.client_id)?.company || "Client"} — ${Number(collectTarget.dollar_amount).toLocaleString()} ad support. Partial amounts are fine.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">Total BDT</p>
                  <p className="text-sm font-bold text-zinc-100">৳ {(Number(collectTarget.total_bdt) || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">Paid</p>
                  <p className="text-sm font-bold text-emerald-400">৳ {(Number(collectTarget.paid_amount) || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase">Remaining</p>
                  <p className="text-sm font-bold text-rose-400">৳ {recordRemaining(collectTarget).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Amount (BDT)</Label>
                  <Input
                    name="amount"
                    type="number"
                    defaultValue={recordRemaining(collectTarget)}
                    max={recordRemaining(collectTarget)}
                    min={1}
                    className="bg-zinc-900 border-zinc-800 text-white"
                    autoFocus
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Method</Label>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Date</Label>
                  <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="bg-zinc-900 border-zinc-800 text-white" required />
                </div>
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Note (optional)</Label>
                  <Input name="note" placeholder="Reference..." className="bg-zinc-900 border-zinc-800 text-white" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white w-full">
                <CreditCard className="size-4 mr-2" />
                {loading ? "Recording..." : "Record Collection"}
              </Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Collection history */}
      <Dialog open={!!historyTarget} onOpenChange={(open) => !open && setHistoryTarget(null)}>
        <DialogContent className="sm:max-w-[520px] bg-zinc-950 border-zinc-800 text-zinc-100">
          {historyTarget && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="size-5 text-indigo-400" />
                Collection History
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                {clients.find(c => c.id === historyTarget.client_id)?.company || "Client"} — ৳{(Number(historyTarget.paid_amount) || 0).toLocaleString()} collected of ৳{(Number(historyTarget.total_bdt) || 0).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {historyEntries.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <History className="size-8 mx-auto mb-2 text-zinc-700" />
                  <p>No collections recorded yet.</p>
                </div>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-zinc-950/50 sticky top-0">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400">Date</TableHead>
                        <TableHead className="text-zinc-400">Method</TableHead>
                        <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                        {canManage && <TableHead className="text-zinc-400 text-right"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyEntries.map(entry => (
                        <TableRow key={entry.id} className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell className="text-zinc-300 text-sm">
                            {formatDate(entry.date)}
                            {entry.note && <p className="text-[10px] text-zinc-500">{entry.note}</p>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700 text-[10px]">
                              {entry.method || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-400">
                            ৳ {(Number(entry.amount) || 0).toLocaleString()}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Remove this entry"
                                className="size-7 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10"
                                onClick={() => handleDeleteCollection(entry.id)}
                                disabled={loading}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
