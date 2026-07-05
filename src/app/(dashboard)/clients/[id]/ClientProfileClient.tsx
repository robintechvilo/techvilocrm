"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Mail, Phone, Building2, Briefcase, CreditCard, Clock, Receipt, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import * as perm from "@/lib/permissions"

export function ClientProfileClient({
  client,
  projects,
  ledgers,
  invoices,
  adSupport,
  currentUser
}: {
  client: any,
  projects: any[],
  ledgers: any[],
  invoices: any[],
  adSupport: any[],
  currentUser: any
}) {
  const router = useRouter()
  
  const canSeeFinance = perm.canControl(client, currentUser)

  // Derive lifetime figures from the projects (which hold the running
  // totals), NOT from ledger rows. Each partial payment writes a ledger row
  // carrying the full project amount, so summing ledger.total_amount counted
  // the same project value multiple times.
  const totalProjectValue = projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const totalPaid = projects.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0)
  const totalDue = projects.reduce((sum, p) => sum + (Number(p.due_amount) || 0), 0)

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

      {/* Monthly bills + Ad support — the client's full picture */}
      {canSeeFinance && (invoices.length > 0 || adSupport.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2 items-start">
          {invoices.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-100 flex items-center gap-2">
                  <Receipt className="size-5 text-indigo-400" />
                  Monthly Bills
                </CardTitle>
                <CardDescription className="text-zinc-400">Recurring billing cycles for this client.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400">Month</TableHead>
                        <TableHead className="text-zinc-400">Project</TableHead>
                        <TableHead className="text-zinc-400 text-right">Remaining</TableHead>
                        <TableHead className="text-zinc-400 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map(inv => {
                        const project = projects.find(p => p.id === inv.project_id)
                        const remaining = Math.max(0, (Number(inv.amount) || 0) - (Number(inv.paid_amount) || 0))
                        const isWaived = inv.status === 'Waived'
                        return (
                          <TableRow key={inv.id} className={cn("border-zinc-800 hover:bg-zinc-800/50", isWaived && "opacity-50")}>
                            <TableCell className="text-zinc-300">{inv.billing_month}</TableCell>
                            <TableCell className="text-zinc-300 truncate max-w-[140px]">{project?.name || 'N/A'}</TableCell>
                            <TableCell className="text-right font-medium text-rose-400">
                              {isWaived ? <span className="line-through text-zinc-500">৳ {remaining.toLocaleString()}</span> : remaining > 0 ? `৳ ${remaining.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className={
                                inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                inv.status === 'Partial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                isWaived ? 'bg-zinc-800/50 text-zinc-500 border-zinc-700' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }>
                                {isWaived ? 'Written off' : inv.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {adSupport.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-100 flex items-center gap-2">
                  <Globe className="size-5 text-cyan-400" />
                  Ad Support
                </CardTitle>
                <CardDescription className="text-zinc-400">Dollar funding history for this client.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-950/50">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400">Date</TableHead>
                        <TableHead className="text-zinc-400 text-right">USD</TableHead>
                        <TableHead className="text-zinc-400 text-right">Paid</TableHead>
                        <TableHead className="text-zinc-400 text-right">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adSupport.map(a => (
                        <TableRow key={a.id} className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell className="text-zinc-300 text-sm">{new Date(a.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell className="text-right text-zinc-100 font-medium">$ {(Number(a.dollar_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-emerald-400">৳ {(Number(a.paid_amount) || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium text-rose-400">
                            {(Number(a.due_amount) || 0) > 0 ? `৳ ${(Number(a.due_amount) || 0).toLocaleString()}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
