import type { Metadata } from "next";
import { FormMasuk } from "./FormMasuk";
import styles from "./masuk.module.css";

export const metadata: Metadata = {
  title: "Masuk",
  robots: { index: false },
};

export default function HalamanMasuk() {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <h1 className={styles.judul}>Masuk ke SUARA</h1>
      <p className={styles.ket}>Untuk warga dan perangkat desa yang sudah punya akun.</p>
      <FormMasuk />
      <p className={styles.catatan}>
        Belum punya akun? Minta perangkat desa membuatkannya.
      </p>
    </main>
  );
}
