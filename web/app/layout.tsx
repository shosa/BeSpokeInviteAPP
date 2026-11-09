import type { Metadata, Viewport } from "next";
import { Fraunces, Jost } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import "./bespoke.css";
import { Toaster } from "@/components/ui/Toaster";
import { getLang } from "@/lib/i18n";

// Titoli in Fraunces, interfaccia in Jost (sistema Bespoke Invites): scaricati in build e serviti dal nostro dominio.
const display = Fraunces({ subsets: ["latin"], variable: "--font-iv-display", display: "swap", weight: ["300", "400", "500"], style: ["normal", "italic"] });
const text = Jost({ subsets: ["latin"], variable: "--font-text", display: "swap", weight: ["300", "400", "500", "600"] });

export const metadata: Metadata = {
  title: "Bespoke Invite - Inviti digitali su misura",
  description: "Inviti digitali su misura per matrimoni ed eventi.",
};

export const viewport: Viewport = {
  themeColor: "#F5F6F8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${display.variable} ${text.variable}`}>
      <body>{children}<Toaster /></body>
    </html>
  );
}
