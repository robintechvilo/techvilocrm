"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Briefcase, CreditCard, TrendingUp, Clock, History, Edit2, Trash2, AlertCircle, Search } from "lucide-react"
import { TablePagination } from "@/components/ui/table-pagination"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import * as perm from "@/lib/permissions"
import { toast } from "sonner"
import { addProject, updateProject, deleteProject } from "@/app/actions/projects"
import { recordPayment } from "@/app/actions/payments"
import { buttonVariants } from "@/components/ui/button"

export function ProjectsClient({ 
  initialProjects, 
  initialClients, 
  currentUser, 
  users, 
  ledgers 
}: { 
  initialProjects: any[], 
  initialClients: any[], 
  currentUser: any, 
  users: any[], 
  ledgers: any[] 
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCustomService, setIsCustomService] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null)
  const [editProject, setEditProject] = useState<any | null>(null)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)

  // Controlled state for Create Project form
  const [createClient, setCreateClient] = useState<string>("")
  const [createService, setCreateService] = useState<string>("")
  const [createBilling, setCreateBilling] = useState<string>("Recurring (Monthly)")
  const [createStatus, setCreateStatus] = useState<string>("Active")

  // Controlled state for Edit Project form
  const [editClient, setEditClient] = useState<string>("")
  const [editService, setEditService] = useState<string>("")
  const [editBilling, setEditBilling] = useState<string>("")
  const [editStatus, setEditStatus] = useState<string>("")

  const isAdminOrManager = perm.isAdminOrManager(currentUser)
  const isStaff = perm.isStaffRole(currentUser)

  const projects = initialProjects
  const clients = isAdminOrManager
    ? initialClients
    : initialClients.filter(c => c.created_by === currentUser?.id)

  // ---- Search / filter / pagination ----
  const PAGE_SIZE = 10
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [search, statusFilter])

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(p => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false
      if (!q) return true
      const client = initialClients.find(c => c.id === p.client_id)
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.service || "").toLowerCase().includes(q) ||
        String(client?.company || "").toLowerCase().includes(q) ||
        String(client?.name || "").toLowerCase().includes(q)
      )
    })
  }, [projects, initialClients, search, statusFilter])

  const pagedProjects = filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isOwnProject = (project: any) => perm.isOwner(project, currentUser)
  const getClientLabel = (clientId: string) => {
    const c = initialClients.find(c => c.id === clientId)
    return c ? `${c.name} (${c.company})` : 'Select client'
  }

  const stats = useMemo(() => {
    const totalValue = projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const totalPaid = projects.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0)
    const totalDue = projects.reduce((sum, p) => sum + (Number(p.due_amount) || 0), 0)
    const activeCount = projects.filter(p => p.status === 'Active' || p.status === 'In Progress').length
    return { totalValue, totalPaid, totalDue, activeCount }
  }, [projects])

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const result = await addProject(formData)
      if (result.success) {
        toast.success("Project created successfully")
        setIsDialogOpen(false)
        form.reset()
        setCreateClient("")
        setCreateService("")
        setCreateBilling("Recurring (Monthly)")
        setCreateStatus("Active")
      } else {
        toast.error(result.error || "Failed to create project")
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred")
      console.error("Failed to create project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.append("projectId", selectedProjectId!)
    
    try {
      const result = await recordPayment(formData)
      if (result.success) {
        toast.success("Payment recorded successfully")
        setPaymentDialogOpen(false)
        setSelectedProjectId(null)
      } else {
        toast.error(result.error || "Failed to record payment")
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred")
      console.error("Failed to record payment:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editProject) return
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const result = await updateProject(editProject.id, formData)
      if (result.success) {
        toast.success("Project updated successfully")
        setEditProject(null)
      } else {
        toast.error(result.error || "Failed to update project")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return
    setIsLoading(true)
    try {
      const result = await deleteProject(deleteProjectId)
      if (result.success) {
        toast.success("Project deleted successfully")
        setDeleteProjectId(null)
      } else {
        toast.error(result.error || "Failed to delete project")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const historyProject = projects.find(p => p.id === historyProjectId)
  const projectHistory = historyProject 
    ? ledgers.filter(l => l.project_id === historyProject.id) 
    : []

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Projects</h1>
          <p className="text-zinc-400">Track services, payments, and project progress.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setIsCustomService(false)
              setCreateClient("")
              setCreateService("")
              setCreateBilling("Recurring (Monthly)")
              setCreateStatus("Active")
            }
          }}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-500 text-white gap-2")}>
                <Plus className="size-4" />
                New Project
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <form onSubmit={handleCreateProject}>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Enter the details of the new project here.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label className="text-zinc-300">Project Name</Label>
                    <Input name="projectName" placeholder="e.g. Website Redesign" className="bg-zinc-900 border-zinc-800 text-white" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="client" className="text-zinc-300">Client</Label>
                      <Select name="client" value={createClient} onValueChange={(v) => setCreateClient(v || "")} required>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                          <SelectValue placeholder="Select client">{createClient ? getClientLabel(createClient) : "Select client"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[200px]">
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({c.company})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="service" className="text-zinc-300">Service Type</Label>
                      <Select name="service" value={createService} onValueChange={(val) => { setCreateService(val || ""); setIsCustomService(val === 'Custom') }} required>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-indigo-500/50">
                          <SelectValue placeholder="Select service">{createService || "Select service"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectItem value="Web Development">Web Development</SelectItem>
                          <SelectItem value="AI Automation">AI Automation</SelectItem>
                          <SelectItem value="Custom Software">Custom Software</SelectItem>
                          <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                          <SelectItem value="SEO Service">SEO Service</SelectItem>
                          <SelectItem value="Custom" className="text-indigo-400 font-medium">Create New Service...</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomService && (
                        <Input 
                          name="customService" 
                          placeholder="Enter custom service name" 
                          className="bg-zinc-900 border-zinc-800 text-zinc-100 mt-2" 
                          required 
                        />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="billing" className="text-zinc-300">Billing Type</Label>
                      <Select name="billing" value={createBilling} onValueChange={(v) => setCreateBilling(v || "Recurring (Monthly)")}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-indigo-500/50">
                          <SelectValue placeholder="Select type">{createBilling}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectItem value="Recurring (Monthly)">Recurring (Monthly)</SelectItem>
                          <SelectItem value="One-time">One-time Project</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="total" className="text-zinc-300">Amount (BDT)</Label>
                      <Input name="total" id="total" type="number" placeholder="40000" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nextDate" className="text-zinc-300">Next Payment Date</Label>
                      <Input name="nextDate" id="nextDate" type="date" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="status" className="text-zinc-300">Status</Label>
                      <Select name="status" value={createStatus} onValueChange={(v) => setCreateStatus(v || "Active")}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-indigo-500/50">
                          <SelectValue placeholder="Select status">{createStatus}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Paused">Paused (billing on hold)</SelectItem>
                          <SelectItem value="Cancelled">Cancelled (ended)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="size-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Briefcase className="size-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Total Value</p>
            <p className="text-lg font-bold text-white">৳ {stats.totalValue.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="size-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Total Collected</p>
            <p className="text-lg font-bold text-emerald-400">৳ {stats.totalPaid.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="size-10 rounded-full bg-rose-500/10 flex items-center justify-center">
            <Clock className="size-5 text-rose-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Outstanding Due</p>
            <p className="text-lg font-bold text-rose-400">৳ {stats.totalDue.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <CreditCard className="size-5 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium">Active Projects</p>
            <p className="text-lg font-bold text-white">{stats.activeCount}</p>
          </div>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-zinc-100">All Projects</CardTitle>
              <CardDescription className="text-zinc-400">
                {filteredProjects.length} of {projects.length} shown. Click "Add Payment" to record incoming payments.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "All")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[160px]">
                  <SelectValue>{statusFilter === "All" ? "All statuses" : statusFilter}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectItem value="All">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Paused">Paused</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                  placeholder="Search project, service, client..."
                  className="pl-9 bg-zinc-950 border-zinc-800"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="size-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Projects Yet</h3>
              <p className="text-zinc-500 text-sm">Create your first project to start tracking work.</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <Search className="size-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Matches</h3>
              <p className="text-zinc-500 text-sm">No projects match your search/filter.</p>
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-zinc-950/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Service/Project Name</TableHead>
                    <TableHead className="text-zinc-400">Client</TableHead>
                    <TableHead className="text-zinc-400">Billing Type</TableHead>
                    <TableHead className="text-zinc-400">Total</TableHead>
                    <TableHead className="text-zinc-400">Paid</TableHead>
                    <TableHead className="text-zinc-400">Due</TableHead>
                    <TableHead className="text-zinc-400">Next Payment</TableHead>
                    <TableHead className="text-zinc-400">Status</TableHead>
                    <TableHead className="text-zinc-400 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedProjects.map((project) => {
                    const progressPercent = project.amount > 0 ? Math.round((project.paid_amount / project.amount) * 100) : 0
                    const isMine = isOwnProject(project)
                    const canControl = isAdminOrManager || isMine
                    const client = initialClients.find(c => c.id === project.client_id)
                    return (
                    <TableRow key={project.id} className={cn(
                      "border-zinc-800 transition-colors",
                      isStaff && !isMine ? "opacity-60 hover:opacity-80 hover:bg-zinc-800/30" : "hover:bg-zinc-800/50"
                    )}>
                      <TableCell className="font-medium text-zinc-100">
                        <div>{project.name}</div>
                        <div className="text-xs text-zinc-500 font-normal">{project.service}</div>
                      </TableCell>
                      <TableCell className="text-zinc-300">{client?.company || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700">
                          {project.billing_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-300">৳ {(Number(project.amount) || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-emerald-400 font-medium">৳ {(Number(project.paid_amount) || 0).toLocaleString()}</span>
                          <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                progressPercent === 100 ? "bg-emerald-500" : 
                                progressPercent > 50 ? "bg-blue-500" : 
                                progressPercent > 0 ? "bg-amber-500" : "bg-zinc-700"
                              )}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500">{progressPercent}% collected</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-rose-400 font-medium">
                        {(Number(project.due_amount) || 0) > 0 ? `৳ ${(Number(project.due_amount) || 0).toLocaleString()}` : '৳ 0'}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        {formatDate(project.next_payment_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline"
                          className={
                            project.status === 'Active' ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20' :
                            project.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' :
                            project.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20' :
                            project.status === 'Paused' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20' :
                            project.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20' :
                            'text-zinc-400 border-zinc-700 bg-zinc-800/50'
                          }
                        >
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                            onClick={() => {
                              setHistoryProjectId(project.id)
                              setHistoryDialogOpen(true)
                            }}
                          >
                            <History className="size-4" />
                          </Button>
                          {canControl && (
                            <>
                              {(Number(project.due_amount) || 0) > 0 ? (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white"
                                  onClick={() => {
                                    setSelectedProjectId(project.id)
                                    setPaymentDialogOpen(true)
                                  }}
                                >
                                  Add Payment
                                </Button>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                                  Paid
                                </Badge>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-8 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                                onClick={() => {
                                  setIsCustomService(false)
                                  setEditClient(project.client_id || "")
                                  setEditService(project.service || "")
                                  setEditBilling(project.billing_type || "Recurring (Monthly)")
                                  setEditStatus(project.status || "Active")
                                  setEditProject(project)
                                }}
                              >
                                <Edit2 className="size-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                                onClick={() => setDeleteProjectId(project.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                          {!canControl && (
                            <Badge variant="outline" className="bg-zinc-800/50 text-zinc-600 border-zinc-700 text-[10px]">
                              View Only
                            </Badge>
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
            totalItems={filteredProjects.length}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
        setPaymentDialogOpen(open)
        if (!open) setSelectedProjectId(null)
      }}>
        <DialogContent className="sm:max-w-[480px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <form onSubmit={handleRecordPayment}>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Record a payment received from the client.
              </DialogDescription>
            </DialogHeader>

            {selectedProject && (
              <div className="mt-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-300">{selectedProject.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1.5 border-t border-zinc-800/50">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">Total</p>
                    <p className="text-sm font-bold text-zinc-100">৳ {Number(selectedProject.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">Paid</p>
                    <p className="text-sm font-bold text-emerald-400">৳ {Number(selectedProject.paid_amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">Due</p>
                    <p className="text-sm font-bold text-rose-400">৳ {Number(selectedProject.due_amount).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount" className="text-zinc-300">Amount Received (BDT)</Label>
                  <Input 
                    name="amount" 
                    id="amount" 
                    type="number" 
                    placeholder={selectedProject ? `Max ৳${(Number(selectedProject.due_amount) || 0).toLocaleString()}` : "e.g. 5000"}
                    max={selectedProject ? Number(selectedProject.due_amount) : undefined}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" 
                    autoFocus 
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="method" className="text-zinc-300">Payment Method</Label>
                  <Select name="method" defaultValue="Bank Transfer">
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue placeholder="Select method" />
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
                  <Label htmlFor="payDate" className="text-zinc-300">Payment Date</Label>
                  <Input 
                    name="payDate" 
                    id="payDate" 
                    type="date" 
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="billingMonth" className="text-zinc-300">Billing Period</Label>
                  <Input 
                    name="billingMonth" 
                    id="billingMonth" 
                    placeholder="e.g. May 2026"
                    defaultValue={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" 
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nextPaymentDate" className="text-zinc-300">Next Payment Date (optional)</Label>
                <Input 
                  name="nextPaymentDate" 
                  id="nextPaymentDate" 
                  type="date" 
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white w-full" disabled={isLoading}>
                <CreditCard className="size-4 mr-2" />
                {isLoading ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={(open) => {
        setHistoryDialogOpen(open)
        if (!open) setHistoryProjectId(null)
      }}>
        <DialogContent className="sm:max-w-[550px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-indigo-400" />
              Payment History
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              All recorded payments for <span className="text-zinc-200 font-medium">{historyProject?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {projectHistory.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <History className="size-8 mx-auto mb-2 text-zinc-700" />
                <p>No payment history for this project yet.</p>
              </div>
            ) : (
              <div className="rounded-md border border-zinc-800 overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-zinc-950/50 sticky top-0">
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Date</TableHead>
                      <TableHead className="text-zinc-400">Period</TableHead>
                      <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                      <TableHead className="text-zinc-400 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectHistory.map(entry => (
                      <TableRow key={entry.id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell className="text-zinc-300 text-sm">{formatDate(entry.pay_date)}</TableCell>
                        <TableCell className="text-zinc-400 text-sm">{entry.payment_month}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-400">
                          ৳ {Number(entry.paid_amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={
                            entry.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }>
                            {entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Project Dialog */}
      <Dialog open={!!editProject} onOpenChange={(open) => !open && setEditProject(null)}>
        <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100">
          {editProject && (
          <form onSubmit={handleEditProject} key={editProject.id}>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Update the project's details here.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label className="text-zinc-300">Project Name</Label>
                <Input name="projectName" defaultValue={editProject.name} className="bg-zinc-900 border-zinc-800 text-white" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-client" className="text-zinc-300">Client</Label>
                  <Select name="client" value={editClient} onValueChange={(v) => setEditClient(v || "")} required>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectValue placeholder="Select client">{editClient ? getClientLabel(editClient) : "Select client"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[200px]">
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.company})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-service" className="text-zinc-300">Service Type</Label>
                  <Select name="service" value={editService} onValueChange={(val) => { setEditService(val || ""); setIsCustomService(val === 'Custom') }} required>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue>{editService || "Select service"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectItem value="Web Development">Web Development</SelectItem>
                      <SelectItem value="AI Automation">AI Automation</SelectItem>
                      <SelectItem value="Custom Software">Custom Software</SelectItem>
                      <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                      <SelectItem value="SEO Service">SEO Service</SelectItem>
                      <SelectItem value="Custom" className="text-indigo-400 font-medium">Create New Service...</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustomService && (
                    <Input 
                      name="customService" 
                      placeholder="Enter custom service name" 
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 mt-2" 
                      required 
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-billing" className="text-zinc-300">Billing Type</Label>
                  <Select name="billing" value={editBilling} onValueChange={(v) => setEditBilling(v || "Recurring (Monthly)")}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue>{editBilling}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectItem value="Recurring (Monthly)">Recurring (Monthly)</SelectItem>
                      <SelectItem value="One-time">One-time Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-total" className="text-zinc-300">Amount (BDT)</Label>
                  <Input name="total" id="edit-total" type="number" defaultValue={editProject.amount} className="bg-zinc-900 border-zinc-800 text-zinc-100" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-nextDate" className="text-zinc-300">Next Payment Date</Label>
                  <Input name="nextDate" id="edit-nextDate" type="date" defaultValue={editProject.next_payment_date} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-status" className="text-zinc-300">Status</Label>
                  <Select name="status" value={editStatus} onValueChange={(v) => setEditStatus(v || "Active")}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue>{editStatus}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Paused">Paused (billing on hold)</SelectItem>
                      <SelectItem value="Cancelled">Cancelled (ended)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
      <Dialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <AlertCircle className="size-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-3">
              Are you sure you want to delete this project? This will also remove all associated payment history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteProjectId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
