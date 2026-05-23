import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { getCurrentUser } from "@/app/actions/auth"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect("/admin")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 selection:bg-indigo-500/30">
      <div className="hidden md:flex">
        {/* Pass currentUser if Sidebar needs it, or fetch inside Sidebar if it becomes a Server Component */}
        <Sidebar currentUser={currentUser} />
      </div>
      <div className="flex w-0 flex-1 flex-col">
        <Header currentUser={currentUser} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-950/50 p-6">
          <div className="mx-auto max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
