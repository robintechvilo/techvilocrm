"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Mail, Phone, Building2, Briefcase, CreditCard, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export function ClientProfileClient({ 
  client, 
  projects, 
  ledgers, 
  currentUser 
}: { 
  client: any, 
  projects: any[], 
  ledgers: any[], 
  currentUser: any 
}) {
  const router = useRouter()
  
  const isAdminOrManager = currentUser?.role === 'Admin' || currentUser?.role === 'Manager'
  const isOwner = client.created_by === currentUser?.id
  
  const canSeeFinance = isAdminOrManager || isOwner

  const totalProjectValue = ledgers.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0)
  const totalPaid = ledgers.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0)
  const totalDue = ledgers.reduce((sum, p) => sum + (Number(p.due_amount) || 0), 0)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button onClick={() => router.push('/clients')} variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            {client.name}
            <Badge variant="outline"
              className={
                client.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                client.status === 'Lead' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'text-zinc-400 border-zinc-700 bg-zinc-800/50'
              }
            >
              {client.status}
            </Badge>
          </h1>
          <p className="text-zinc-400">Client Profile & History</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-zinc-900 border-zinc-800 md:col-span-1">
          <CardHeader>
            <CardTitle className="text-zinc-100">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 text-zinc-300">
              <Building2 className="size-5 text-zinc-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-zinc-400">Company</p>
                <p className="text-zinc-100">{client.company}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-zinc-300">
              <Mail className="size-5 text-zinc-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-zinc-400">Email</p>
                <a href={`mailto:${client.email}`} className="text-indigo-400 hover:underline">{client.email}</a>
              </div>
            </div>
            <div className="flex items-start gap-3 text-zinc-300">
              <Phone className="size-5 text-zinc-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-zinc-400">Phone</p>
                <a href={`tel:${client.phone}`} className="text-zinc-100 hover:text-indigo-400">{client.phone}</a>
              </div>
            </div>
          </CardContent>
        </Card>

        {canSeeFinance && (
          <Card className="bg-zinc-900 border-zinc-800 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-zinc-100">Financial Overview</CardTitle>
              <CardDescription className="text-zinc-400">Lifetime value and current standing.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-zinc-950/50 border border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-400 mb-2">
                    <Briefcase className="size-4" />
                    <span className="text-sm font-medium">Total Value</span>
                  </div>
                  <p className="text-2xl font-bold text-white">৳ {totalProjectValue.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="flex items-center gap-2 text-emerald-400/80 mb-2">
                    <CreditCard className="size-4" />
                    <span className="text-sm font-medium">Total Paid</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">৳ {totalPaid.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/10">
                  <div className="flex items-center gap-2 text-rose-400/80 mb-2">
                    <Clock className="size-4" />
                    <span className="text-sm font-medium">Total Due</span>
                  </div>
                  <p className="text-2xl font-bold text-rose-400">৳ {totalDue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className={canSeeFinance ? "grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-1"}>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Projects</CardTitle>
            <CardDescription className="text-zinc-400">All associated services and projects.</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">No projects found for this client.</p>
            ) : (
              <div className="space-y-4">
                {projects.map(project => (
                  <div key={project.id} className="flex flex-col gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-950/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-100">{project.name}</span>
                      <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700">
                        {project.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">{project.service}</span>
                      {canSeeFinance && <span className="font-medium text-rose-400">Due: ৳ {(Number(project.due_amount) || 0).toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {canSeeFinance && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Ledger History</CardTitle>
              <CardDescription className="text-zinc-400">Recent billing cycles for this client.</CardDescription>
            </CardHeader>
            <CardContent>
              {ledgers.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No ledger entries found for this client.</p>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400">Month</TableHead>
                        <TableHead className="text-zinc-400">Service</TableHead>
                        <TableHead className="text-zinc-400 text-right">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgers.map(ledger => {
                        const project = projects.find(p => p.id === ledger.project_id)
                        return (
                        <TableRow key={ledger.id} className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell className="text-zinc-300">{ledger.payment_month}</TableCell>
                          <TableCell className="text-zinc-300 truncate max-w-[120px]">{project?.name || 'N/A'}</TableCell>
                          <TableCell className="text-right font-medium text-rose-400">
                            {(Number(ledger.due_amount) || 0) > 0 ? `৳ ${(Number(ledger.due_amount) || 0).toLocaleString()}` : 'Paid'}
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
