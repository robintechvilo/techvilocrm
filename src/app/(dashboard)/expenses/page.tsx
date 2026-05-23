import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/app/actions/auth"
import { ExpensesClient } from "./ExpensesClient"

export default async function ExpensesPage() {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()
  
  if (!currentUser) return null

  const { data: expenses = [] } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })

  return (
    <ExpensesClient 
      initialExpenses={expenses || []} 
      currentUser={currentUser} 
    />
  )
}
