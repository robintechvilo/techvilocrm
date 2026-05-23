import Link from "next/link"
import { UserPlus, CreditCard, Receipt, Briefcase, AlertTriangle, AlertCircle, TrendingUp, Info, Quote, Trophy, Sparkles, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

type Health = "excellent" | "warning" | "critical" | "neutral"

const HEALTH_META: Record<Health, { dot: string; label: string; icon: any }> = {
  excellent: { dot: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]", label: "Healthy", icon: TrendingUp },
  warning:   { dot: "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]",   label: "Low margin", icon: AlertCircle },
  critical:  { dot: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]",     label: "Critical", icon: AlertTriangle },
  neutral:   { dot: "bg-zinc-500",                                            label: "No data", icon: Info },
}

export type Achievement = {
  label: string
  tone: "amber" | "emerald" | "indigo" | "rose"
  icon?: "trophy" | "sparkles" | "flame"
}

const ACHIEVEMENT_TONE: Record<string, string> = {
  amber:   "bg-amber-500/10 text-amber-400 border-amber-500/30",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  indigo:  "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  rose:    "bg-rose-500/10 text-rose-400 border-rose-500/30",
}

const ACHIEVEMENT_ICON = {
  trophy: Trophy,
  sparkles: Sparkles,
  flame: Flame,
} as const

type Props = {
  name: string
  role: string
  health: Health
  healthDetail?: string
  quickActions?: Array<"client" | "payment" | "expense" | "project">
  motivation?: string
  achievement?: Achievement | null
  showHealth?: boolean
}

const ACTION_META = {
  client:  { href: "/clients",   label: "New Client",     icon: UserPlus,   tone: "indigo" },
  payment: { href: "/payments",  label: "Record Payment", icon: CreditCard, tone: "emerald" },
  expense: { href: "/expenses",  label: "Log Expense",    icon: Receipt,    tone: "orange" },
  project: { href: "/projects",  label: "New Project",    icon: Briefcase,  tone: "blue" },
} as const

const TONE: Record<string, string> = {
  indigo:  "hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/40",
  emerald: "hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/40",
  orange:  "hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/40",
  blue:    "hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/40",
}

export function HeroBar({
  name,
  role,
  health,
  healthDetail,
  quickActions = [],
  motivation,
  achievement,
  showHealth = true,
}: Props) {
  const meta = HEALTH_META[health]
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  const AchievementIcon = achievement?.icon ? ACHIEVEMENT_ICON[achievement.icon] : Trophy

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Welcome side */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{today}</p>
            {showHealth && (
              <>
                <span className="text-zinc-700">•</span>
                <div className="flex items-center gap-1.5" title={healthDetail}>
                  <span className={cn("size-2 rounded-full animate-pulse", meta.dot)} />
                  <span className="text-xs text-zinc-400 font-medium">{meta.label}</span>
                </div>
              </>
            )}
            {achievement && (
              <>
                <span className="text-zinc-700">•</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                    ACHIEVEMENT_TONE[achievement.tone],
                  )}
                >
                  <AchievementIcon className="size-3" />
                  {achievement.label}
                </span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-white">
            Welcome back, {name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5 capitalize">
            <span className="text-zinc-300 font-medium">{role}</span> account •{" "}
            {role === "Staff" ? "your personal performance overview" : "here is your business at a glance"}
          </p>

          {/* Motivation chip — sits below welcome on mobile/desktop, alongside actions */}
          {motivation && (
            <div className="mt-3 inline-flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg max-w-2xl">
              <Quote className="size-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs italic text-indigo-300 leading-snug">&quot;{motivation}&quot;</p>
            </div>
          )}
        </div>

        {/* Right side: quick actions */}
        {quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {quickActions.map((key) => {
              const m = ACTION_META[key]
              const Icon = m.icon
              return (
                <Link
                  key={key}
                  href={m.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950/50 text-zinc-300 text-xs font-medium transition-all",
                    TONE[m.tone],
                  )}
                >
                  <Icon className="size-3.5" />
                  {m.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Critical health banner (only when bad) */}
      {showHealth && health === "critical" && healthDetail && (
        <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <p className="text-xs">{healthDetail}</p>
        </div>
      )}
    </div>
  )
}
