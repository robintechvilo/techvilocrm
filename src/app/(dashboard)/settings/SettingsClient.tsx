"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UserPlus, Shield, UserCog, User, Trash2, AlertTriangle, Key, Eye, EyeOff, FileText, Building2, Save } from "lucide-react"
import { toast } from "sonner"
import { cn, getInitials } from "@/lib/utils"
import { updateUserRole, deleteUser, createTeamMember } from "@/app/actions/users"
import { toggleInvoiceAccess, saveCompanySettings } from "@/app/actions/invoices"

export function SettingsClient({ users, currentUser, companySettings }: { users: any[], currentUser: any, companySettings: any }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; role: string } | null>(null)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; name: string } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newRole, setNewRole] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [newMemberRole, setNewMemberRole] = useState<string>("Staff")
  const [isLoading, setIsLoading] = useState(false)

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
            <Shield className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-zinc-400 max-w-xs">You do not have permission to access the team management settings.</p>
        </div>
      </div>
    )
  }

  const handleAddUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const result = await createTeamMember(formData)
      if (result.success) {
        toast.success("Team member added successfully")
        setIsDialogOpen(false)
        form.reset()
      } else {
        toast.error(result.error || "Failed to add member")
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred")
      console.error("Failed to add member:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleChange = async () => {
    if (editingUser && newRole) {
      setIsLoading(true)
      try {
        const result = await updateUserRole(editingUser.id, newRole)
        if (result.success) {
          toast.success("User role updated")
          setEditRoleDialogOpen(false)
          setEditingUser(null)
          setNewRole("")
        } else {
          toast.error(result.error || "Failed to update role")
        }
      } catch (error: any) {
        toast.error("An unexpected error occurred")
        console.error("Failed to update role:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleInvoiceToggle = async (userId: string, allowed: boolean) => {
    setIsLoading(true)
    try {
      const result = await toggleInvoiceAccess(userId, allowed)
      if (result.success) toast.success(allowed ? "Invoice access granted" : "Invoice access removed")
      else toast.error(result.error || "Failed to change invoice access")
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompanySave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const result = await saveCompanySettings(formData)
      if (result.success) toast.success("Company details saved")
      else toast.error(result.error || "Failed to save company details")
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    if (deleteConfirmUser) {
      setIsLoading(true)
      try {
        const result = await deleteUser(deleteConfirmUser.id)
        if (result.success) {
          toast.success("User deleted successfully")
          setDeleteDialogOpen(false)
          setDeleteConfirmUser(null)
        } else {
          toast.error(result.error || "Failed to delete user")
        }
      } catch (error: any) {
        toast.error("An unexpected error occurred")
        console.error("Failed to delete user:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Team Settings</h1>
          <p className="text-zinc-400">Manage your team members and their access levels.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" />}>
              <UserPlus className="size-4" />
              Add Member
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
            <form onSubmit={handleAddUserSubmit}>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Create a new account instantly. The member can change their password after login.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-zinc-300">Full Name</Label>
                  <Input name="name" id="name" placeholder="e.g. Arif Ahmed" className="bg-zinc-900 border-zinc-800 text-white" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-zinc-300">Email Address</Label>
                  <Input name="email" id="email" type="email" placeholder="arif@techvilo.com" className="bg-zinc-900 border-zinc-800 text-white" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-zinc-300">Temporary Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 size-4 text-zinc-500" />
                    <Input
                      name="password"
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      minLength={8}
                      className="bg-zinc-900 border-zinc-800 text-white pl-9 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role" className="text-zinc-300">Access Role</Label>
                  <Select name="role" value={newMemberRole} onValueChange={(v) => setNewMemberRole(v || "Staff")}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue>{newMemberRole}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                      <SelectItem value="Manager">Manager (Business Access)</SelectItem>
                      <SelectItem value="Staff">Staff (Personal KPI Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white w-full" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">All Team Members</CardTitle>
            <CardDescription className="text-zinc-400">List of active users in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-zinc-950/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">User</TableHead>
                    <TableHead className="text-zinc-400">Role</TableHead>
                    <TableHead className="text-zinc-400">Email</TableHead>
                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <TableCell className="font-medium text-zinc-100">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.name} className="size-8 rounded-full bg-zinc-800 object-cover" />
                          ) : (
                            <div className="size-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {getInitials(user.name)}
                            </div>
                          )}
                          <span>{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          user.role === 'Admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          user.role === 'Manager' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-400">{user.email}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {user.role === 'Staff' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isLoading}
                              title={user.can_create_invoices ? "Invoice access ON — click to remove" : "Invoice access OFF — click to grant"}
                              className={cn(
                                "h-8 gap-1.5 text-xs",
                                user.can_create_invoices
                                  ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 hover:text-indigo-300"
                                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                              )}
                              onClick={() => handleInvoiceToggle(user.id, !user.can_create_invoices)}
                            >
                              <FileText className="size-3.5" />
                              {user.can_create_invoices ? "Invoices: On" : "Invoices: Off"}
                            </Button>
                          )}
                          {user.id !== currentUser.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-zinc-500 hover:text-white hover:bg-zinc-800"
                                onClick={() => {
                                  setEditingUser({ id: user.id, name: user.name, role: user.role })
                                  setNewRole(user.role)
                                  setEditRoleDialogOpen(true)
                                }}
                              >
                                <UserCog className="size-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                                onClick={() => {
                                  setDeleteConfirmUser({ id: user.id, name: user.name })
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                          {user.id === currentUser.id && (
                            <Badge variant="outline" className="bg-zinc-800/50 text-zinc-500 border-zinc-700 text-[10px]">
                              You
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-zinc-900 border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold">
              <Shield className="size-5" /> Admin
            </div>
            <p className="text-xs text-zinc-400">Full access to all modules including finance, settings, and user management.</p>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <UserCog className="size-5" /> Manager
            </div>
            <p className="text-xs text-zinc-400">Access to global dashboard and client data. Cannot manage other users.</p>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-zinc-400 font-bold">
              <User className="size-5" /> Staff
            </div>
            <p className="text-xs text-zinc-400">Limited to personal KPI dashboard and their assigned projects. No global finance visibility.</p>
          </Card>
        </div>

        {/* Company details — the "Billed By" block + bank info on invoices */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Building2 className="size-5 text-indigo-400" />
              Company Details (Invoices)
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Used as the &quot;Billed By&quot; block and default bank details on every invoice PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!companySettings && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                Settings table not found — run <span className="font-mono">SUPABASE_INVOICES.sql</span> first, then reload this page.
              </div>
            )}
            <form onSubmit={handleCompanySave} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Company Name</Label>
                  <Input name="name" defaultValue={companySettings?.name || "Techvilo Ltd"} className="bg-zinc-950 border-zinc-800 text-white" required />
                </div>
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Phone</Label>
                  <Input name="phone" defaultValue={companySettings?.phone || ""} className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Email</Label>
                  <Input name="email" type="email" defaultValue={companySettings?.email || ""} className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-zinc-300">Address</Label>
                <textarea
                  name="address"
                  rows={3}
                  defaultValue={companySettings?.address || ""}
                  className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-zinc-300">
                  Invoice Logo URL{" "}
                  <span className="text-zinc-500 text-xs">
                    (light-background version — e.g. /logo-invoice.png after placing the file in the public folder)
                  </span>
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    name="logo_url"
                    defaultValue={companySettings?.logo_url || "/logo.png"}
                    placeholder="/logo-invoice.png"
                    className="bg-zinc-950 border-zinc-800 text-white font-mono flex-1"
                  />
                  {companySettings?.logo_url && (
                    <div className="h-10 px-3 rounded-md bg-white flex items-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={companySettings.logo_url} alt="logo preview" className="h-7 w-auto object-contain" />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Bank Details <span className="text-zinc-500 text-xs">(invoice &quot;Additional Notes&quot;)</span></Label>
                  <textarea
                    name="bank_details"
                    rows={6}
                    defaultValue={companySettings?.bank_details || ""}
                    className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm p-3 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-zinc-300">Default Terms <span className="text-zinc-500 text-xs">(optional)</span></Label>
                  <textarea
                    name="default_terms"
                    rows={6}
                    defaultValue={companySettings?.default_terms || ""}
                    className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || !companySettings} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                  <Save className="size-4" />
                  {isLoading ? "Saving..." : "Save Company Details"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update the access level for <span className="text-zinc-200 font-medium">{editingUser?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-zinc-300 mb-2 block">New Role</Label>
            <Select value={newRole} onValueChange={(val) => setNewRole(val || "")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                <SelectItem value="Manager">Manager (Business Access)</SelectItem>
                <SelectItem value="Staff">Staff (Personal KPI Only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-700 text-zinc-300" onClick={() => setEditRoleDialogOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleRoleChange} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="size-5" />
              Delete User
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to remove <span className="text-zinc-200 font-medium">{deleteConfirmUser?.name}</span> from the system?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-zinc-700 text-zinc-300" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button className="bg-rose-600 hover:bg-rose-500 text-white" onClick={handleDeleteUser} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
