import { FileQuestion, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex h-[60vh] items-center justify-center animate-in fade-in duration-500">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto size-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <FileQuestion className="size-8 text-zinc-500" />
        </div>
        <div>
          <h2 className="text-4xl font-bold text-white mb-2">404</h2>
          <p className="text-lg font-medium text-zinc-300 mb-1">Page Not Found</p>
          <p className="text-sm text-zinc-500">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
