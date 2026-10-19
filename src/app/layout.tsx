import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { asset } from "@/lib/base-path";

/** Inter auto-hospedada pelo next/font: sem requisição ao Google no navegador, com fallback do sistema enquanto carrega. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
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
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)]">{children}</body>
    </html>
  );
}
