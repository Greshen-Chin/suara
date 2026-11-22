import Link from "next/link";
import { RUTE } from "@/lib/tautan";
import styles from "./Hero.module.css";

interface Props {
  /** Garis Pagu. */
  children: React.ReactNode;
  /** true bila data berasal dari cadangan karena database tidak terjangkau. */
  dataContoh: boolean;
}

export function Hero({ children, dataContoh }: Props) {
  return (
    <section aria-labelledby="judul-utama" className={`wadah ${styles.hero}`}>
      <div className={styles.atas}>
        <h1 id="judul-utama" className={styles.judul}>
          Bagaimana jika warga yang paling membutuhkan pembangunan justru yang
          paling sedikit suaranya?
        </h1>
        <p className={styles.penjelas}>
          Setiap suara tetap dihitung satu per satu, dan yang diberi bobot
          adalah kebutuhan, bukan orangnya.
        </p>
      </div>

      {children}

      <div className={styles.bawah}>
        <Link href={RUTE.simulasi} className="tombol tombol-utama">
          Coba simulasi anggaran
        </Link>
        {dataContoh && (
          <p className={styles.catatan}>
            Menampilkan data contoh karena database sedang tidak terjangkau.
          </p>
        )}
      </div>
    </section>
  );
}
