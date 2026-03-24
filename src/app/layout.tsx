import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { siteConfig } from "@/config/site";
import { fontDisplay, fontSans, fontMono } from "@/config/fonts";

export const metadata: Metadata = {
  title: "Michigan Credit Union Scanner | Dixon Strategic Labs",
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning className="dark" lang="en">
      <head />
      <body
        suppressHydrationWarning
        className={`min-h-screen antialiased bg-background text-foreground ${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
      >
        <Providers>
          <ErrorBoundary>
            <a
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-zinc-900 focus:text-zinc-100 focus:border focus:border-zinc-700 focus:shadow-lg"
              href="#main-content"
            >
              Skip to main content
            </a>
            {children}
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
