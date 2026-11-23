import Link from "next/link";
import { Suspense } from "react";
import { RUTE } from "@/lib/tautan";
import { AksiAkun, TombolTamu } from "./AksiAkun";
import { NavUtama, NavUtamaStatis } from "./NavUtama";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.kepala}>
      <div className={`wadah ${styles.isi}`}>
        <Link href={RUTE.beranda} className={styles.merek}>
          <svg className={styles.logoIcon} viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="leafHdr" x1="6" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#14261E" />
                <stop offset="50%" stopColor="#0F5132" />
                <stop offset="100%" stopColor="#2E7D32" />
              </linearGradient>
            </defs>
            <path d="M8 38C7 26 14 14 38 7C38 21 34 35 18 39C14 40 10 40 8 38Z" fill="url(#leafHdr)" />
            <path d="M10 37C15 26 23 18 36 9" stroke="#E8F3E9" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className={styles.logoTeks}>
            <span className={styles.namaApp}>SUARA</span>
            <span className={styles.subApp}>Aspirasi &amp; Anggaran Desa</span>
          </div>
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
