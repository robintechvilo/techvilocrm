"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Search, Menu, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { logout } from "@/app/actions/auth"
import { Sidebar } from "./Sidebar"

// Same role gating as the Sidebar — Staff shouldn't be offered pages
// that only show them an Access Denied screen.
const PAGES = [
  { name: "Dashboard", href: "/", roles: ["Admin", "Manager", "Staff"] },
  { name: "Clients", href: "/clients", roles: ["Admin", "Manager", "Staff"] },
  { name: "Pipeline", href: "/clients/pipeline", roles: ["Admin", "Manager", "Staff"] },
  { name: "Projects", href: "/projects", roles: ["Admin", "Manager", "Staff"] },
  { name: "Tasks", href: "/tasks", roles: ["Admin", "Manager", "Staff"] },
  { name: "Payments", href: "/payments", roles: ["Admin", "Manager", "Staff"] },
  { name: "Ad Support", href: "/ad-support", roles: ["Admin", "Manager", "Staff"] },
  { name: "Invoices", href: "/invoices", roles: ["Admin", "Manager", "Staff"] },
  { name: "Expenses", href: "/expenses", roles: ["Admin", "Manager"] },
  { name: "Team Settings", href: "/settings", roles: ["Admin"] },
  { name: "My Profile", href: "/settings/profile", roles: ["Admin", "Manager", "Staff"] },
]

export function Header({ currentUser }: { currentUser: any }) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [openResults, setOpenResults] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const role = currentUser?.role || ""
    return PAGES.filter((p) => {
      if (!p.roles.includes(role) || !p.name.toLowerCase().includes(q)) return false
      if (p.href === "/invoices" && role === "Staff" && !currentUser?.can_create_invoices) return false
      return true
    })
  }, [query, currentUser?.role, currentUser?.can_create_invoices])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenResults(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  const initials = getInitials(currentUser?.name)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0 text-zinc-400 hover:text-zinc-100"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div ref={wrapRef} className="ml-auto flex-1 sm:flex-initial relative">
            <div className="relative group">
              <Search className="absolute left-2.5 top-2.5 size-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <Input
                type="search"
                placeholder="Quick jump to page..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setOpenResults(true)
                }}
                onFocus={() => setOpenResults(true)}
                className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 pl-9 sm:w-[300px] md:w-[200px] lg:w-[300px] focus-visible:ring-indigo-500/50 rounded-full"
              />
            </div>
            {openResults && results.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 sm:right-auto sm:w-[300px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {results.map((r) => (
                  <button
                    key={r.href}
                    onClick={() => {
                      router.push(r.href)
                      setQuery("")
                      setOpenResults(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Search className="size-3.5 text-zinc-500" />
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            {openResults && query && results.length === 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 sm:right-auto sm:w-[300px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 text-xs text-zinc-500 z-50">
                No matching page.
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full ring-2 ring-transparent focus-visible:ring-indigo-500 transition-all outline-none">
              <Avatar className="size-8 hover:opacity-80 transition-opacity">
                <AvatarImage src={currentUser?.avatar_url} alt={currentUser?.name || "User"} />
                <AvatarFallback className="bg-indigo-500 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800 text-zinc-100">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-semibold">{currentUser?.name}</span>
                  <span className="text-xs text-zinc-500 font-normal">{currentUser?.email}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                onClick={() => router.push("/settings/profile")}
              >
                Profile
              </DropdownMenuItem>
              {currentUser?.role === "Admin" && (
                <DropdownMenuItem
                  className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                  onClick={() => router.push("/settings")}
                >
                  Team Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                onClick={handleLogout}
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 md:hidden animate-in slide-in-from-left duration-300">
            <Sidebar currentUser={currentUser} onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
