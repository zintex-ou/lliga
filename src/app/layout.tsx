import type { Metadata } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n";
import { siteLogo } from "@/lib/stats";
import { PwaRegister } from "@/components/PwaRegister";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { default: "Amics del futbol amateur", template: "%s · Amics del futbol amateur" },
    description: "Lliga de futbol veterans de Girona — classificació, resultats, calendari i plantilles",
    icons: { icon: siteLogo(), apple: "/icons/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
    openGraph: { siteName: "Amics del futbol amateur", locale: "ca_ES", type: "website", images: [{ url: "/og/site", width: 1200, height: 630 }] },
    appleWebApp: { capable: true, title: "FEG Lliga", statusBarStyle: "black-translucent" },
  };
}
export const viewport = { themeColor: "#17181C", colorScheme: "light dark" as const };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>{children}<PwaRegister /></body>
    </html>
  );
}
