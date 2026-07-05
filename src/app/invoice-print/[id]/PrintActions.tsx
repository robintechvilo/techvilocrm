"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Edit2 } from "lucide-react"

export function PrintActions({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  return (
    <div className="print:hidden sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
      <div className="max-w-[820px] mx-auto flex items-center justify-between px-4 py-3">
        <button
          onClick={() => router.push("/invoices")}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Invoices
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/invoices/${invoiceId}/edit`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors"
          >
            <Edit2 className="size-3.5" />
            Edit
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            <Download className="size-4" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
