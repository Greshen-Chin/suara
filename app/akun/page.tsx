import type { Metadata } from "next";
import { Suspense } from "react";
import { wajibMasuk } from "@/lib/auth";
import { keluar } from "../masuk/aksi";
import styles from "../masuk/masuk.module.css";

export const metadata: Metadata = {
  title: "Akun",
  robots: { index: false },
};

const NAMA_PERAN = { warga: "Warga", admin: "Admin desa" } as const;

// Halaman yang dilindungi. proxy.ts sudah mengarahkan pengunjung tanpa sesi ke /masuk,
// tetapi pemeriksaan yang sebenarnya ada di sini (wajibMasuk), dekat dengan data.
export default function HalamanAkun() {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <h1 className={styles.judul}>Akun</h1>
      <Suspense fallback={<p className={styles.ket}>Memuat data akun...</p>}>
        <InfoAkun />
      </Suspense>
    </main>
  );
}

async function InfoAkun() {
  const pengguna = await wajibMasuk();
  return (
    <>
      <p>
        Anda masuk sebagai <strong>{pengguna.nama}</strong> ({NAMA_PERAN[pengguna.peran]}).
      </p>
      <form action={keluar}>
        <button type="submit" className="tombol tombol-kedua">
          Keluar
        </button>
      </form>
    </>
  );
}
