"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Shield, Lock, Mail, User as UserIcon, CheckCircle2, Eye, EyeOff, Save } from "lucide-react"
import { updatePassword, updateOwnProfile } from "@/app/actions/users"
import { toast } from "sonner"

export function ProfileClient({ currentUser }: { currentUser: any }) {
  const router = useRouter()

  const [name, setName] = useState<string>(currentUser?.name || "")
  const [savingName, setSavingName] = useState(false)

  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (name.trim() === currentUser?.name) return
    setSavingName(true)
    const formData = new FormData()
    formData.append("name", name.trim())
    const result = await updateOwnProfile(formData)
    if (result.success) {
      toast.success("Name updated")
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update name")
    }
    setSavingName(false)
  }

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccess(false)
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const result = await updatePassword(formData)
      if (result.success) {
        setSuccess(true)
        form.reset()
      } else {
        setError(result.error || "Failed to update password")
      }
    } catch (err) {
      setError((err as any).message || "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">My Profile</h1>
        <p className="text-zinc-400">Manage your personal account settings.</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Account Information</CardTitle>
          <CardDescription className="text-zinc-400">Update your name. Contact an admin to change your email or role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleNameSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-500 flex items-center gap-2">
                  <UserIcon className="size-3.5" /> Full Name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  required
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-500 flex items-center gap-2">
                  <Shield className="size-3.5" /> Access Role
                </Label>
                <div className="flex pt-1.5">
                  <Badge variant="outline" className={
                    currentUser.role === 'Admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                    currentUser.role === 'Manager' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }>
                    {currentUser.role}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-500 flex items-center gap-2">
                <Mail className="size-3.5" /> Email Address
              </Label>
              <div className="p-2.5 bg-zinc-950/50 border border-zinc-800 rounded-md text-zinc-300">
                {currentUser.email}
              </div>
            </div>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
              disabled={savingName || name.trim() === (currentUser?.name || "") || name.trim().length < 2}
            >
              <Save className="size-4" />
              {savingName ? "Saving..." : "Save Name"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Update Password</CardTitle>
          <CardDescription className="text-zinc-400">Change your login password below. Minimum 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-zinc-300">New Password</Label>
              <div className="relative">
                <Input
                  name="password"
                  id="password"
                  type={showNew ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-zinc-950 border-zinc-800 text-white pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword" className="text-zinc-300">Confirm New Password</Label>
              <div className="relative">
                <Input
                  name="confirmPassword"
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-zinc-950 border-zinc-800 text-white pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                Password updated successfully!
              </div>
            )}

            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" disabled={isLoading}>
              <Lock className="size-4" />
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
