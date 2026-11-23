import type { Metadata } from "next";
import { Suspense } from "react";
import { BukuRegister } from "@/components/keputusan/BukuRegister";
import { getLogTerbaru } from "@/lib/data";
import styles from "@/components/keputusan/BukuRegister.module.css";

export const metadata: Metadata = {
  title: "Jejak Keputusan",
  description:
    "Buku register transparansi dan akuntabilitas desa: semua perubahan status, bobot, pagu, dan seleksi tercatat terbuka.",
};

async function DaftarRegister() {
  const hasilLog = await getLogTerbaru(50);
  return <BukuRegister logList={hasilLog.data} />;
}

export default function HalamanKeputusan() {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <header className={styles.kepala}>
        <h1 className={styles.judul}>Buku Register Jejak Keputusan</h1>
        <p className={styles.keterangan}>
          Prinsip utama SUARA: tidak ada keputusan yang diambil tanpa jejak.
          Setiap perubahan status usulan, penyesuaian bobot penilaian, perubahan pagu anggaran,
          dan catatan seleksi dicatat otomatis dan dapat diperiksa oleh seluruh warga desa.
        </p>
      </header>

      <Suspense fallback={<p role="status">Memuat jejak keputusan…</p>}>
        <DaftarRegister />
      </Suspense>
    </main>
  );
}
