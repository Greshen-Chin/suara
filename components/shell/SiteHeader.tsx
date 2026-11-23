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
          <img
            src="/assets/logo/suara-mark.svg"
            width={34}
            height={34}
            alt="Logo SUARA"
            className={styles.logoIcon}
          />
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
