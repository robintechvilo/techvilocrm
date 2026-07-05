"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CreditCard,
  Settings,
  ChevronRight,
  Receipt,
  Kanban,
  LogOut,
  Globe,
  User as UserIcon,
} from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { logout } from "@/app/actions/auth"

type Role = "Admin" | "Manager" | "Staff"

const navigation = [
  { name: 'Dashboard',     href: '/',                  icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Staff'] as Role[] },
  { name: 'Clients',       href: '/clients',           icon: Users,           roles: ['Admin', 'Manager', 'Staff'] as Role[] },
  { name: 'Pipeline',      href: '/clients/pipeline',  icon: Kanban,          roles: ['Admin', 'Manager', 'Staff'] as Role[] },
  { name: 'Projects',      href: '/projects',          icon: Briefcase,       roles: ['Admin', 'Manager', 'Staff'] as Role[] },
  { name: 'Payments',      href: '/payments',          icon: CreditCard,      roles: ['Admin', 'Manager', 'Staff'] as Role[] },
  { name: 'Ad Support',    href: '/ad-support',        icon: Globe,           roles: ['Admin', 'Manager', 'Staff'] as Role[] },
  { name: 'Expenses',      href: '/expenses',          icon: Receipt,         roles: ['Admin', 'Manager'] as Role[] },
  { name: 'Team Settings', href: '/settings',          icon: Settings,        roles: ['Admin'] as Role[] },
  { name: 'My Profile',    href: '/settings/profile',  icon: UserIcon,        roles: ['Admin', 'Manager', 'Staff'] as Role[] },
]

export function Sidebar({ currentUser, onNavigate }: { currentUser: any; onNavigate?: () => void }) {
  const pathname = usePathname()
  const userRole = (currentUser?.role as Role) || ''
  const filteredNavigation = navigation.filter((item) => item.roles.includes(userRole as Role))

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-zinc-950 border-r border-zinc-800 text-zinc-100 transition-all duration-300 relative z-40">
      <div className="flex h-16 items-center px-6 border-b border-zinc-800">
        <Link href="/" className="flex items-center" onClick={onNavigate}>
          <img src="/logo.png" alt="TechVilo Logo" className="h-10 w-auto object-contain" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="space-y-1">
          {filteredNavigation.map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "size-5 transition-colors duration-200",
                      isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                  />
                  {item.name}
                </div>
                {isActive && <ChevronRight className="size-4 opacity-50" />}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-3">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-indigo-500/20 p-3">
          <div className="flex items-center gap-3 mb-3">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt=""
                className="size-8 rounded-full bg-zinc-800 ring-2 ring-indigo-500/20 object-cover"
              />
            ) : (
              <div className="size-8 rounded-full bg-indigo-500 ring-2 ring-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {getInitials(currentUser?.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{currentUser?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-lg transition-all cursor-pointer"
          >
            <LogOut className="size-3.5" />
            Logout
          </button>
        </div>

        <div className="flex items-center gap-2 px-2 text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
          <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
          Systems Online
        </div>
      </div>
    </div>
  )
}
