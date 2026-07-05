"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, User, Mail, Phone, GripVertical, Lock, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import * as perm from "@/lib/permissions"
import { updateClientStatus } from "@/app/actions/clients"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buttonVariants } from "@/components/ui/button"

const STATUSES = ["Lead", "Active", "Inactive"] as const
type Status = (typeof STATUSES)[number]

export function PipelineClient({ initialClients, currentUser, users }: { initialClients: any[], currentUser: any, users: any[] }) {
  const router = useRouter()

  const isAdminOrManager = perm.isAdminOrManager(currentUser)
  const isStaff = perm.isStaffRole(currentUser)

  const clients = initialClients

  const isOwnClient = (client: any) => perm.isOwner(client, currentUser)
  const getOwnerName = (entity: any) => perm.getOwnerName(entity, users)

  const leads = clients.filter(c => c.status === 'Lead')
  const active = clients.filter(c => c.status === 'Active')
  const inactive = clients.filter(c => c.status === 'Inactive')

  const moveStatus = async (clientId: string, newStatus: string) => {
    const client = clients.find(c => c.id === clientId)
    if (!client) return
    if (isStaff && !isOwnClient(client)) {
      toast.error("Access denied: This is not your client.")
      return
    }
    if (client.status === newStatus) return

    try {
      const result = await updateClientStatus(clientId, newStatus)
      if (result.success) {
        toast.success(`Moved to ${newStatus}`)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to update status")
      }
    } catch (error) {
      toast.error("Failed to update status")
      console.error("Failed to update status:", error)
    }
  }

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    if (isStaff && !isOwnClient(client)) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData("clientId", clientId)
    e.currentTarget.classList.add("opacity-50")
  }

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50")
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const clientId = e.dataTransfer.getData("clientId")
    if (clientId) {
      moveStatus(clientId, newStatus)
    }
  }

  const renderKanbanCard = (client: any, colorClass: string) => {
    const isMine = isOwnClient(client)
    const canControl = isAdminOrManager || isMine
    return (
      <Card
        key={client.id}
        draggable={canControl}
        onDragStart={(e) => handleDragStart(e, client.id)}
        onDragEnd={handleDragEnd}
        className={`bg-zinc-900 border-zinc-800 border-l-2 ${colorClass} shadow-sm transition-colors group ${
          canControl
            ? 'cursor-grab active:cursor-grabbing hover:bg-zinc-800/50'
            : 'cursor-default opacity-60'
        }`}
      >
        <CardContent className="p-2.5">
          <div className="flex items-start justify-between gap-1 mb-1">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-zinc-100 text-xs truncate leading-tight">
                {client.name}
              </div>
              <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1 mt-0.5">
                <User className="size-2.5 shrink-0" />
                <span className="truncate">{client.company}</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {isStaff && !isMine && <Lock className="size-2.5 text-zinc-600" />}
              {canControl && (
                <>
                  {/* Mobile/touch fallback: dropdown to change status */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), "md:hidden size-5 text-zinc-500 hover:text-white")}
                      aria-label="Change status"
                    >
                      <MoreVertical className="size-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <DropdownMenuLabel className="text-xs text-zinc-500">Move to…</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      {STATUSES.filter((s) => s !== client.status).map((s) => (
                        <DropdownMenuItem
                          key={s}
                          className="cursor-pointer focus:bg-zinc-800"
                          onClick={() => moveStatus(client.id, s)}
                        >
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

          {/* Contact info — only for Lead and compact */}
          {client.status === 'Lead' && (client.phone || client.email) && (
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1.5 pt-1.5 border-t border-zinc-800/60">
              {client.phone && (
                <div className="flex items-center gap-1 truncate">
                  <Phone className="size-2.5 shrink-0" />
                  <span className="truncate">{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1 truncate flex-1 min-w-0">
                  <Mail className="size-2.5 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
            </div>
          )}

          {isStaff && (
            <div className="mt-1">
              <span className={cn(
                "text-[9px] font-medium px-1 rounded",
                isMine ? "bg-indigo-500/10 text-indigo-400" : "bg-zinc-800/50 text-zinc-500"
              )}>
                {getOwnerName(client)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderColumn = (title: string, dot: string, status: Status, items: any[], colorClass: string) => (
    <div
      key={status}
      className="flex flex-col gap-2 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 md:overflow-hidden md:min-h-0"
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, status)}
    >
      <div className="flex items-center justify-between px-1 shrink-0">
        <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${dot}`}></span>
          {title}
        </h2>
        <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {items.length}
        </span>
      </div>
      <div className="space-y-1.5 md:overflow-y-auto md:flex-1 md:min-h-0 pr-0.5 custom-scrollbar">
        {items.map((client) => renderKanbanCard(client, colorClass))}
        {items.length === 0 && (
          <div className="h-20 border-2 border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-zinc-600 text-[11px] text-center px-2">
            Drop here or use the menu on a card.
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 md:h-[calc(100vh-6rem)] md:flex md:flex-col">
      <div className="flex items-center gap-3 shrink-0">
        <Button
          onClick={() => router.push("/clients")}
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Lead Pipeline</h1>
          <p className="text-xs md:text-sm text-zinc-400 truncate">
            {isStaff
              ? "Drag your own clients (desktop) or use card menu (mobile)."
              : "Drag and drop to move clients. Mobile: tap menu icon on a card."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3 md:flex-1 md:min-h-0">
        {renderColumn("Leads", "bg-blue-500", "Lead", leads, "border-l-blue-500")}
        {renderColumn("Active", "bg-emerald-500", "Active", active, "border-l-emerald-500")}
        {renderColumn("Inactive / Archived", "bg-zinc-600", "Inactive", inactive, "border-l-zinc-600")}
      </div>
    </div>
  )
}
