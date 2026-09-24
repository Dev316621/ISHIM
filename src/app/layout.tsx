import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "iShim — Find your home in Ukhrul",
  description:
    "iShim is the hyper-local rental platform for Ukhrul. Browse verified houses by community block, contact owners on WhatsApp, and move in with confidence.",
  keywords: ["iShim", "Ukhrul", "rental", "houses", "Tangkhul", "Manipur", "rent"],
  authors: [{ name: "iShim" }],
  metadataBase: new URL("https://ishim.discoverukhrul.site"),
  manifest: "/brand/manifest.webmanifest",
  openGraph: {
    title: "iShim — Find your home in Ukhrul",
    description: "Verified houses across Ukhrul's community blocks. Contact owners directly on WhatsApp.",
    siteName: "iShim",
    type: "website",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "iShim — House Rental. Find | Rent | Belong" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#023c2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
