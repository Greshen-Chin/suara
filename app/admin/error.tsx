"use client";

import Link from "next/link";
import { useEffect } from "react";
import styles from "@/components/admin/Admin.module.css";

/**
 * Galat saat memuat halaman admin, hampir selalu database yang tidak terjangkau. Halaman admin
 * TIDAK memakai data cadangan: keputusan anggaran tidak boleh diambil dari data basi. Jadi tidak
 * ada isi dan tidak ada aksi yang bisa ditekan; hanya penjelasan dan tombol "Coba lagi".
 */
export default function GalatAdmin({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Pesan asli sengaja tidak ditampilkan (bisa memuat rincian database); digest untuk dicocokkan dengan log server.
    console.error("Halaman admin gagal dimuat", error.digest ?? "");
  }, [error]);

  return (
    <div className={styles.galatMuat} role="alert">
      <h1>Halaman admin belum bisa dimuat</h1>
      <p>
        Data desa tidak terjangkau saat ini. Tidak ada yang berubah, dan semua tombol aksi dimatikan sampai datanya
        bisa dibaca lagi, supaya keputusan tidak diambil dari angka yang sudah basi.
      </p>
      <div className={styles.tombolBaris}>
        <button type="button" className="tombol tombol-utama" onClick={reset}>
          Coba lagi
        </button>
        <Link href="/" className="tombol tombol-kedua">
          Ke halaman utama
        </Link>
      </div>
    </div>
  );
}
