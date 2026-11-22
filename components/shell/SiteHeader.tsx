import Link from "next/link";
import { RUTE } from "@/lib/tautan";
import styles from "./SiteHeader.module.css";

// "Coba sebagai warga" membuka forum (bisa dibaca tanpa akun); admin desa masuk lewat /masuk.
export function SiteHeader() {
  return (
    <header className={styles.kepala}>
      <div className={`wadah ${styles.isi}`}>
        <Link href={RUTE.beranda} className={styles.merek} aria-label="SUARA, ke beranda">
          SUARA
        </Link>

        <nav className={styles.navigasi} aria-label="Navigasi utama">
          <Link href={RUTE.forum}>Forum</Link>
          <Link href={RUTE.simulasi}>Simulasi</Link>
          <Link href={RUTE.keputusan}>Keputusan</Link>
        </nav>

        <div className={styles.tombol}>
          <Link href={RUTE.forum} className="tombol tombol-utama">
            Coba sebagai warga
          </Link>
          <Link href={RUTE.masuk} className="tombol tombol-kedua">
            Masuk sebagai admin desa
          </Link>
        </div>
      </div>
    </header>
  );
}
