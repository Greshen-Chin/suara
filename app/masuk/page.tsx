import type { Metadata } from "next";
import { Suspense } from "react";
import { FormMasuk } from "./FormMasuk";
import styles from "./masuk.module.css";

export const metadata: Metadata = {
  title: "Masuk",
  robots: { index: false },
};

type Param = Record<string, string | string[] | undefined>;

export default function HalamanMasuk({
  searchParams,
}: {
  searchParams: Promise<Param>;
}) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <div className={styles.eyebrow}>Akses warga dan perangkat desa</div>
      <h1 className={styles.judul}>Masuk ke SUARA</h1>
      <p className={styles.ket}>
        Gunakan akun yang diberikan perangkat desa. Tidak tersedia pendaftaran mandiri.
      </p>

      {/* Hanya bagian ini yang membaca alamat; sisa halaman tetap statis. */}
      <Suspense fallback={null}>
        <PesanSesiBerakhir searchParams={searchParams} />
      </Suspense>

      <div className={styles.kartuMasuk}>
        <FormMasuk />
        <p className={styles.catatan}>
          Belum punya akun? Hubungi admin desa untuk verifikasi warga.
        </p>
      </div>
    </main>
  );
}

/**
 * Tampil bila halaman lain menemukan bahwa akun di sesi Anda sudah tidak berlaku (lihat
 * RUTE.masukSesiBerakhir): dinonaktifkan, atau sesinya dicabut karena kata sandi diganti di perangkat lain.
 */
async function PesanSesiBerakhir({
  searchParams,
}: {
  searchParams: Promise<Param>;
}) {
  const { sesi } = await searchParams;
  if ((Array.isArray(sesi) ? sesi[0] : sesi) !== "berakhir") return null;
  return (
    <p role="status" className={styles.galat}>
      Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan. Kalau akun Anda
      dinonaktifkan, hubungi admin desa.
    </p>
  );
}
