import type { Metadata, Viewport } from "next"
import { Inter, Outfit } from "next/font/google"
import { Toaster } from "sonner"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
})

const outfit = Outfit({
  subsets: ["latin"],
  variable: '--font-outfit',
})

export const metadata: Metadata = {
  title: "TechVilo CRM | Premium Business Management",
  description: "Advanced CRM system for TechVilo IT firm - Track clients, projects, and finance.",
}

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} font-sans bg-zinc-950 text-zinc-50 antialiased`}>
        <NextTopLoader 
          color="#4f46e5" 
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #4f46e5,0 0 5px #4f46e5"
        />
        <Toaster 
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#09090b',
              color: '#fff',
              border: '1px solid #27272a',
            },
          }}
        />
        {children}
      </body>
    </html>
  )
}
