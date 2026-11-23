import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { MobileBottomNav } from "@/components/shell/MobileBottomNav";
import "./globals.css";

// Huruf judul, navigasi, dan UI: Plus Jakarta Sans (Master Design System)
const judul = Plus_Jakarta_Sans({
  variable: "--font-judul",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

// Huruf isi, data, dan label: Inter (Master Design System)
const isi = Inter({
  variable: "--font-isi",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const DESKRIPSI =
  "SUARA — Sistem Usulan dan Aspirasi Rakyat. Platform musyawarah dan alokasi anggaran pembangunan desa yang berkeadilan, transparan, dan akuntabel.";

export const metadata: Metadata = {
  title: {
    default: "SUARA: Sistem Usulan dan Aspirasi Rakyat",
    template: "%s | SUARA",
  },
  description: DESKRIPSI,
  icons: {
    icon: "/suara-icon.svg",
  },
  openGraph: {
    title: "SUARA: Sistem Usulan dan Aspirasi Rakyat",
    description: DESKRIPSI,
    type: "website",
    locale: "id_ID",
    siteName: "SUARA",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F5132",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${judul.variable} ${isi.variable}`}>
      <body>
        <a className="lompat" href="#isi">
          Lompat ke isi halaman
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <MobileBottomNav />
      </body>
    </html>
  );
}
