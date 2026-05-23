import { redirect } from "next/navigation"
import { getCurrentUser } from "@/app/actions/auth"
import { LoginForm } from "./LoginForm"

export default async function LoginPage() {
  const currentUser = await getCurrentUser()

  if (currentUser) {
    redirect("/")
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden p-4">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="TechVilo Logo" className="h-24 w-auto object-contain mb-2" />
          <p className="text-zinc-400">Welcome back! Please login.</p>
        </div>

        <LoginForm />

        <p className="text-center text-zinc-600 text-xs mt-8">
          &copy; {new Date().getFullYear()} TechVilo Solutions. All rights reserved.
        </p>
      </div>
    </div>
  )
}
