"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex h-[60vh] items-center justify-center animate-in fade-in duration-500">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto size-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <AlertTriangle className="size-8 text-rose-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-zinc-400">
            An unexpected error occurred while loading this page. Please try again or go back to the dashboard.
          </p>
          {error?.digest && (
            <p className="text-xs text-zinc-600 mt-2 font-mono">Error ID: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button 
            onClick={reset} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
          >
            <RotateCcw className="size-4" />
            Try Again
          </Button>
          <Button 
            variant="outline" 
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2"
            onClick={() => window.location.href = '/'}
          >
            <Home className="size-4" />
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
