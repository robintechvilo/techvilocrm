"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// Compact client-side pagination bar used under data tables.
// Renders nothing when everything fits on one page.
export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalItems <= pageSize) return null

  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize + 1
  const end = Math.min(totalItems, current * pageSize)

  // Windowed page numbers: 1 … n-1 n n+1 … last
  const numbers: (number | "…")[] = []
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) numbers.push(i)
  } else {
    numbers.push(1)
    if (current > 3) numbers.push("…")
    for (let i = Math.max(2, current - 1); i <= Math.min(pageCount - 1, current + 1); i++) {
      numbers.push(i)
    }
    if (current < pageCount - 2) numbers.push("…")
    numbers.push(pageCount)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3">
      <p className="text-xs text-zinc-500">
        Showing <span className="text-zinc-300 font-medium">{start}–{end}</span> of{" "}
        <span className="text-zinc-300 font-medium">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-40"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {numbers.map((n, i) =>
          n === "…" ? (
            <span key={`e-${i}`} className="px-1.5 text-zinc-600 text-sm">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={cn(
                "size-8 rounded-md text-xs font-medium transition-colors",
                n === current
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent",
              )}
            >
              {n}
            </button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-40"
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
