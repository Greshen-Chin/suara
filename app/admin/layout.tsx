import type { Metadata } from "next";
import { Suspense } from "react";
import { KerangkaPita, PitaAdmin } from "@/components/admin/PitaAdmin";
import styles from "@/components/admin/Admin.module.css";

// Halaman admin tidak untuk mesin pencari. Judul tiap halaman diawali "Admin · ".
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Pita mode admin dan navigasi membaca sesi, jadi dibungkus Suspense: sisa halaman tetap bisa
// diprerender, dan kerangkanya setinggi aslinya supaya tidak ada lompatan (CLS).
export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<KerangkaPita />}>
        <PitaAdmin />
      </Suspense>
      <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
        {children}
      </main>
    </>
  );
}
