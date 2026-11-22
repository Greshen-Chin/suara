import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Public_Sans } from "next/font/google";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import "./globals.css";

// Huruf judul: rapat dan tegas seperti papan penunjuk jalan dan papan proyek desa.
const judul = Barlow_Condensed({
  variable: "--font-judul",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

// Huruf isi: dirancang untuk layanan publik, angkanya bisa tabular.
const isi = Public_Sans({
  variable: "--font-isi",
  subsets: ["latin"],
  display: "swap",
});

const DESKRIPSI =
  "Setiap suara warga tetap dihitung, dan kebutuhan yang paling mendesak ikut ditimbang. Lihat bagaimana pagu desa dibagi.";

export const metadata: Metadata = {
  title: {
    default: "SUARA: Sistem Usulan dan Aspirasi Rakyat",
    template: "%s | SUARA",
  },
  description: DESKRIPSI,
  openGraph: {
    title: "SUARA: Sistem Usulan dan Aspirasi Rakyat",
    description: DESKRIPSI,
    type: "website",
    locale: "id_ID",
    siteName: "SUARA",
  },
};

export const viewport: Viewport = {
  themeColor: "#F3F5EF",
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
      </body>
    </html>
  );
}
