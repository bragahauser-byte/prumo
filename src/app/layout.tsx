import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { asset } from "@/lib/base-path";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Prumo — finanças pessoais", template: "%s · Prumo" },
  description: "Entenda sua situação financeira, planeje o mês e antecipe problemas antes que aconteçam.",
  icons: {
    icon: [
      { url: asset("/brand/icon.svg"), type: "image/svg+xml" },
      { url: asset("/brand/logo-light-32.png"), sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: asset("/brand/logo-dark-32.png"), sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: asset("/brand/logo-light-180.png"), sizes: "180x180" }],
  },
  manifest: asset("/manifest.webmanifest"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F0F" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)]">{children}</body>
    </html>
  );
}
