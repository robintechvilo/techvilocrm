import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Target, Star, Activity } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { HeroBar, type Achievement } from "./HeroBar"
import { PrimaryKPIs } from "./PrimaryKPIs"
import { ActionCenter } from "./ActionCenter"
import { MyTasksToday } from "./MyTasksToday"
import { MonthlyReport } from "./MonthlyReport"
import { InsightsSection } from "./InsightsSection"
import { RecentActivity } from "./RecentActivity"

export default async function DashboardPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) return null

  // One parallel round-trip for everything — a sequential extra query here
  // directly adds ~200-400ms TTFB on Vercel↔Supabase latency.
  const [clientsRes, projectsRes, ledgersRes, expensesRes, adSupportRes, invoicesRes, tasksRes] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("ledgers").select("*").order("created_at", { ascending: false }),
    supabase.from("expenses").select("*").order("date", { ascending: false }),
    supabase.from("ad_support").select("*").order("date", { ascending: false }),
    supabase.from("invoices").select("*"), // empty until billing migration runs
    supabase.from("tasks").select("*"),    // empty until tasks migration runs
  ])

  const clients = clientsRes.data || []
  const projects = projectsRes.data || []
  const ledgers = ledgersRes.data || []
  const expenses = expensesRes.data || []
  const adSupport = adSupportRes.data || []
  const invoices = invoicesRes.data || []
  const tasks = tasksRes.data || []

  // ================================
  // STAFF DASHBOARD
  // ================================
  if (currentUser.role === "Staff") {
    const motivationQuotes = [
      "Your hard work today is building the TechVilo of tomorrow!",
      "Success is not final, failure is not fatal: it is the courage to continue that counts.",
      "Every project you finish brings us one step closer to our vision.",
      "Focus on being productive instead of busy.",
      "Small daily improvements are the key to staggering long-term results.",
      "The only way to do great work is to love what you do.",
      "Believe you can and you're halfway there.",
      "Don't stop when you're tired. Stop when you're done.",
    ]
    const motivation = motivationQuotes[Math.floor(Math.random() * motivationQuotes.length)]

    const myAllProjects = projects.filter((p) => p.created_by === currentUser.id)
    const myActive = myAllProjects.filter((p) => p.status === "Active" || p.status === "In Progress")
    const myCompleted = myAllProjects.filter((p) => p.status === "Completed").length

    const myRevenueCollected = ledgers
      .filter((l) => l.created_by === currentUser.id)
      .reduce((sum, l) => sum + (Number(l.paid_amount) || 0), 0)

    const myPortfolioValue = myAllProjects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const myDue = myAllProjects.reduce((sum, p) => sum + (Number(p.due_amount) || 0), 0)
    const successRateNum = myAllProjects.length > 0
      ? Math.round((myCompleted / myAllProjects.length) * 100)
      : 0
    const successRate = `${successRateNum}%`

    // Achievement badge logic — celebrate Staff milestones
    let achievement: Achievement | null = null
    if (myCompleted >= 10) {
      achievement = { label: "Top Performer", tone: "amber", icon: "trophy" }
    } else if (successRateNum === 100 && myCompleted >= 3) {
      achievement = { label: "Perfect Streak", tone: "rose", icon: "flame" }
    } else if (myCompleted >= 5) {
      achievement = { label: "Rising Star", tone: "indigo", icon: "sparkles" }
    }

    // Scoped data for Staff insights
    const myClients = clients.filter((c) => c.created_by === currentUser.id)
    const myLedgers = ledgers.filter((l) => l.created_by === currentUser.id)

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <HeroBar
          name={currentUser.name}
          role="Staff"
          health="neutral"
          showHealth={false}
          motivation={motivation}
          quickActions={["client", "project", "payment"]}
          achievement={achievement}
        />

        {/* 3 Personal KPIs */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Target className="size-4 text-blue-400" /> My Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">{myActive.length}</div>
              <p className="text-xs text-zinc-500 mt-2">
                {myActive.length} projects in progress
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Star className="size-4 text-emerald-400" /> Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">{successRate}</div>
              <p className="text-xs text-zinc-500 mt-2">
                {myCompleted} of {myAllProjects.length} projects completed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Activity className="size-4 text-purple-400" /> Revenue Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-emerald-400">
                ৳{myRevenueCollected.toLocaleString()}
              </div>
              <p className="text-xs text-zinc-500 mt-2">From payments you recorded</p>
            </CardContent>
          </Card>
        </div>

        <MyTasksToday tasks={tasks} clients={clients} userId={currentUser.id} />

        <ActionCenter
          clients={clients}
          projects={projects}
          ledgers={ledgers}
          adSupport={adSupport}
          invoices={invoices}
          tasks={tasks}
          isStaffView
          currentUserId={currentUser.id}
        />

        <div className="grid gap-6 md:grid-cols-2 items-start">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Performance Contribution</CardTitle>
              <CardDescription className="text-zinc-400">
                Based on payments you personally recorded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Revenue Collected</p>
                  <p className="text-2xl font-bold text-emerald-400">৳ {myRevenueCollected.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Outstanding Due</p>
                  <p className="text-2xl font-bold text-rose-400">৳ {myDue.toLocaleString()}</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-300">Your Portfolio Value</p>
                  <p className="text-xs text-zinc-500">Total value of projects you own.</p>
                </div>
                <div className="text-2xl font-black text-indigo-400">
                  ৳ {myPortfolioValue.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">My Projects</CardTitle>
              <CardDescription className="text-zinc-400">
                Your current assigned tasks and goals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myActive.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    No active projects assigned to you yet.
                  </div>
                ) : (
                  myActive.slice(0, 6).map((project) => {
                    const client = clients.find((c) => c.id === project.client_id)
                    return (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-950/30 hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-200 truncate">{project.name}</p>
                          <p className="text-xs text-zinc-500">{client?.company || "N/A"}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0 ml-2"
                        >
                          {project.status}
                        </Badge>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <InsightsSection
          ledgers={myLedgers}
          clients={myClients}
          expenses={[]}
          isStaffView
        />

        <MonthlyReport
          ledgers={ledgers}
          expenses={expenses}
          clients={clients}
          projects={projects}
          adSupport={adSupport}
          isStaffView
          currentUserId={currentUser.id}
        />
      </div>
    )
  }

  // ================================
  // ADMIN / MANAGER DASHBOARD
  // ================================

  const totalRevenue = ledgers.reduce((acc, l) => acc + (Number(l.paid_amount) || 0), 0)
  const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
  const netProfit = totalRevenue - totalExpenses

  // Outstanding due must come from projects (the running totals). Ledger rows
  // are per-installment snapshots — summing them double-counts whenever a
  // month is paid in multiple installments.
  const totalDue = projects.reduce((acc, p) => acc + (Number(p.due_amount) || 0), 0)
  const pendingInvoices = projects.filter((p) => (Number(p.due_amount) || 0) > 0).length

  const activeProjects = projects.filter((p) => p.status === "Active" || p.status === "In Progress").length
  const completedProjects = projects.filter((p) => p.status === "Completed").length

  const totalClients = clients.length
  const activeClients = clients.filter((c) => c.status === "Active").length

  const adSupportUsd = adSupport.reduce((s, a) => s + (Number(a.dollar_amount) || 0), 0)
  const adSupportBdt = adSupport.reduce((s, a) => s + (Number(a.total_bdt) || 0), 0)
  const adSupportDue = adSupport.reduce((s, a) => s + (Number(a.due_amount) || 0), 0)

  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // Compute health state
  let health: "excellent" | "warning" | "critical" | "neutral" = "neutral"
  let healthDetail = ""
  if (totalRevenue === 0 && totalExpenses === 0) {
    health = "neutral"
    healthDetail = "Start adding income and expenses to see your business health."
  } else if (netProfit < 0) {
    health = "critical"
    healthDetail = `Your expenses exceed revenue by ৳${Math.abs(netProfit).toLocaleString()}. Focus on collecting ৳${totalDue.toLocaleString()} in due payments.`
  } else if (profitMargin < 20) {
    health = "warning"
    healthDetail = `Profit margin is only ${profitMargin.toFixed(1)}%. Consider optimizing operational costs.`
  } else {
    health = "excellent"
    healthDetail = `Solid ${profitMargin.toFixed(1)}% profit margin — keep it up!`
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <HeroBar
        name={currentUser.name}
        role={currentUser.role}
        health={health}
        healthDetail={healthDetail}
        quickActions={["client", "project", "payment", "expense"]}
      />

      <PrimaryKPIs
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        netProfit={netProfit}
        totalDue={totalDue}
        pendingInvoices={pendingInvoices}
        activeProjects={activeProjects}
        completedProjects={completedProjects}
        totalClients={totalClients}
        activeClients={activeClients}
        adSupportUsd={adSupportUsd}
        adSupportBdt={adSupportBdt}
        adSupportDue={adSupportDue}
      />

      <MyTasksToday tasks={tasks} clients={clients} userId={currentUser.id} />

      <ActionCenter clients={clients} projects={projects} ledgers={ledgers} adSupport={adSupport} invoices={invoices} tasks={tasks} />

      <MonthlyReport
        ledgers={ledgers}
        expenses={expenses}
        clients={clients}
        projects={projects}
        adSupport={adSupport}
      />

      <InsightsSection ledgers={ledgers} clients={clients} expenses={expenses} />

      <RecentActivity
        ledgers={ledgers}
        expenses={expenses}
        adSupport={adSupport}
        clients={clients}
        projects={projects}
      />
    </div>
  )
}
