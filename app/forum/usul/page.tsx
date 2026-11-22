import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CatatanCadangan } from "@/components/forum/CatatanCadangan";
import { FormUsulan } from "@/components/forum/FormUsulan";
import styles from "@/components/forum/FormUsulan.module.css";
import { ambilPenggunaUntukBaca } from "@/lib/auth";
import { getWilayah } from "@/lib/data";
import { mulaiPemanasan } from "@/lib/embedding";
import { rwWarga } from "@/lib/forum-data";
import { RUTE } from "@/lib/tautan";

export const metadata: Metadata = {
  title: "Ajukan usulan",
  robots: { index: false },
};

const ALAMAT = "/forum/usul";

// proxy.ts sudah mengarahkan pengunjung tanpa sesi ke /masuk; pemeriksaan yang sebenarnya
// ada di sini (dekat dengan data), termasuk peran dan keterkaitan akun dengan data warga.
export default function HalamanUsul() {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <Link href={RUTE.forum} className={styles.kembali}>
        <span aria-hidden="true">←&nbsp;</span>Semua usulan
      </Link>
      <h1 className={styles.judulHalaman}>Ajukan usulan</h1>
      <Suspense fallback={<div className={styles.kerangkaForm} role="status" aria-label="Memuat formulir" />}>
        <IsiUsul />
      </Suspense>
    </main>
  );
}

async function IsiUsul() {
  const pengguna = await ambilPenggunaUntukBaca();
  if (!pengguna) redirect(`${RUTE.masuk}?lanjut=${encodeURIComponent(ALAMAT)}`);

  if (pengguna.peran !== "warga") {
    return (
      <div className={styles.catatan}>
        <p>
          <strong>Hanya akun warga yang bisa mengajukan usulan.</strong> Admin desa bisa membaca,
          berkomentar, dan menyembunyikan usulan yang tidak pantas.
        </p>
        <Link href={RUTE.forum} className="tombol tombol-kedua">
          Kembali ke forum
        </Link>
      </div>
    );
  }
  if (!pengguna.wargaId) {
    return (
      <div className={styles.catatan}>
        <p>
          <strong>Akun Anda belum tertaut ke data warga.</strong> Hubungi admin desa supaya akun ini
          bisa dipakai mengajukan dan mendukung usulan.
        </p>
        <Link href={RUTE.forum} className="tombol tombol-kedua">
          Kembali ke forum
        </Link>
      </div>
    );
  }

  const [rw, wilayah] = await Promise.all([rwWarga(pengguna.wargaId), getWilayah()]);
  // Model bahasa dimuat sekarang di latar belakang, supaya saat warga menekan "Periksa usulan
  // serupa" sudah siap (muat pertama bisa beberapa detik).
  mulaiPemanasan();

  if (wilayah.source === "fallback") {
    return (
      <>
        <CatatanCadangan />
        <Link href={RUTE.forum} className="tombol tombol-kedua">
          Kembali ke forum
        </Link>
      </>
    );
  }

  return (
    <>
      <p className={styles.pengantar}>
        Tulis usulan untuk desa Anda. Sebelum terkirim, kami periksa apakah sudah ada usulan serupa,
        supaya suara warga tidak terpecah.
      </p>
      <FormUsulan rwBawaan={rw} wilayah={wilayah.data.map((w) => ({ rw: w.rw, nama: w.nama }))} />
    </>
  );
}
