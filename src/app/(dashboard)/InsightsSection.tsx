import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Crown, PieChart, GitBranch, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  ledgers: any[]
  clients: any[]
  expenses: any[]
  isStaffView?: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  Rent:        "bg-rose-500",
  "Software/IT": "bg-blue-500",
  Marketing:   "bg-purple-500",
  Payroll:     "bg-amber-500",
  Other:       "bg-zinc-500",
}

export function InsightsSection({ ledgers, clients, expenses, isStaffView }: Props) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const inThisMonth = (dateStr?: string | null) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return false
    return d.getFullYear() === year && d.getMonth() === month
  }

  // 1. TOP EARNING CLIENTS (this month)
  const clientRevenue = new Map<string, number>()
  ledgers
    .filter((l) => inThisMonth(l.pay_date || l.created_at))
    .forEach((l) => {
      const id = l.client_id
      if (!id) return
      clientRevenue.set(id, (clientRevenue.get(id) || 0) + (Number(l.paid_amount) || 0))
    })
  const topClients = Array.from(clientRevenue.entries())
    .map(([id, amount]) => ({
      client: clients.find((c) => c.id === id),
      amount,
    }))
    .filter((x) => x.client)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const topClientsMax = topClients[0]?.amount || 1

  // 2. EXPENSE BREAKDOWN BY CATEGORY (this month)
  const catSums = new Map<string, number>()
  expenses
    .filter((e) => inThisMonth(e.date))
    .forEach((e) => {
      const cat = e.category || "Other"
      catSums.set(cat, (catSums.get(cat) || 0) + (Number(e.amount) || 0))
    })
  const breakdown = Array.from(catSums.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
  const breakdownTotal = breakdown.reduce((s, x) => s + x.amount, 0)

  // 3. PIPELINE FUNNEL
  const leadCount = clients.filter((c) => c.status === "Lead").length
  const activeCount = clients.filter((c) => c.status === "Active").length
  const inactiveCount = clients.filter((c) => c.status === "Inactive").length
  const totalPipeline = leadCount + activeCount + inactiveCount
  const conversion = leadCount + activeCount > 0
    ? ((activeCount / (leadCount + activeCount)) * 100).toFixed(0)
    : "0"

  const funnelMax = Math.max(leadCount, activeCount, inactiveCount, 1)

  return (
    <div className={cn("grid gap-4", isStaffView ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
      {/* TOP CLIENTS */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-100 flex items-center gap-2 text-base">
            <Crown className="size-4 text-amber-400" />
            {isStaffView ? "My Top Earning Clients" : "Top Earning Clients"}
          </CardTitle>
          <CardDescription className="text-zinc-500 text-xs">
            {isStaffView ? "Your highest revenue clients this month." : "Highest revenue this month."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">
              No payments recorded this month yet.
            </p>
          ) : (
            <div className="space-y-3">
              {topClients.map((tc, idx) => {
                const pct = (tc.amount / topClientsMax) * 100
                return (
                  <Link
                    key={tc.client.id}
                    href={`/clients/${tc.client.id}`}
                    className="block group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "size-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                            idx === 0 && "bg-amber-500/20 text-amber-400",
                            idx === 1 && "bg-zinc-500/20 text-zinc-400",
                            idx === 2 && "bg-orange-700/20 text-orange-400",
                            idx > 2 && "bg-zinc-800 text-zinc-500",
                          )}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white">
                          {tc.client.company}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400 shrink-0">
                        ৳{tc.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* EXPENSE BREAKDOWN — hidden for Staff */}
      {!isStaffView && (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-100 flex items-center gap-2 text-base">
            <PieChart className="size-4 text-orange-400" />
            Expense Breakdown
          </CardTitle>
          <CardDescription className="text-zinc-500 text-xs">
            Where your money went this month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdown.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">
              No expenses recorded this month.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Stacked bar */}
              <div className="h-2.5 flex rounded-full overflow-hidden bg-zinc-800">
                {breakdown.map((b) => (
                  <div
                    key={b.category}
                    className={cn("transition-all", CATEGORY_COLORS[b.category] || "bg-zinc-500")}
                    style={{ width: `${(b.amount / breakdownTotal) * 100}%` }}
                    title={`${b.category}: ৳${b.amount.toLocaleString()}`}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="space-y-2 pt-1">
                {breakdown.map((b) => {
                  const pct = ((b.amount / breakdownTotal) * 100).toFixed(0)
                  return (
                    <div key={b.category} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "size-2.5 rounded-full shrink-0",
                            CATEGORY_COLORS[b.category] || "bg-zinc-500",
                          )}
                        />
                        <span className="text-zinc-300 truncate">{b.category}</span>
                        <span className="text-zinc-600 text-[10px]">{pct}%</span>
                      </div>
                      <span className="font-semibold text-zinc-100 shrink-0">
                        ৳{b.amount.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
              <Link
                href="/expenses"
                className="mt-3 flex items-center justify-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                View all expenses <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* PIPELINE FUNNEL */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-100 flex items-center gap-2 text-base">
            <GitBranch className="size-4 text-purple-400" />
            {isStaffView ? "My Pipeline" : "Pipeline Funnel"}
          </CardTitle>
          <CardDescription className="text-zinc-500 text-xs">
            {totalPipeline > 0
              ? `${conversion}% lead-to-active conversion.`
              : "No clients in pipeline yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <FunnelRow label="Leads" count={leadCount} max={funnelMax} colorClass="bg-blue-500" textClass="text-blue-400" />
            <FunnelRow label="Active" count={activeCount} max={funnelMax} colorClass="bg-emerald-500" textClass="text-emerald-400" />
            <FunnelRow label="Inactive" count={inactiveCount} max={funnelMax} colorClass="bg-zinc-600" textClass="text-zinc-400" />
          </div>
          <Link
            href="/clients/pipeline"
            className="mt-3 flex items-center justify-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Open pipeline board <ArrowRight className="size-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function FunnelRow({
  label,
  count,
  max,
  colorClass,
  textClass,
}: {
  label: string
  count: number
  max: number
  colorClass: string
  textClass: string
}) {
  const pct = (count / max) * 100
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        <span className={cn("text-xs font-bold", textClass)}>{count}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
