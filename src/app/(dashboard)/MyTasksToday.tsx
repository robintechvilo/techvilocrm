import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, ArrowRight, AlertTriangle } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-zinc-500",
  Medium: "bg-blue-500",
  High: "bg-amber-500",
  Urgent: "bg-rose-500",
}

// Personal "what should I work on today" widget for the dashboard.
// Shows the current user's overdue tasks + tasks scheduled for today.
// Renders nothing when there's nothing to show.
export function MyTasksToday({
  tasks,
  clients,
  userId,
}: {
  tasks: any[]
  clients: any[]
  userId: string
}) {
  const today = new Date().toISOString().split("T")[0]

  const mine = tasks.filter(
    (t) =>
      t.status !== "Done" &&
      ((t.assigned_to || []).includes(userId) || t.created_by === userId),
  )

  const isOverdue = (t: any) => t.due_date && t.due_date < today
  const isToday = (t: any) => {
    if (isOverdue(t)) return false
    const s = t.start_date || t.due_date
    const e = t.due_date || t.start_date
    if (!s || !e) return false
    return s <= today && e >= today
  }

  const overdue = mine.filter(isOverdue).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
  const todays = mine.filter(isToday)
  const items = [...overdue, ...todays].slice(0, 6)

  if (items.length === 0) return null

  const companyOf = (id: string | null) =>
    clients.find((c) => c.id === id)?.company || null

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-zinc-100 flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-indigo-400" />
              My Tasks Today
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Your work scheduled for today{overdue.length > 0 ? " — plus what slipped" : ""}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {overdue.length > 0 && (
              <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">
                {overdue.length} overdue
              </Badge>
            )}
            {todays.length > 0 && (
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px]">
                {todays.length} today
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {items.map((t) => {
            const company = companyOf(t.client_id)
            const late = isOverdue(t)
            return (
              <Link
                key={t.id}
                href="/tasks"
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={cn("size-2 rounded-full shrink-0", PRIORITY_DOT[t.priority] || PRIORITY_DOT.Medium)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white">{t.title}</p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {company || "Internal"} · {t.status}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {late ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400">
                      <AlertTriangle className="size-3" />
                      {formatDate(t.due_date)}
                    </span>
                  ) : t.due_date ? (
                    <span className="text-[10px] text-zinc-500">Due {formatDate(t.due_date)}</span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">Today</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
        <Link
          href="/tasks"
          className="mt-3 flex items-center justify-center gap-1 text-[10px] text-zinc-500 hover:text-indigo-400 transition-colors"
        >
          Open task board <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
