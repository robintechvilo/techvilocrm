"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus, Search, ClipboardList, CalendarDays, Building2, Trash2,
  AlertCircle, MoreVertical, GripVertical, CheckSquare, X, Lock,
} from "lucide-react"
import { toast } from "sonner"
import { cn, formatDate, getInitials } from "@/lib/utils"
import * as perm from "@/lib/permissions"
import { createTask, updateTask, updateTaskStatus, updateTaskChecklist, deleteTask } from "@/app/actions/tasks"

const STATUSES = ["To Do", "Doing", "Done"] as const
type Status = (typeof STATUSES)[number]

const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const

const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-zinc-500",
  Medium: "bg-blue-500",
  High: "bg-amber-500",
  Urgent: "bg-rose-500",
}
const PRIORITY_BADGE: Record<string, string> = {
  Low: "bg-zinc-800/50 text-zinc-400 border-zinc-700",
  Medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  High: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Urgent: "bg-rose-500/10 text-rose-400 border-rose-500/20",
}

type ChecklistItem = { text: string; done: boolean }

export function TasksClient({
  tasks,
  clients,
  projects,
  users,
  currentUser,
  setupNeeded,
}: {
  tasks: any[]
  clients: any[]
  projects: any[]
  users: any[]
  currentUser: any
  setupNeeded: boolean
}) {
  const isManager = perm.isAdminOrManager(currentUser)

  // ---- Filters ----
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")

  const todayISO = new Date().toISOString().split("T")[0]
  const weekEndISO = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split("T")[0]
  })()

  // Does the task's scheduled window touch the given range?
  const inDateRange = (t: any, from: string, to: string) => {
    const s = t.start_date || t.due_date
    const e = t.due_date || t.start_date
    if (!s || !e) return false
    return s <= to && e >= from
  }

  const userName = (id: string) => users.find(u => u.id === id)?.name || "Unknown"
  const clientLabel = (id: string | null) => clients.find(c => c.id === id)?.company || null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter(t => {
      if (clientFilter !== "all" && t.client_id !== clientFilter) return false
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
      if (assigneeFilter !== "all" && !(t.assigned_to || []).includes(assigneeFilter)) return false
      if (dateFilter === "today" && !inDateRange(t, todayISO, todayISO)) return false
      if (dateFilter === "week" && !inDateRange(t, todayISO, weekEndISO)) return false
      if (dateFilter === "overdue" && !(t.due_date && t.due_date < todayISO && t.status !== "Done")) return false
      if (!q) return true
      return (
        String(t.title || "").toLowerCase().includes(q) ||
        String(t.description || "").toLowerCase().includes(q) ||
        String(clientLabel(t.client_id) || "").toLowerCase().includes(q)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, search, clientFilter, priorityFilter, assigneeFilter, dateFilter, clients])

  const columns: Record<Status, any[]> = {
    "To Do": filtered.filter(t => t.status === "To Do"),
    "Doing": filtered.filter(t => t.status === "Doing"),
    "Done": filtered.filter(t => t.status === "Done"),
  }
  const DONE_LIMIT = 15

  // ---- Permissions ----
  const canWorkOn = (t: any) =>
    isManager || t.created_by === currentUser?.id || (t.assigned_to || []).includes(currentUser?.id)
  const canManageTask = (t: any) => isManager || t.created_by === currentUser?.id

  // ---- Board moves ----
  const moveStatus = async (taskId: string, newStatus: Status) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    if (!canWorkOn(task)) {
      toast.error("This task is not assigned to you")
      return
    }
    const res = await updateTaskStatus(taskId, newStatus)
    if (res.success) toast.success(`Moved to ${newStatus}`)
    else toast.error(res.error || "Failed to move task")
  }

  const handleDragStart = (e: React.DragEvent, task: any) => {
    if (!canWorkOn(task)) { e.preventDefault(); return }
    e.dataTransfer.setData("taskId", task.id)
    e.currentTarget.classList.add("opacity-50")
  }
  const handleDragEnd = (e: React.DragEvent) => e.currentTarget.classList.remove("opacity-50")
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent, status: Status) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("taskId")
    if (taskId) moveStatus(taskId, status)
  }

  // ---- Editor dialog ----
  // editorTask: null (closed) | "new" | existing task object
  const [editorTask, setEditorTask] = useState<any | "new" | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isNew = editorTask === "new"
  const editing = editorTask && editorTask !== "new" ? editorTask : null
  const fullEdit = isNew || (editing && canManageTask(editing))

  const [fTitle, setFTitle] = useState("")
  const [fDescription, setFDescription] = useState("")
  const [fClientId, setFClientId] = useState<string>("")
  const [fProjectId, setFProjectId] = useState<string>("")
  const [fAssignees, setFAssignees] = useState<string[]>([])
  const [fStatus, setFStatus] = useState<Status>("To Do")
  const [fPriority, setFPriority] = useState<string>("Medium")
  const [fStartDate, setFStartDate] = useState<string>("")
  const [fDueDate, setFDueDate] = useState<string>("")
  const [fChecklist, setFChecklist] = useState<ChecklistItem[]>([])
  const [newItemText, setNewItemText] = useState("")

  useEffect(() => {
    if (editorTask === null) return
    if (isNew) {
      setFTitle(""); setFDescription(""); setFClientId(""); setFProjectId("")
      setFAssignees(isManager ? [] : [currentUser?.id].filter(Boolean))
      setFStatus("To Do"); setFPriority("Medium"); setFStartDate(""); setFDueDate("")
      setFChecklist([]); setNewItemText("")
    } else if (editing) {
      setFTitle(editing.title || "")
      setFDescription(editing.description || "")
      setFClientId(editing.client_id || "")
      setFProjectId(editing.project_id || "")
      setFAssignees(editing.assigned_to || [])
      setFStatus(editing.status || "To Do")
      setFPriority(editing.priority || "Medium")
      setFStartDate(editing.start_date || "")
      setFDueDate(editing.due_date || "")
      setFChecklist(Array.isArray(editing.checklist) ? editing.checklist : [])
      setNewItemText("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorTask])

  // Projects narrowed by the selected client
  const projectOptions = fClientId
    ? projects.filter(p => p.client_id === fClientId)
    : projects

  // Staff can only pick themselves as assignee
  const assigneeOptions = isManager ? users : users.filter(u => u.id === currentUser?.id)

  const toggleAssignee = (id: string) => {
    setFAssignees(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  const addChecklistItem = () => {
    const text = newItemText.trim()
    if (!text) return
    setFChecklist(prev => [...prev, { text, done: false }])
    setNewItemText("")
  }

  const handleSave = async () => {
    if (!fTitle.trim()) return toast.error("Give the task a title")
    if (fStartDate && fDueDate && fDueDate < fStartDate) {
      return toast.error("Due date can't be before the start date")
    }
    setSaving(true)

    // Assignee-only editors just sync status + checklist
    if (editing && !fullEdit) {
      const r1 = await updateTaskStatus(editing.id, fStatus)
      const r2 = await updateTaskChecklist(editing.id, JSON.stringify(fChecklist))
      if (r1.success && r2.success) {
        toast.success("Task updated")
        setEditorTask(null)
      } else {
        toast.error(r1.error || r2.error || "Failed to update task")
      }
      setSaving(false)
      return
    }

    const formData = new FormData()
    formData.append("title", fTitle.trim())
    formData.append("description", fDescription)
    formData.append("clientId", fClientId)
    formData.append("projectId", fProjectId)
    formData.append("assignedTo", JSON.stringify(fAssignees))
    formData.append("checklist", JSON.stringify(fChecklist))
    formData.append("status", fStatus)
    formData.append("priority", fPriority)
    formData.append("startDate", fStartDate)
    formData.append("dueDate", fDueDate)

    const res = isNew ? await createTask(formData) : await updateTask(editing.id, formData)
    if (res.success) {
      toast.success(isNew ? "Task created" : "Task updated")
      setEditorTask(null)
    } else {
      toast.error(res.error || "Failed to save task")
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setSaving(true)
    const res = await deleteTask(deleteId)
    if (res.success) {
      toast.success("Task deleted")
      setDeleteId(null)
      setEditorTask(null)
    } else {
      toast.error(res.error || "Failed to delete task")
    }
    setSaving(false)
  }

  const todayStr = new Date().toISOString().split("T")[0]
  const isOverdue = (t: any) => t.due_date && t.due_date < todayStr && t.status !== "Done"

  // ---- Card ----
  const renderCard = (task: any) => {
    const list: ChecklistItem[] = Array.isArray(task.checklist) ? task.checklist : []
    const doneCount = list.filter(i => i.done).length
    const company = clientLabel(task.client_id)
    const workable = canWorkOn(task)
    return (
      <Card
        key={task.id}
        draggable={workable}
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        onClick={() => setEditorTask(task)}
        className={cn(
          "bg-zinc-900 border-zinc-800 shadow-sm transition-colors group cursor-pointer hover:bg-zinc-800/50",
          isOverdue(task) && "border-l-2 border-l-rose-500",
          workable ? "active:cursor-grabbing" : "opacity-70",
        )}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-start gap-1.5 min-w-0">
              <span className={cn("size-2 rounded-full mt-1.5 shrink-0", PRIORITY_DOT[task.priority] || PRIORITY_DOT.Medium)} />
              <p className="text-sm font-medium text-zinc-100 leading-snug">{task.title}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {!workable && <Lock className="size-3 text-zinc-600" />}
              {workable && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), "md:hidden size-5 text-zinc-500 hover:text-white")}
                      aria-label="Move task"
                    >
                      <MoreVertical className="size-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <DropdownMenuLabel className="text-xs text-zinc-500">Move to…</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      {STATUSES.filter(s => s !== task.status).map(s => (
                        <DropdownMenuItem key={s} className="cursor-pointer focus:bg-zinc-800" onClick={() => moveStatus(task.id, s)}>
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <GripVertical className="hidden md:block size-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </div>
          </div>

          {(company || task.due_date || task.start_date || list.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              {company && (
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/60 border border-zinc-800 rounded px-1.5 py-0.5 max-w-[140px]">
                  <Building2 className="size-2.5 shrink-0" />
                  <span className="truncate">{company}</span>
                </span>
              )}
              {(task.start_date || task.due_date) && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border",
                  isOverdue(task)
                    ? "text-rose-400 bg-rose-500/10 border-rose-500/20 font-semibold"
                    : "text-zinc-400 bg-zinc-800/60 border-zinc-800",
                )}>
                  <CalendarDays className="size-2.5" />
                  {task.start_date && task.due_date
                    ? `${formatDate(task.start_date)} → ${formatDate(task.due_date)}`
                    : task.due_date
                      ? `Due ${formatDate(task.due_date)}`
                      : `Starts ${formatDate(task.start_date)}`}
                </span>
              )}
              {list.length > 0 && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border",
                  doneCount === list.length
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-zinc-400 bg-zinc-800/60 border-zinc-800",
                )}>
                  <CheckSquare className="size-2.5" />
                  {doneCount}/{list.length}
                </span>
              )}
            </div>
          )}

          {(task.assigned_to || []).length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {(task.assigned_to || []).slice(0, 4).map((id: string) => (
                <span
                  key={id}
                  title={userName(id)}
                  className="size-5 rounded-full bg-indigo-500 ring-2 ring-zinc-900 flex items-center justify-center text-[8px] font-bold text-white"
                >
                  {getInitials(userName(id))}
                </span>
              ))}
              {(task.assigned_to || []).length > 4 && (
                <span className="size-5 rounded-full bg-zinc-700 ring-2 ring-zinc-900 flex items-center justify-center text-[8px] font-bold text-zinc-300">
                  +{(task.assigned_to || []).length - 4}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderColumn = (title: Status, dot: string, items: any[]) => {
    const visible = title === "Done" ? items.slice(0, DONE_LIMIT) : items
    return (
      <div
        key={title}
        className="flex flex-col gap-2 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 md:overflow-hidden md:min-h-0"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, title)}
      >
        <div className="flex items-center justify-between px-1 shrink-0">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full", dot)} />
            {title}
          </h2>
          <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {items.length}
          </span>
        </div>
        <div className="space-y-1.5 md:overflow-y-auto md:flex-1 md:min-h-0 pr-0.5 custom-scrollbar">
          {visible.map(renderCard)}
          {title === "Done" && items.length > DONE_LIMIT && (
            <p className="text-[10px] text-zinc-600 italic text-center pt-1">
              +{items.length - DONE_LIMIT} older done tasks (use filters to find them)
            </p>
          )}
          {items.length === 0 && (
            <div className="h-20 border-2 border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-zinc-600 text-[11px] text-center px-2">
              Drop here or use the card menu.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 md:h-[calc(100vh-6rem)] md:flex md:flex-col">
      {/* Header + filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ClipboardList className="size-6 text-indigo-400" /> Tasks
          </h1>
          <p className="text-zinc-400 text-sm">
            {isManager ? "Assign work, track progress across the team." : "Your assigned work — drag between columns as you go."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {isManager && (
            <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v || "all")}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[150px]">
                <SelectValue>{assigneeFilter === "all" ? "All assignees" : userName(assigneeFilter)}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[240px]">
                <SelectItem value="all">All assignees</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={clientFilter} onValueChange={(v) => setClientFilter(v || "all")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[150px]">
              <SelectValue>{clientFilter === "all" ? "All clients" : clientLabel(clientFilter) || "All clients"}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[240px]">
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v || "all")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[130px]">
              <SelectValue>
                {dateFilter === "all" ? "All dates"
                  : dateFilter === "today" ? "Today"
                  : dateFilter === "week" ? "This week"
                  : "Overdue"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v || "all")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[130px]">
              <SelectValue>{priorityFilter === "all" ? "All priority" : priorityFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              <SelectItem value="all">All priority</SelectItem>
              {PRIORITIES.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <Input
              placeholder="Search tasks..."
              className="pl-9 bg-zinc-950 border-zinc-800"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shrink-0"
            onClick={() => setEditorTask("new")}
          >
            <Plus className="size-4" />
            New Task
          </Button>
        </div>
      </div>

      {setupNeeded && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-2 shrink-0">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>
            Tasks table not found — run <span className="font-mono text-amber-200">SUPABASE_TASKS.sql</span> on your
            database (SQL Editor) to activate this module.
          </span>
        </div>
      )}

      {/* Board */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3 md:flex-1 md:min-h-0">
        {renderColumn("To Do", "bg-blue-500", columns["To Do"])}
        {renderColumn("Doing", "bg-amber-500", columns["Doing"])}
        {renderColumn("Done", "bg-emerald-500", columns["Done"])}
      </div>

      {/* ---- Task editor dialog ---- */}
      <Dialog open={editorTask !== null} onOpenChange={(open) => !open && setEditorTask(null)}>
        <DialogContent className="sm:max-w-[640px] bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-indigo-400" />
              {isNew ? "New Task" : fullEdit ? "Edit Task" : "Task Details"}
            </DialogTitle>
            {!isNew && editing && (
              <DialogDescription className="text-zinc-500 text-xs">
                Created by {userName(editing.created_by)} · {formatDate(editing.created_at)}
                {!fullEdit && " — you can update the status and checklist"}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label className="text-zinc-300">Title</Label>
              <Input
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                disabled={!fullEdit}
                placeholder="e.g. Setup Facebook pixel for CodoTech"
                className="bg-zinc-900 border-zinc-800 text-white font-medium disabled:opacity-70"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-zinc-300">Details</Label>
              <textarea
                value={fDescription}
                onChange={(e) => setFDescription(e.target.value)}
                disabled={!fullEdit}
                rows={4}
                placeholder="Write the full brief — requirements, links, notes..."
                className="w-full rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y disabled:opacity-70"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-zinc-300">Client <span className="text-zinc-600 text-xs">(optional)</span></Label>
                <Select value={fClientId || "none"} onValueChange={(v) => { setFClientId(v === "none" ? "" : (v || "")); setFProjectId("") }} disabled={!fullEdit}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 disabled:opacity-70">
                    <SelectValue>{fClientId ? clientLabel(fClientId) || "Select" : "Internal / None"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[220px]">
                    <SelectItem value="none">Internal / None</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-zinc-300">Project <span className="text-zinc-600 text-xs">(optional)</span></Label>
                <Select value={fProjectId || "none"} onValueChange={(v) => setFProjectId(v === "none" ? "" : (v || ""))} disabled={!fullEdit}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 disabled:opacity-70">
                    <SelectValue>{fProjectId ? projects.find(p => p.id === fProjectId)?.name || "Select" : "None"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[220px]">
                    <SelectItem value="none">None</SelectItem>
                    {projectOptions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-zinc-300">Status</Label>
                <Select value={fStatus} onValueChange={(v) => setFStatus((v as Status) || "To Do")}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectValue>{fStatus}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-zinc-300">Priority</Label>
                <Select value={fPriority} onValueChange={(v) => setFPriority(v || "Medium")} disabled={!fullEdit}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 disabled:opacity-70">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", PRIORITY_DOT[fPriority])} />
                        {fPriority}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", PRIORITY_DOT[p])} />
                          {p}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-zinc-300">
                  Start Date <span className="text-zinc-600 text-xs">(which day to work on it)</span>
                </Label>
                <Input
                  type="date"
                  value={fStartDate}
                  onChange={(e) => setFStartDate(e.target.value)}
                  disabled={!fullEdit}
                  className="bg-zinc-900 border-zinc-800 text-white disabled:opacity-70"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-zinc-300">
                  Due Date <span className="text-zinc-600 text-xs">(finish by)</span>
                </Label>
                <Input
                  type="date"
                  value={fDueDate}
                  onChange={(e) => setFDueDate(e.target.value)}
                  min={fStartDate || undefined}
                  disabled={!fullEdit}
                  className="bg-zinc-900 border-zinc-800 text-white disabled:opacity-70"
                />
              </div>
            </div>

            {/* Assignees — toggle chips */}
            <div className="grid gap-2">
              <Label className="text-zinc-300">
                Assign To{" "}
                {!isManager && <span className="text-zinc-600 text-xs">(you can only assign yourself)</span>}
              </Label>
              <div className="flex flex-wrap gap-2">
                {assigneeOptions.map(u => {
                  const selected = fAssignees.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!fullEdit}
                      onClick={() => toggleAssignee(u.id)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-70 disabled:cursor-default",
                        selected
                          ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/40"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600",
                      )}
                    >
                      <span className={cn(
                        "size-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white",
                        selected ? "bg-indigo-500" : "bg-zinc-700",
                      )}>
                        {getInitials(u.name)}
                      </span>
                      {u.name}
                      {selected && <X className="size-3 opacity-60" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Checklist */}
            <div className="grid gap-2">
              <Label className="text-zinc-300 flex items-center gap-2">
                <CheckSquare className="size-3.5 text-indigo-400" />
                Checklist
                {fChecklist.length > 0 && (
                  <span className="text-zinc-500 text-xs font-normal">
                    {fChecklist.filter(i => i.done).length}/{fChecklist.length} done
                  </span>
                )}
              </Label>
              {fChecklist.length > 0 && (
                <div className="space-y-1.5">
                  {fChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 group/item">
                      <button
                        type="button"
                        onClick={() => setFChecklist(prev => prev.map((it, i) => i === idx ? { ...it, done: !it.done } : it))}
                        className={cn(
                          "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          item.done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-zinc-600 hover:border-zinc-400",
                        )}
                      >
                        {item.done && <CheckSquare className="size-3" />}
                      </button>
                      <span className={cn("text-sm flex-1", item.done ? "text-zinc-500 line-through" : "text-zinc-200")}>
                        {item.text}
                      </span>
                      {fullEdit && (
                        <button
                          type="button"
                          onClick={() => setFChecklist(prev => prev.filter((_, i) => i !== idx))}
                          className="text-zinc-600 hover:text-rose-400 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {fullEdit && (
                <div className="flex gap-2">
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addChecklistItem() }
                    }}
                    placeholder="Add checklist item — press Enter"
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 shrink-0"
                    onClick={addChecklistItem}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <div>
              {!isNew && editing && canManageTask(editing) && (
                <Button
                  variant="ghost"
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5"
                  onClick={() => setDeleteId(editing.id)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditorTask(null)} className="text-zinc-400 hover:text-white">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {saving ? "Saving..." : isNew ? "Create Task" : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <AlertCircle className="size-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-3">
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving} className="bg-rose-600 hover:bg-rose-500 text-white">
              {saving ? "Deleting..." : "Delete Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
