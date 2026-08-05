import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { RefereeAuthProvider } from "@/contexts/RefereeAuthContext";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Giải Cầu Lông CLB",
  description: "Giải cầu lông đôi CLB · 15.08.2026 · Sân Gia Tưởng, Tân Bình",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${archivo.variable} ${bricolageGrotesque.variable} ${jetBrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[var(--color-bg)] font-[family-name:var(--font-archivo)] text-[var(--color-text)]">
        <RefereeAuthProvider>
          <div className="min-h-screen overflow-x-hidden">
            <SiteHeader />
            {children}
            <SiteFooter />
          </div>
        </RefereeAuthProvider>
      </body>
    </html>
  );
}
