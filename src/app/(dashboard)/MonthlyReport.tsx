"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Users,
  Briefcase,
  Globe,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  ledgers: any[]
  expenses: any[]
  clients: any[]
  projects: any[]
  adSupport: any[]
  isStaffView?: boolean
  currentUserId?: string
}

function inMonth(dateStr: string | null | undefined, year: number, month: number) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return d.getFullYear() === year && d.getMonth() === month
}

export function MonthlyReport({ ledgers, expenses, clients, projects, adSupport, isStaffView, currentUserId }: Props) {
  // Generate last 12 months (most recent first)
  const months = useMemo(() => {
    const arr: { key: string; label: string; shortLabel: string; year: number; month: number }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        shortLabel: d.toLocaleDateString("en-US", { month: "short" }),
        year: d.getFullYear(),
        month: d.getMonth(),
      })
    }
    return arr
  }, [])

  const [selectedKey, setSelectedKey] = useState(months[0].key)
  const selected = months.find((m) => m.key === selectedKey) || months[0]

  // For Staff view, scope data to the user's own records
  const scopedLedgers = isStaffView && currentUserId
    ? ledgers.filter((l) => l.created_by === currentUserId)
    : ledgers
  const scopedExpenses = expenses // expenses are global; Staff usually does not see them anyway
  const scopedClients = isStaffView && currentUserId
    ? clients.filter((c) => c.created_by === currentUserId)
    : clients
  const scopedProjects = isStaffView && currentUserId
    ? projects.filter((p) => p.created_by === currentUserId)
    : projects
  const scopedAdSupport = isStaffView && currentUserId
    ? adSupport.filter((a) => a.created_by === currentUserId)
    : adSupport

  const monthMetrics = useMemo(() => {
    const ml = scopedLedgers.filter((l) =>
      inMonth(l.pay_date || l.created_at, selected.year, selected.month)
    )
    const me = scopedExpenses.filter((e) => inMonth(e.date, selected.year, selected.month))
    const mc = scopedClients.filter((c) => inMonth(c.created_at, selected.year, selected.month))
    const mp = scopedProjects.filter((p) => inMonth(p.created_at, selected.year, selected.month))
    const ma = scopedAdSupport.filter((a) => inMonth(a.date, selected.year, selected.month))

    const revenue = ml.reduce((s, l) => s + (Number(l.paid_amount) || 0), 0)
    const expenseTotal = me.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const netProfit = revenue - expenseTotal

    return {
      revenue,
      expenseTotal,
      netProfit,
      newClients: mc.length,
      newProjects: mp.length,
      paymentCount: ml.length,
      adUsd: ma.reduce((s, a) => s + (Number(a.dollar_amount) || 0), 0),
      adBdt: ma.reduce((s, a) => s + (Number(a.total_bdt) || 0), 0),
    }
  }, [scopedLedgers, scopedExpenses, scopedClients, scopedProjects, scopedAdSupport, selected])

  // Last 6 months trend (oldest first for the chart)
  const trend = useMemo(() => {
    return months
      .slice(0, 6)
      .reverse()
      .map((m) => {
        const rev = scopedLedgers
          .filter((l) => inMonth(l.pay_date || l.created_at, m.year, m.month))
          .reduce((s, l) => s + (Number(l.paid_amount) || 0), 0)
        const exp = scopedExpenses
          .filter((e) => inMonth(e.date, m.year, m.month))
          .reduce((s, e) => s + (Number(e.amount) || 0), 0)
        return { ...m, revenue: rev, expense: exp, profit: rev - exp }
      })
  }, [scopedLedgers, scopedExpenses, months])

  const maxBar = Math.max(...trend.map((t) => Math.max(t.revenue, t.expense)), 1)

  // Compare to previous month
  const previousKey = months[months.findIndex((m) => m.key === selectedKey) + 1]?.key
  const previousMetrics = useMemo(() => {
    if (!previousKey) return null
    const prev = months.find((m) => m.key === previousKey)!
    const rev = scopedLedgers
      .filter((l) => inMonth(l.pay_date || l.created_at, prev.year, prev.month))
      .reduce((s, l) => s + (Number(l.paid_amount) || 0), 0)
    const exp = scopedExpenses
      .filter((e) => inMonth(e.date, prev.year, prev.month))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)
    return { revenue: rev, expense: exp, profit: rev - exp }
  }, [previousKey, scopedLedgers, scopedExpenses, months])

  const pctChange = (current: number, previous: number | undefined) => {
    if (previous == null) return null
    if (previous === 0) return current === 0 ? 0 : 100
    return ((current - previous) / Math.abs(previous)) * 100
  }

  const revenueChange = pctChange(monthMetrics.revenue, previousMetrics?.revenue)
  const expenseChange = pctChange(monthMetrics.expenseTotal, previousMetrics?.expense)
  const profitChange = pctChange(monthMetrics.netProfit, previousMetrics?.profit)

  const isCurrentMonth = selected.key === months[0].key

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Calendar className="size-5 text-indigo-400" />
            Monthly Report
            {isCurrentMonth && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                Live
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {isStaffView
              ? "Your personal monthly performance breakdown."
              : "Pick any month to inspect that month's income, expenses, and growth."}
          </CardDescription>
        </div>
        <div className="w-full sm:w-[220px]">
          <Select value={selectedKey} onValueChange={(v) => setSelectedKey(v || months[0].key)}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
              <SelectValue>{selected.label}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[280px]">
              {months.map((m, idx) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label} {idx === 0 && "(Current)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Headline metrics */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Revenue Collected"
            value={`৳ ${monthMetrics.revenue.toLocaleString()}`}
            icon={DollarSign}
            accent="emerald"
            change={revenueChange}
            higherIsBetter
          />
          <MetricCard
            label="Expenses"
            value={`৳ ${monthMetrics.expenseTotal.toLocaleString()}`}
            icon={Receipt}
            accent="orange"
            change={expenseChange}
            higherIsBetter={false}
            hidden={isStaffView}
          />
          <MetricCard
            label="Net Profit"
            value={`৳ ${monthMetrics.netProfit.toLocaleString()}`}
            icon={monthMetrics.netProfit >= 0 ? TrendingUp : TrendingDown}
            accent={monthMetrics.netProfit >= 0 ? "indigo" : "rose"}
            change={profitChange}
            higherIsBetter
            hidden={isStaffView}
          />
          <MetricCard
            label={isStaffView ? "Your New Clients" : "New Clients"}
            value={String(monthMetrics.newClients)}
            icon={Users}
            accent="purple"
          />
          <MetricCard
            label={isStaffView ? "Your New Projects" : "New Projects"}
            value={String(monthMetrics.newProjects)}
            icon={Briefcase}
            accent="blue"
          />
          <MetricCard
            label="Ad Support"
            value={`$ ${monthMetrics.adUsd.toLocaleString()}`}
            sub={`৳ ${monthMetrics.adBdt.toLocaleString()} volume`}
            icon={Globe}
            accent="cyan"
          />
        </div>

        {/* 6-month bar trend */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-zinc-200">
                {isStaffView ? "My 6-Month Revenue Trend" : "Last 6 Months Trend"}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> Revenue
              </div>
              {!isStaffView && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-orange-500" /> Expense
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-40">
            {trend.map((t) => {
              const revMax = isStaffView ? Math.max(...trend.map((x) => x.revenue), 1) : maxBar
              const revPct = (t.revenue / revMax) * 100
              const expPct = (t.expense / maxBar) * 100
              return (
                <div key={t.key} className="flex flex-col items-center gap-1 h-full">
                  <div className="flex-1 w-full flex items-end justify-center gap-1">
                    <div
                      className={cn(
                        "bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t transition-all hover:brightness-125 relative group",
                        isStaffView ? "w-3/4 max-w-[32px]" : "w-1/2 max-w-[20px]",
                      )}
                      style={{ height: `${revPct}%`, minHeight: t.revenue > 0 ? "4px" : "0" }}
                    >
                      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[9px] text-emerald-400 font-semibold opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                        ৳{t.revenue.toLocaleString()}
                      </span>
                    </div>
                    {!isStaffView && (
                      <div
                        className="w-1/2 max-w-[20px] bg-gradient-to-t from-orange-600 to-orange-400 rounded-t transition-all hover:brightness-125 relative group"
                        style={{ height: `${expPct}%`, minHeight: t.expense > 0 ? "4px" : "0" }}
                      >
                        <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[9px] text-orange-400 font-semibold opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                          ৳{t.expense.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-medium">{t.shortLabel}</div>
                  {isStaffView ? (
                    <div className="text-[10px] font-semibold text-emerald-400">
                      ৳{Math.abs(t.revenue) >= 1000 ? `${Math.round(t.revenue / 1000)}k` : t.revenue}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "text-[10px] font-semibold",
                        t.profit >= 0 ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {t.profit >= 0 ? "+" : ""}৳{Math.abs(t.profit) >= 1000 ? `${Math.round(t.profit / 1000)}k` : t.profit}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  change,
  higherIsBetter,
  hidden,
}: {
  label: string
  value: string
  sub?: string
  icon: any
  accent: "emerald" | "orange" | "indigo" | "rose" | "purple" | "blue" | "cyan"
  change?: number | null
  higherIsBetter?: boolean
  hidden?: boolean
}) {
  if (hidden) return null

  const accentClasses: Record<string, string> = {
    emerald: "from-emerald-500/10 text-emerald-400",
    orange: "from-orange-500/10 text-orange-400",
    indigo: "from-indigo-500/10 text-indigo-400",
    rose: "from-rose-500/10 text-rose-400",
    purple: "from-purple-500/10 text-purple-400",
    blue: "from-blue-500/10 text-blue-400",
    cyan: "from-cyan-500/10 text-cyan-400",
  }

  let changeLabel: string | null = null
  let isPositive: boolean | null = null
  if (change != null && Number.isFinite(change)) {
    const sign = change > 0 ? "+" : ""
    changeLabel = `${sign}${change.toFixed(1)}% vs last month`
    isPositive = higherIsBetter ? change >= 0 : change <= 0
  }

  return (
    <div className="relative rounded-xl bg-zinc-950/50 border border-zinc-800 p-4 overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-50 pointer-events-none", accentClasses[accent].split(" ")[0])} />
      <div className="relative flex items-start justify-between mb-2">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{label}</p>
        <div className={cn("size-7 rounded-lg flex items-center justify-center bg-zinc-900/80", accentClasses[accent].split(" ")[1])}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className="relative">
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
        {changeLabel && (
          <p
            className={cn(
              "text-[10px] mt-1 flex items-center gap-1 font-medium",
              isPositive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {isPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {changeLabel}
          </p>
        )}
      </div>
    </div>
  )
}
