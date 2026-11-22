import Link from "next/link";
import { Suspense } from "react";
import { RUTE } from "@/lib/tautan";
import { AksiAkun, TombolTamu } from "./AksiAkun";
import { NavUtama, NavUtamaStatis } from "./NavUtama";
import styles from "./SiteHeader.module.css";

// Header tetap bisa diprerender statis: bagian yang membaca sesi (tombol di kanan) dan
// bagian yang membaca alamat halaman (penanda halaman aktif) dibungkus Suspense. Selama
// belum siap, yang tampil adalah versi tanpa penanda dengan ukuran yang sama, jadi tidak ada
// lompatan tata letak.
// "Coba sebagai warga" membuka forum (bisa dibaca tanpa akun). Warga dan admin desa
// masuk lewat halaman yang sama (/masuk); perannya ditentukan oleh akun.
export function SiteHeader() {
  return (
    <header className={styles.kepala}>
      <div className={`wadah ${styles.isi}`}>
        <Link href={RUTE.beranda} className={styles.merek} aria-label="SUARA, ke beranda">
          SUARA
        </Link>

        <Suspense fallback={<NavUtamaStatis kelas={styles.navigasi} />}>
          <NavUtama kelas={styles.navigasi} kelasAktif={styles.aktif} />
        </Suspense>

        <div className={styles.tombol}>
          <Suspense fallback={<TombolTamu />}>
            <AksiAkun />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
