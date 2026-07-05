// Shared invoice helpers — safe for both server and client components.

export const CURRENCIES = {
  BDT: { symbol: "৳", label: "Bangladeshi Taka (BDT, ৳)", word: "TAKA", sub: "POISHA" },
  USD: { symbol: "$", label: "US Dollar (USD, $)", word: "DOLLARS", sub: "CENTS" },
  EUR: { symbol: "€", label: "Euro (EUR, €)", word: "EUROS", sub: "CENTS" },
  GBP: { symbol: "£", label: "British Pound (GBP, £)", word: "POUNDS", sub: "PENCE" },
} as const

export type CurrencyCode = keyof typeof CURRENCIES

export function currencySymbol(code: string): string {
  return CURRENCIES[code as CurrencyCode]?.symbol || code
}

export function formatMoney(amount: number, code: string): string {
  const n = Number(amount) || 0
  const hasFraction = Math.round(n * 100) % 100 !== 0
  return `${currencySymbol(code)}${n.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

export type InvoiceItem = {
  name: string
  description?: string
  amount: number
}

export function invoiceTotal(items: InvoiceItem[]): number {
  return (items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0)
}

// ---- Number → English words (international scale), e.g.
//   600, "EUR"  → "SIX HUNDRED EUROS ONLY"
//   1250.50, "BDT" → "ONE THOUSAND TWO HUNDRED FIFTY TAKA AND FIFTY POISHA ONLY"

const ONES = [
  "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
  "SEVENTEEN", "EIGHTEEN", "NINETEEN",
]
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]
const SCALE = ["", " THOUSAND", " MILLION", " BILLION"]

function threeDigitsToWords(n: number): string {
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) parts.push(`${ONES[hundreds]} HUNDRED`)
  if (rest >= 20) {
    const t = TENS[Math.floor(rest / 10)]
    const o = ONES[rest % 10]
    parts.push(o ? `${t} ${o}` : t)
  } else if (rest > 0) {
    parts.push(ONES[rest])
  }
  return parts.join(" ")
}

export function numberToWords(n: number): string {
  const int = Math.floor(Math.abs(n))
  if (int === 0) return "ZERO"
  const chunks: string[] = []
  let value = int
  let scaleIdx = 0
  while (value > 0 && scaleIdx < SCALE.length) {
    const chunk = value % 1000
    if (chunk > 0) chunks.unshift(`${threeDigitsToWords(chunk)}${SCALE[scaleIdx]}`)
    value = Math.floor(value / 1000)
    scaleIdx++
  }
  return chunks.join(" ")
}

export function amountInWords(amount: number, code: string): string {
  const cur = CURRENCIES[code as CurrencyCode] || CURRENCIES.BDT
  const n = Math.abs(Number(amount) || 0)
  const int = Math.floor(n)
  const cents = Math.round((n - int) * 100)
  let words = `${numberToWords(int)} ${cur.word}`
  if (cents > 0) words += ` AND ${numberToWords(cents)} ${cur.sub}`
  return `${words} ONLY`
}
