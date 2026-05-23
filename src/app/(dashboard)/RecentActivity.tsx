"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Activity, TrendingUp, Receipt, Globe, ArrowRight } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

type Tab = "all" | "income" | "expense" | "ad"

type Props = {
  ledgers: any[]
  expenses: any[]
  adSupport: any[]
  clients: any[]
  projects: any[]
}

export function RecentActivity({ ledgers, expenses, adSupport, clients, projects }: Props) {
  const [tab, setTab] = useState<Tab>("all")

  const items = useMemo(() => {
    const income = ledgers
      .filter((l) => (Number(l.paid_amount) || 0) > 0)
      .map((l) => {
        const project = projects.find((p) => p.id === l.project_id)
        const client = clients.find((c) => c.id === l.client_id)
        return {
          type: "income" as const,
          id: `inc-${l.id}`,
          date: l.pay_date || l.created_at?.split("T")[0],
          title: project?.name || "Payment",
          subtitle: client?.company || "—",
          amount: Number(l.paid_amount) || 0,
          meta: l.payment_month || null,
        }
      })

    const exp = expenses.map((e) => ({
      type: "expense" as const,
      id: `exp-${e.id}`,
      date: e.date || e.created_at?.split("T")[0],
      title: e.description,
      subtitle: e.category || "Other",
      amount: -(Number(e.amount) || 0),
      meta: null,
    }))

    const ad = adSupport.map((a) => {
      const client = clients.find((c) => c.id === a.client_id)
      return {
        type: "ad" as const,
        id: `ad-${a.id}`,
        date: a.date || a.created_at?.split("T")[0],
        title: a.description || `Ad support — $${Number(a.dollar_amount).toLocaleString()}`,
        subtitle: client?.company || "—",
        amount: Number(a.total_bdt) || 0,
        meta: `$${Number(a.dollar_amount).toLocaleString()}`,
      }
    })

    const merged = [...income, ...exp, ...ad].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    )

    return { all: merged, income, expense: exp, ad }
  }, [ledgers, expenses, adSupport, clients, projects])

  const list = (() => {
    switch (tab) {
      case "income":  return items.income
      case "expense": return items.expense
      case "ad":      return items.ad
      default:        return items.all
    }
  })().slice(0, 15)

  const tabs: Array<{ key: Tab; label: string; count: number; icon: any }> = [
    { key: "all",     label: "All",        count: items.all.length,     icon: Activity },
    { key: "income",  label: "Income",     count: items.income.length,  icon: TrendingUp },
    { key: "expense", label: "Expense",    count: items.expense.length, icon: Receipt },
    { key: "ad",      label: "Ad Support", count: items.ad.length,      icon: Globe },
  ]

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Activity className="size-5 text-indigo-400" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Latest financial events across all modules.
            </CardDescription>
          </div>
          <div className="flex gap-1 p-1 bg-zinc-950/50 border border-zinc-800 rounded-lg overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon
              const isActive = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      : "text-zinc-400 hover:text-zinc-200 border border-transparent",
                  )}
                >
                  <Icon className="size-3" />
                  {t.label}
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1 rounded",
                      isActive ? "bg-indigo-500/20" : "bg-zinc-800",
                    )}
                  >
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-sm">No records yet.</div>
        ) : (
          <div className="rounded-md border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950/50">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-[100px]">Date</TableHead>
                  <TableHead className="text-zinc-400">Description</TableHead>
                  <TableHead className="text-zinc-400 hidden md:table-cell">Client / Category</TableHead>
                  <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((item) => {
                  const isIncome = item.type === "income"
                  const isExpense = item.type === "expense"
                  const isAd = item.type === "ad"
                  return (
                    <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <TableCell className="text-zinc-400 text-sm whitespace-nowrap">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell className="font-medium text-zinc-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              isIncome && "bg-emerald-500",
                              isExpense && "bg-orange-500",
                              isAd && "bg-cyan-500",
                            )}
                          />
                          <span className="truncate">{item.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {isExpense ? (
                          <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700 text-[10px]">
                            {item.subtitle}
                          </Badge>
                        ) : (
                          <span className="text-zinc-300 text-sm">{item.subtitle}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div
                          className={cn(
                            "font-semibold text-sm",
                            isIncome && "text-emerald-400",
                            isExpense && "text-orange-400",
                            isAd && "text-cyan-400",
                          )}
                        >
                          {isExpense ? "-" : "+"} ৳{Math.abs(item.amount).toLocaleString()}
                        </div>
                        {item.meta && (
                          <p className="text-[9px] text-zinc-500">{item.meta}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-end mt-3">
          <Link
            href={tab === "expense" ? "/expenses" : tab === "ad" ? "/ad-support" : "/payments"}
            className="text-xs text-zinc-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
