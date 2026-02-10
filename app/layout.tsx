import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Libre_Baskerville } from "next/font/google"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-libre",
})

export const metadata: Metadata = {
  title: "Flybrary - Decentralized Physical Book Lending",
  description:
    "Discover, borrow, and share physical books across communities. Trust-based, transparent, pseudonymous.",
}

export const viewport: Viewport = {
  themeColor: "#e07a24",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${libreBaskerville.variable}`}>
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  )
}
