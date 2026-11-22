import Link from "next/link";
import { RUTE } from "@/lib/tautan";
import styles from "./SiteHeader.module.css";

// TODO: ganti kedua tombol dengan login demo (warga dan admin desa) bila sudah ada.
// Sementara, warga diarahkan ke forum dan admin desa ke layar keputusan.
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
          <Link href={RUTE.keputusan} className="tombol tombol-kedua">
            Masuk sebagai admin desa
          </Link>
        </div>
      </div>
    </header>
  );
}
