import Link from "next/link";
import styles from "./Admin.module.css";

interface Props {
  halaman: number;
  jumlahHalaman: number;
  /** Alamat untuk halaman tertentu, dengan filter yang sedang aktif. */
  href: (halaman: number) => string;
}

/** Paginasi sederhana: Sebelumnya, "Halaman 2 dari 5", Berikutnya. Keadaannya ada di URL. */
export function Paginasi({ halaman, jumlahHalaman, href }: Props) {
  if (jumlahHalaman <= 1) return null;
  return (
    <nav aria-label="Halaman daftar" className={styles.halamanNav}>
      {halaman > 1 ? (
        <Link href={href(halaman - 1)} className="tombol tombol-kedua" rel="prev">
          Sebelumnya
        </Link>
      ) : (
        <span className="tombol tombol-kedua" aria-disabled="true">
          Sebelumnya
        </span>
      )}
      <span aria-current="page">
        Halaman {halaman} dari {jumlahHalaman}
      </span>
      {halaman < jumlahHalaman ? (
        <Link href={href(halaman + 1)} className="tombol tombol-kedua" rel="next">
          Berikutnya
        </Link>
      ) : (
        <span className="tombol tombol-kedua" aria-disabled="true">
          Berikutnya
        </span>
      )}
    </nav>
  );
}
