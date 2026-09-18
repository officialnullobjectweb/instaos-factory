import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { AppProviders } from "@/providers/app-providers";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  formatDetection: { telephone: false },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [
      {
        url: `/api/og?title=${encodeURIComponent(APP_NAME)}&subtitle=${encodeURIComponent(APP_DESCRIPTION)}`,
        width: 1200,
        height: 630,
        alt: APP_NAME,
      },
    ],
    type: "website",
    siteName: APP_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [
      `/api/og?title=${encodeURIComponent(APP_NAME)}&subtitle=${encodeURIComponent(APP_DESCRIPTION)}`,
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
         * Applied before the first paint. A dark-mode reader must never see a
         * white flash, and React cannot help until it has hydrated.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
