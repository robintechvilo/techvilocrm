import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="size-12 rounded-full border-2 border-zinc-800" />
          <Loader2 className="size-12 absolute inset-0 text-indigo-500 animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">Loading...</p>
          <p className="text-xs text-zinc-600 mt-1">Please wait while we fetch your data</p>
        </div>
      </div>
    </div>
  )
}
