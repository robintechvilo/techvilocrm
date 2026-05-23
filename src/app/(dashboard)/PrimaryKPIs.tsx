import Link from "next/link"
import { DollarSign, Receipt, TrendingUp, TrendingDown, CreditCard, Briefcase, Users, Globe, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  totalDue: number
  pendingInvoices: number
  activeProjects: number
  completedProjects: number
  totalClients: number
  activeClients: number
  adSupportUsd: number
  adSupportBdt: number
  adSupportDue: number
  isStaffView?: boolean
}

export function PrimaryKPIs({
  totalRevenue,
  totalExpenses,
  netProfit,
  totalDue,
  pendingInvoices,
  activeProjects,
  completedProjects,
  totalClients,
  activeClients,
  adSupportUsd,
  adSupportBdt,
  adSupportDue,
  isStaffView,
}: Props) {
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0"
  const isProfit = netProfit >= 0

  return (
    <div className="space-y-4">
      {/* 4 PRIMARY FINANCIAL KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          href="/payments"
          label="Total Revenue"
          value={`৳ ${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          tone="emerald"
          subline="All-time gross income"
        />
        {!isStaffView && (
          <KpiCard
            href="/expenses"
            label="Total Expenses"
            value={`৳ ${totalExpenses.toLocaleString()}`}
            icon={Receipt}
            tone="orange"
            subline="All-time operational cost"
          />
        )}
        {!isStaffView && (
          <KpiCard
            label="Net Profit"
            value={`৳ ${netProfit.toLocaleString()}`}
            icon={isProfit ? TrendingUp : TrendingDown}
            tone={isProfit ? "indigo" : "rose"}
            subline={`${profitMargin}% margin`}
            valueClass={isProfit ? "text-emerald-400" : "text-rose-400"}
          />
        )}
        <KpiCard
          href="/payments"
          label="Outstanding Due"
          value={`৳ ${totalDue.toLocaleString()}`}
          icon={CreditCard}
          tone="rose"
          subline={`${pendingInvoices} invoices pending`}
        />
        {isStaffView && (
          <KpiCard
            href="/projects"
            label="Active Projects"
            value={String(activeProjects)}
            icon={Briefcase}
            tone="blue"
            subline={`${completedProjects} completed`}
          />
        )}
      </div>

      {/* 3 SECONDARY STATS */}
      {!isStaffView && (
        <div className="grid gap-3 grid-cols-3">
          <SecondaryStat
            href="/projects"
            label="Active Projects"
            value={activeProjects}
            sub={`${completedProjects} completed`}
            icon={Briefcase}
            color="text-blue-400"
            bg="bg-blue-500/10"
          />
          <SecondaryStat
            href="/clients"
            label="Total Clients"
            value={totalClients}
            sub={`${activeClients} active`}
            icon={Users}
            color="text-purple-400"
            bg="bg-purple-500/10"
          />
          <SecondaryStat
            href="/ad-support"
            label="Ad Support"
            value={`$ ${adSupportUsd.toLocaleString()}`}
            sub={
              adSupportDue > 0
                ? `৳ ${adSupportDue.toLocaleString()} due`
                : `৳ ${adSupportBdt.toLocaleString()} volume`
            }
            icon={Globe}
            color="text-cyan-400"
            bg="bg-cyan-500/10"
            subClass={adSupportDue > 0 ? "text-rose-400" : "text-zinc-500"}
          />
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  subline,
  href,
  valueClass,
}: {
  label: string
  value: string
  icon: any
  tone: "emerald" | "orange" | "indigo" | "rose" | "blue"
  subline?: string
  href?: string
  valueClass?: string
}) {
  const TONE_BG: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    orange:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
    indigo:  "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    rose:    "bg-rose-500/10 text-rose-400 border-rose-500/20",
    blue:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  }
  const TONE_TEXT: Record<string, string> = {
    emerald: "text-emerald-400",
    orange:  "text-orange-400",
    indigo:  "text-indigo-400",
    rose:    "text-rose-400",
    blue:    "text-blue-400",
  }

  const body = (
    <div
      className={cn(
        "group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all relative overflow-hidden",
        href && "hover:border-zinc-700 hover:-translate-y-0.5 cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
        <div className={cn("size-9 rounded-lg border flex items-center justify-center", TONE_BG[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className={cn("text-3xl md:text-4xl font-bold text-white tracking-tight", valueClass)}>{value}</p>
      {subline && (
        <p className={cn("text-[11px] mt-1.5 font-medium flex items-center gap-1", TONE_TEXT[tone])}>
          {tone === "rose" ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
          {subline}
        </p>
      )}
      {href && (
        <ArrowUpRight className="absolute top-3 right-3 size-3.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )

  return href ? <Link href={href}>{body}</Link> : body
}

function SecondaryStat({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
  href,
  subClass,
}: {
  label: string
  value: number | string
  sub: string
  icon: any
  color: string
  bg: string
  href?: string
  subClass?: string
}) {
  const body = (
    <div className="group flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer">
      <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", bg, color)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-white truncate">{value}</p>
        <p className={cn("text-[10px] truncate", subClass || "text-zinc-500")}>{sub}</p>
      </div>
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}
