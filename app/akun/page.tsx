import type { Metadata } from "next";
import { Suspense } from "react";
import { FormGantiSandi } from "@/components/akun/FormGantiSandi";
import { wajibMasuk } from "@/lib/auth";
import { amankanTujuan } from "@/lib/tujuan";
import { keluar } from "../masuk/aksi";
import styles from "../masuk/masuk.module.css";

export const metadata: Metadata = {
  title: "Akun",
  robots: { index: false },
};

const NAMA_PERAN = { warga: "Warga", admin: "Admin desa" } as const;

type Param = Record<string, string | string[] | undefined>;

// Halaman yang dilindungi. proxy.ts sudah mengarahkan pengunjung tanpa sesi ke /masuk,
// tetapi pemeriksaan yang sebenarnya ada di sini (wajibMasuk), dekat dengan data.
export default function HalamanAkun({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <h1 className={styles.judul}>Akun</h1>
      <Suspense fallback={<p className={styles.ket}>Memuat data akun...</p>}>
        <InfoAkun searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InfoAkun({ searchParams }: { searchParams: Promise<Param> }) {
  const pengguna = await wajibMasuk();
  const params = await searchParams;
  const lanjutMentah = Array.isArray(params.lanjut) ? params.lanjut[0] : params.lanjut;
  // Tujuan semula (dari halaman masuk) hanya diterima bila jalur di situs ini, dan bukan /akun itu sendiri.
  const lanjut = lanjutMentah ? amankanTujuan(lanjutMentah, "") : "";

  return (
    <>
      <p>
        Anda masuk sebagai <strong>{pengguna.nama}</strong> ({NAMA_PERAN[pengguna.peran]}).
      </p>

      <section aria-labelledby="judul-ganti-sandi" className={styles.bagianAkun}>
        <h2 id="judul-ganti-sandi">Ganti kata sandi</h2>
        <FormGantiSandi wajib={pengguna.harusGantiSandi} lanjut={lanjut && lanjut !== "/akun" ? lanjut : null} />
      </section>

      <form action={keluar}>
        <button type="submit" className="tombol tombol-kedua">
          Keluar
        </button>
      </form>
    </>
  );
}
