import Link from "next/link"
import {
  AlertTriangle,
  Clock,
  UserX,
  FileCheck2,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatDate } from "@/lib/utils"

type Props = {
  clients: any[]
  projects: any[]
  ledgers: any[]
  isStaffView?: boolean
  currentUserId?: string
}

function daysBetween(dateStr: string, ref: Date = new Date()): number {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 0
  return Math.floor((ref.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function ActionCenter({ clients, projects, ledgers, isStaffView, currentUserId }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  // Scope to own data for Staff
  const scopedProjects = isStaffView && currentUserId
    ? projects.filter((p) => p.created_by === currentUserId)
    : projects
  const scopedClients = isStaffView && currentUserId
    ? clients.filter((c) => c.created_by === currentUserId)
    : clients

  // 1. OVERDUE — projects with next_payment_date in past and due > 0
  const overdue = scopedProjects
    .filter((p) => {
      if (!p.next_payment_date || Number(p.due_amount) <= 0) return false
      const d = new Date(p.next_payment_date)
      return !Number.isNaN(d.getTime()) && d < today
    })
    .map((p) => ({
      ...p,
      client: clients.find((c) => c.id === p.client_id),
      daysOverdue: daysBetween(p.next_payment_date, today),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  // 2. UPCOMING — next_payment_date within next 7 days
  const upcoming = scopedProjects
    .filter((p) => {
      if (!p.next_payment_date || Number(p.due_amount) <= 0) return false
      const d = new Date(p.next_payment_date)
      if (Number.isNaN(d.getTime())) return false
      return d >= today && d <= weekFromNow
    })
    .map((p) => ({
      ...p,
      client: clients.find((c) => c.id === p.client_id),
      daysUntil: Math.max(0, Math.ceil((new Date(p.next_payment_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil)

  // 3. STALE LEADS — Lead status > 30 days old
  const stale = scopedClients
    .filter((c) => c.status === "Lead" && daysBetween(c.created_at, today) > 30)
    .map((c) => ({ ...c, daysOld: daysBetween(c.created_at, today) }))
    .sort((a, b) => b.daysOld - a.daysOld)

  // 4. READY TO INVOICE — Completed projects with outstanding due
  const readyToInvoice = scopedProjects
    .filter((p) => p.status === "Completed" && Number(p.due_amount) > 0)
    .map((p) => ({ ...p, client: clients.find((c) => c.id === p.client_id) }))

  const allEmpty =
    overdue.length === 0 && upcoming.length === 0 && stale.length === 0 && readyToInvoice.length === 0

  if (allEmpty) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-10 text-center">
          <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="size-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-100">All Clear! 🎉</h3>
          <p className="text-sm text-zinc-500 mt-1">
            No overdue payments, no stale leads. Great work — keep it up!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-400" />
            Action Center
          </h2>
          <p className="text-xs text-zinc-500">What needs your attention today.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActionColumn
          tone="rose"
          title="Overdue"
          icon={AlertTriangle}
          count={overdue.length}
          subtitle="Past due date"
          items={overdue.slice(0, 4).map((p) => ({
            title: p.client?.company || "Unknown",
            sub: p.name,
            amount: `৳${(Number(p.due_amount) || 0).toLocaleString()}`,
            meta: `${p.daysOverdue}d overdue`,
            href: `/clients/${p.client_id}`,
          }))}
          totalAmount={overdue.reduce((s, p) => s + (Number(p.due_amount) || 0), 0)}
          ctaHref="/payments"
          ctaLabel="Collect now"
        />

        <ActionColumn
          tone="amber"
          title="Due This Week"
          icon={Clock}
          count={upcoming.length}
          subtitle="Within 7 days"
          items={upcoming.slice(0, 4).map((p) => ({
            title: p.client?.company || "Unknown",
            sub: p.name,
            amount: `৳${(Number(p.due_amount) || 0).toLocaleString()}`,
            meta: p.daysUntil === 0 ? "Today" : `in ${p.daysUntil}d`,
            href: `/clients/${p.client_id}`,
          }))}
          totalAmount={upcoming.reduce((s, p) => s + (Number(p.due_amount) || 0), 0)}
          ctaHref="/payments"
          ctaLabel="View ledger"
        />

        <ActionColumn
          tone="blue"
          title="Stale Leads"
          icon={UserX}
          count={stale.length}
          subtitle=">30 days old"
          items={stale.slice(0, 4).map((c) => ({
            title: c.company,
            sub: c.name,
            amount: "",
            meta: `${c.daysOld}d old`,
            href: `/clients/${c.id}`,
          }))}
          ctaHref="/clients/pipeline"
          ctaLabel="Re-engage"
        />

        <ActionColumn
          tone="emerald"
          title="Ready to Invoice"
          icon={FileCheck2}
          count={readyToInvoice.length}
          subtitle="Completed, due > 0"
          items={readyToInvoice.slice(0, 4).map((p) => ({
            title: p.client?.company || "Unknown",
            sub: p.name,
            amount: `৳${(Number(p.due_amount) || 0).toLocaleString()}`,
            meta: "Completed",
            href: `/clients/${p.client_id}`,
          }))}
          totalAmount={readyToInvoice.reduce((s, p) => s + (Number(p.due_amount) || 0), 0)}
          ctaHref="/payments"
          ctaLabel="Bill client"
        />
      </div>
    </div>
  )
}

function ActionColumn({
  tone,
  title,
  icon: Icon,
  count,
  subtitle,
  items,
  totalAmount,
  ctaHref,
  ctaLabel,
}: {
  tone: "rose" | "amber" | "blue" | "emerald"
  title: string
  icon: any
  count: number
  subtitle: string
  items: Array<{ title: string; sub: string; amount: string; meta: string; href: string }>
  totalAmount?: number
  ctaHref: string
  ctaLabel: string
}) {
  const TONE: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    rose:    { bg: "bg-rose-500/5",    text: "text-rose-400",    border: "border-rose-500/20",    iconBg: "bg-rose-500/10" },
    amber:   { bg: "bg-amber-500/5",   text: "text-amber-400",   border: "border-amber-500/20",   iconBg: "bg-amber-500/10" },
    blue:    { bg: "bg-blue-500/5",    text: "text-blue-400",    border: "border-blue-500/20",    iconBg: "bg-blue-500/10" },
    emerald: { bg: "bg-emerald-500/5", text: "text-emerald-400", border: "border-emerald-500/20", iconBg: "bg-emerald-500/10" },
  }
  const t = TONE[tone]
  const isEmpty = count === 0

  return (
    <Card className={cn("bg-zinc-900 border-zinc-800 flex flex-col", isEmpty && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("size-9 rounded-lg flex items-center justify-center", t.iconBg, t.text)}>
              <Icon className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm text-zinc-100">{title}</CardTitle>
              <p className="text-[10px] text-zinc-500">{subtitle}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs font-bold", t.bg, t.text, t.border)}>
            {count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center py-4">
            <p className="text-xs text-zinc-600 text-center">Nothing here right now.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 flex-1">
              {items.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="block group rounded-lg p-2 -mx-2 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white">
                        {item.title}
                      </p>
                      {item.sub && (
                        <p className="text-[10px] text-zinc-500 truncate">{item.sub}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {item.amount && (
                        <p className={cn("text-xs font-bold", t.text)}>{item.amount}</p>
                      )}
                      <p className="text-[9px] text-zinc-500">{item.meta}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {count > 4 && (
                <p className="text-[10px] text-zinc-500 italic text-center pt-1">
                  +{count - 4} more
                </p>
              )}
            </div>

            <div className={cn("mt-3 pt-3 border-t border-zinc-800")}>
              {totalAmount != null && totalAmount > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total</span>
                  <span className={cn("text-sm font-bold", t.text)}>৳{totalAmount.toLocaleString()}</span>
                </div>
              )}
              <Link
                href={ctaHref}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                  t.bg, t.text, t.border, "border hover:brightness-125",
                )}
              >
                {ctaLabel}
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
