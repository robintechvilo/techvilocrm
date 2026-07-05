import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function escapeCsv(value: unknown): string {
  if (value == null) return ""
  let s = String(value)
  // Neutralise CSV/formula injection: cells starting with = + - @ can be
  // executed as formulas by Excel/Sheets. Prefix with a single quote.
  if (/^[=+\-@]/.test(s)) {
    s = `'${s}`
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function getInitials(name: string | null | undefined) {
  if (!name) return "U"
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "-"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  } catch {
    return dateString
  }
}
