import Link from "next/link";
import { rupiah } from "@/lib/format";
import { RUTE } from "@/lib/tautan";
import styles from "./Hero.module.css";

interface Props {
  pagu: number;
  dataContoh: boolean;
}

export function Hero({ pagu, dataContoh }: Props) {
  return (
    <section aria-labelledby="judul-utama" className={styles.hero}>
      <div className={`wadah ${styles.isi}`}>
        <div className={styles.pengantar}>
          <p className={styles.kicker}>Partisipasi dan anggaran desa</p>
          <h1 id="judul-utama">Keputusan anggaran yang lebih adil.</h1>
          <p className={styles.penjelas}>
            Bandingkan suara warga, kebutuhan mendesak, dan pemerataan pembangunan
            dalam satu tempat.
          </p>
          <div className={styles.aksi}>
            <a href="#perbandingan" className="tombol tombol-utama">Lihat perbandingan</a>
            <Link href={RUTE.forum} className={styles.tautan}>Jelajahi usulan warga <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <div className={styles.konteks}>
          <p className={styles.label}>Pagu anggaran resmi</p>
          <p className={styles.nilai}>{rupiah(pagu)}</p>
          <p className={styles.keterangan}>
            Batas anggaran yang sama dipakai untuk membandingkan dua cara memilih usulan.
          </p>
          {dataContoh && <p className={styles.catatan}>Data contoh ditampilkan karena layanan data tidak tersedia.</p>}
        </div>
      </div>
    </section>
  );
}
