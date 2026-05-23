import { getCurrentUser } from "@/app/actions/auth"
import { ProfileClient } from "./ProfileClient"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const currentUser = await getCurrentUser()
  
  if (!currentUser) {
    redirect("/admin")
  }

  return <ProfileClient currentUser={currentUser} />
}
