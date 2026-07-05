"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Download, Receipt, Edit2, Trash2, AlertCircle, Search } from "lucide-react"
import { TablePagination } from "@/components/ui/table-pagination"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addExpense, updateExpense, deleteExpense } from "@/app/actions/expenses"
import { toast } from "sonner"
import { cn, formatDate, escapeCsv } from "@/lib/utils"
import * as perm from "@/lib/permissions"
import { buttonVariants } from "@/components/ui/button"

export function ExpensesClient({ initialExpenses, currentUser }: { initialExpenses: any[], currentUser: any }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editExpense, setEditExpense] = useState<any | null>(null)
  const [editCategory, setEditCategory] = useState<string>("Other")
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)

  const canManage = perm.isAdminOrManager(currentUser)

  if (!canManage) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-zinc-400">Only Admin and Manager can access company expense reports.</p>
        </div>
      </div>
    )
  }

  const handleRecordExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const result = await addExpense(formData)
      if (result.success) {
        toast.success("Expense recorded successfully")
        setIsDialogOpen(false)
        form.reset()
      } else {
        toast.error(result.error || "Failed to record expense")
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editExpense) return
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const result = await updateExpense(editExpense.id, formData)
      if (result.success) {
        toast.success("Expense updated successfully")
        setEditExpense(null)
      } else {
        toast.error(result.error || "Failed to update expense")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return
    setIsLoading(true)
    try {
      const result = await deleteExpense(deleteExpenseId)
      if (result.success) {
        toast.success("Expense deleted successfully")
        setDeleteExpenseId(null)
      } else {
        toast.error(result.error || "Failed to delete expense")
      }
    } catch (error) {
      toast.error("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // ---- Search / filter / pagination ----
  const PAGE_SIZE = 10
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("All")
  const [monthFilter, setMonthFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [search, categoryFilter, monthFilter])

  const months = useMemo(() => {
    const arr: { key: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      })
    }
    return arr
  }, [])

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return initialExpenses.filter(exp => {
      if (monthFilter !== "all" && !(exp.date || "").startsWith(monthFilter)) return false
      if (categoryFilter !== "All" && exp.category !== categoryFilter) return false
      if (!q) return true
      return String(exp.description || "").toLowerCase().includes(q)
    })
  }, [initialExpenses, search, categoryFilter, monthFilter])

  const pagedExpenses = filteredExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isFiltered = search.trim() !== "" || categoryFilter !== "All" || monthFilter !== "all"

  // Total card follows the active filters
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)

  const handleExportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount (BDT)']
    const rows = filteredExpenses.map(exp => [
      exp.date,
      exp.description,
      exp.category,
      (Number(exp.amount) || 0).toString(),
    ])
    const csvContent = [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `techvilo_expenses_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Expenses</h1>
          <p className="text-zinc-400">Track internal costs and operational expenses.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2"
            onClick={handleExportCSV}
            disabled={filteredExpenses.length === 0}
          >
            <Download className="size-4" />
            Export
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-500 text-white gap-2")}>
                <Plus className="size-4" />
                Record Expense
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
              <form onSubmit={handleRecordExpense}>
                <DialogHeader>
                  <DialogTitle>Record New Expense</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Log an internal cost or operational expense.
                  </DialogDescription>
                </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title" className="text-zinc-300">Expense Title</Label>
                  <Input name="title" id="title" placeholder="e.g. Office Rent, Employee Salary" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category" className="text-zinc-300">Category</Label>
                  <Select name="category" defaultValue="Marketing">
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-indigo-500/50">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Software/IT">Software/IT</SelectItem>
                      <SelectItem value="Marketing">Marketing & Ads</SelectItem>
                      <SelectItem value="Payroll">Payroll</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount" className="text-zinc-300">Amount (BDT)</Label>
                    <Input name="amount" id="amount" type="number" placeholder="10000" className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date" className="text-zinc-300">Date</Label>
                    <Input name="date" id="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="bg-zinc-900 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500/50" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Expense"}
                </Button>
              </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Total Expenses</CardTitle>
            <Receipt className="size-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">৳ {totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-zinc-500 mt-1">{isFiltered ? "Filtered results" : "All time"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-zinc-100">Expense History</CardTitle>
              <CardDescription className="text-zinc-400">
                {filteredExpenses.length} of {initialExpenses.length} shown.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v || "all")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[170px]">
                  <SelectValue>
                    {monthFilter === "all" ? "All months" : months.find(m => m.key === monthFilter)?.label || "All months"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[280px]">
                  <SelectItem value="all">All months</SelectItem>
                  {months.map(m => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v || "All")}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 w-full sm:w-[150px]">
                  <SelectValue>{categoryFilter === "All" ? "All categories" : categoryFilter}</SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectItem value="All">All categories</SelectItem>
                  <SelectItem value="Rent">Rent</SelectItem>
                  <SelectItem value="Software/IT">Software/IT</SelectItem>
                  <SelectItem value="Marketing">Marketing & Ads</SelectItem>
                  <SelectItem value="Payroll">Payroll</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                <Input
                  placeholder="Search description..."
                  className="pl-9 bg-zinc-950 border-zinc-800"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {initialExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="size-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Expenses Recorded</h3>
              <p className="text-zinc-500 text-sm">Click "Record Expense" to add your first entry.</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Search className="size-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Matches</h3>
              <p className="text-zinc-500 text-sm">No expenses match your search/filter.</p>
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-zinc-950/50">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Date</TableHead>
                    <TableHead className="text-zinc-400">Description</TableHead>
                    <TableHead className="text-zinc-400">Category</TableHead>
                    <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedExpenses.map((expense) => (
                    <TableRow key={expense.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                      <TableCell className="text-zinc-300">{formatDate(expense.date)}</TableCell>
                      <TableCell className="font-medium text-zinc-100">{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-rose-400">
                        - ৳ {(Number(expense.amount) || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                            onClick={() => {
                              setEditCategory(expense.category || "Other")
                              setEditExpense(expense)
                            }}
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => setDeleteExpenseId(expense.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={filteredExpenses.length}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
      {/* Edit Expense Dialog */}
      <Dialog open={!!editExpense} onOpenChange={(open) => !open && setEditExpense(null)}>
        <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
          {editExpense && (
          <form onSubmit={handleEditExpense} key={editExpense.id}>
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Update the expense details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title" className="text-zinc-300">Expense Title</Label>
                <Input name="title" id="edit-title" defaultValue={editExpense.description} className="bg-zinc-900 border-zinc-800 text-zinc-100" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-category" className="text-zinc-300">Category</Label>
                <Select name="category" value={editCategory} onValueChange={(v) => setEditCategory(v || "Other")}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectValue>{editCategory}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Software/IT">Software/IT</SelectItem>
                    <SelectItem value="Marketing">Marketing & Ads</SelectItem>
                    <SelectItem value="Payroll">Payroll</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-amount" className="text-zinc-300">Amount (BDT)</Label>
                  <Input name="amount" id="edit-amount" type="number" defaultValue={editExpense.amount} className="bg-zinc-900 border-zinc-800 text-zinc-100" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-date" className="text-zinc-300">Date</Label>
                  <Input name="date" id="edit-date" type="date" defaultValue={editExpense.date} className="bg-zinc-900 border-zinc-800 text-zinc-100" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteExpenseId} onOpenChange={(open) => !open && setDeleteExpenseId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <AlertCircle className="size-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-3">
              Are you sure you want to delete this expense record?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDeleteExpenseId(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteExpense} disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
