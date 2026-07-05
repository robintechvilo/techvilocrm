"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn, formatDate } from "@/lib/utils"
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
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { recordAdSupport, updateAdSupport, deleteAdSupport } from "@/app/actions/ad_support"
import { toast } from "sonner"
import * as perm from "@/lib/permissions"
import { buttonVariants } from "@/components/ui/button"

interface AdSupportClientProps {
  initialData: any[]
  clients: any[]
  currentUser: any
  users: any[]
}

export function AdSupportClient({ initialData, clients, currentUser }: AdSupportClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canManage = perm.isAdminOrManager(currentUser)

  const filteredData = initialData.filter(item => {
    const client = clients.find(c => c.id === item.client_id)
    const q = searchTerm.toLowerCase()
    return (
      (client?.company?.toLowerCase().includes(q)) ||
      (client?.name?.toLowerCase().includes(q)) ||
      (item.description?.toLowerCase().includes(q))
    )
  })

  const totalUsd = initialData.reduce((sum, item) => sum + (Number(item.dollar_amount) || 0), 0)
  const totalPaid = initialData.reduce((sum, item) => sum + (Number(item.paid_amount) || 0), 0)
  const totalDue = initialData.reduce((sum, item) => sum + (Number(item.due_amount) || 0), 0)

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
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
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
                      placeholder="e.g. 5000" 
                      className="bg-zinc-950 border-zinc-800 text-emerald-400 font-bold"
                    />
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
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input 
                placeholder="Search clients or descriptions..." 
                className="pl-9 bg-zinc-950 border-zinc-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
                  filteredData.map((item) => {
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
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
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
    </div>
  )
}
