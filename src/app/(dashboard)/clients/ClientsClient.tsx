"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Users, ExternalLink, Eye, Edit2, Trash2, AlertCircle, Search } from "lucide-react"
import { TablePagination } from "@/components/ui/table-pagination"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { cn } from "@/lib/utils"
import * as perm from "@/lib/permissions"
import { toast } from "sonner"
import { addClient, updateClient, deleteClient } from "@/app/actions/clients"
import { buttonVariants } from "@/components/ui/button"

export function ClientsClient({ initialClients, currentUser, users }: { initialClients: any[], currentUser: any, users: any[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editClient, setEditClient] = useState<any | null>(null)
  const [editClientStatus, setEditClientStatus] = useState<string>("Lead")
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null)

  const isAdminOrManager = perm.isAdminOrManager(currentUser)
  const isStaff = perm.isStaffRole(currentUser)

  const isOwnClient = (client: any) => perm.isOwner(client, currentUser)
  const getOwnerName = (entity: any) => perm.getOwnerName(entity, users)

  // ---- Search / filter / pagination ----
  const PAGE_SIZE = 10
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [search, statusFilter])

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return initialClients.filter(client => {
      if (statusFilter !== "All" && client.status !== statusFilter) return false
      if (!q) return true
      return (
        String(client.name || "").toLowerCase().includes(q) ||
        String(client.company || "").toLowerCase().includes(q) ||
        String(client.email || "").toLowerCase().includes(q) ||
        String(client.phone || "").toLowerCase().includes(q)
      )
    })
  }, [initialClients, search, statusFilter])

  const pagedClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const result = await addClient(formData)
      if (result.success) {
        toast.success("Client added successfully")
        setIsDialogOpen(false)
        form.reset()
      } else {
        toast.error(result.error || "Failed to add client")
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editClient) return
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const result = await updateClient(editClient.id, formData)
      if (result.success) {
        toast.success("Client updated successfully")
        setEditClient(null)
      } else {
        toast.error(result.error || "Failed to update client")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSubmit = async () => {
    if (!deleteClientId) return
    setIsLoading(true)
    try {
      const result = await deleteClient(deleteClientId)
      if (result.success) {
        toast.success("Client deleted successfully")
        setDeleteClientId(null)
      } else {
        toast.error(result.error || "Failed to delete client")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Clients</h1>
          <p className="text-zinc-400 text-sm">
            {isStaff 
              ? "View all clients. You can manage clients you created." 
              : "Manage your business contacts and leads."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-500 text-white gap-2")}>
                <Plus className="size-4" />
                Add Client
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Enter the details of the new client or lead here. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-zinc-300">Name</Label>
                  <Input name="name" id="name" placeholder="John Doe" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company" className="text-zinc-300">Company</Label>
                  <Input name="company" id="company" placeholder="Acme Corp" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-zinc-300">Email</Label>
                  <Input name="email" id="email" type="email" placeholder="john@example.com" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone" className="text-zinc-300">Phone Number</Label>
                  <Input name="phone" id="phone" placeholder="+1 234 567 890" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status" className="text-zinc-300">Status</Label>
                  <Select name="status" defaultValue="Lead">
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-indigo-500/50">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Client"}
                </Button>
              </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="bg-zinc-900 border-zinc-800 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg text-zinc-100">All Clients</CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">{filteredClients.length} of {initialClients.length} shown</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "All")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[140px]">
                  <SelectValue>{statusFilter === "All" ? "All statuses" : statusFilter}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectItem value="All">All statuses</SelectItem>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                  placeholder="Search name, company, email, phone..."
                  className="pl-9 bg-zinc-950 border-zinc-800"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {initialClients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="size-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Clients Yet</h3>
              <p className="text-zinc-500 text-sm">Add your first client to get started.</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Search className="size-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Matches</h3>
              <p className="text-zinc-500 text-sm">No clients match your search/filter.</p>
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-zinc-950/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 w-[200px]">Client / Company</TableHead>
                    <TableHead className="text-zinc-400">Contact Email</TableHead>
                    <TableHead className="text-zinc-400">Phone</TableHead>
                    <TableHead className="text-zinc-400 w-[100px]">Status</TableHead>
                    {isStaff && <TableHead className="text-zinc-400 w-[80px]">Owner</TableHead>}
                    <TableHead className="text-zinc-400 text-right w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedClients.map((client) => {
                    const isMine = isOwnClient(client)
                    const canAccess = isAdminOrManager || isMine
                    return (
                    <TableRow 
                      key={client.id} 
                      className={cn(
                        "border-zinc-800 transition-colors",
                        isStaff && !isMine 
                          ? "opacity-60 hover:opacity-80 hover:bg-zinc-800/30" 
                          : "hover:bg-zinc-800/50"
                      )}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-zinc-100">{client.name}</div>
                            <div className="text-xs text-zinc-500">{client.company}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm">{client.email}</TableCell>
                      <TableCell className="text-zinc-300 text-sm whitespace-nowrap">{client.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline"
                          className={cn(
                            "text-[10px] px-2 py-0 h-5",
                            client.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            client.status === 'Lead' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'text-zinc-400 border-zinc-700 bg-zinc-800/50'
                          )}
                        >
                          {client.status}
                        </Badge>
                      </TableCell>
                      {isStaff && (
                        <TableCell>
                          <span className={cn(
                            "text-xs font-medium",
                            isMine ? "text-indigo-400" : "text-zinc-500"
                          )}>
                            {getOwnerName(client)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canAccess ? (
                            <>
                              <Link href={`/clients/${client.id}`}>
                                <Button variant="ghost" size="icon" className="size-8 text-zinc-400 hover:text-white hover:bg-zinc-800">
                                  <ExternalLink className="size-3.5" />
                                </Button>
                              </Link>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-8 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10"
                                onClick={() => {
                                  setEditClientStatus(client.status || "Lead")
                                  setEditClient(client)
                                }}
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-8 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                                onClick={() => setDeleteClientId(client.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="icon" className="size-8 text-zinc-600 cursor-default" disabled>
                              <Eye className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          )}
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={filteredClients.length}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
      {/* Edit Client Dialog */}
      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
          {editClient && (
          <form onSubmit={handleEditSubmit} key={editClient.id}>
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Update the client's information here.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name" className="text-zinc-300">Name</Label>
                <Input name="name" id="edit-name" defaultValue={editClient.name} className="bg-zinc-900 border-zinc-800 text-zinc-100" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-company" className="text-zinc-300">Company</Label>
                <Input name="company" id="edit-company" defaultValue={editClient.company} className="bg-zinc-900 border-zinc-800 text-zinc-100" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email" className="text-zinc-300">Email</Label>
                <Input name="email" id="edit-email" type="email" defaultValue={editClient.email} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone" className="text-zinc-300">Phone Number</Label>
                <Input name="phone" id="edit-phone" defaultValue={editClient.phone} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status" className="text-zinc-300">Status</Label>
                <Select name="status" value={editClientStatus} onValueChange={(v) => setEditClientStatus(v || "Lead")}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectValue>{editClientStatus}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteClientId} onOpenChange={(open) => !open && setDeleteClientId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <AlertCircle className="size-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-3">
              Are you sure you want to delete this client? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteClientId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSubmit} disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Deleting..." : "Delete Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
