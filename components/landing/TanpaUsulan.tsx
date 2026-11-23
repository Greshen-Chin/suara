import Link from "next/link";
import { rupiah } from "@/lib/format";
import { namaPeriode, rincianHasil, ringkasTerpakai } from "@/lib/keputusan-kalimat";
import type { Periode } from "@/lib/keputusan-tipe";
import { RUTE } from "@/lib/tautan";
import styles from "./TanpaUsulan.module.css";

interface Props {
  pagu: number;
  /** Periode terakhir yang sudah diputuskan; null bila belum ada atau tidak terbaca. */
  periodeTerakhir: Periode | null;
}

/**
 * Pengganti Garis Pagu bila tidak ada usulan dalam hitungan, misalnya sesudah semuanya diputuskan musyawarah.
 * Batang kosong tanpa penjelasan akan terbaca sebagai galat; di sini keadaannya dijelaskan dan jalan keluarnya
 * ditunjukkan: keputusan periode terakhir beserta alasannya, dan forum untuk usulan berikutnya.
 */
export function TanpaUsulan({ pagu, periodeTerakhir }: Props) {
  return (
    <div className={styles.papan}>
      <h2 className={styles.judul}>Tidak ada usulan dalam hitungan</h2>
      <p className={styles.isi}>
        Pagu {rupiah(pagu)} belum dibagi, karena belum ada usulan yang masuk hitungan anggaran. Usulan masuk hitungan
        setelah admin desa menilai urgensinya.
      </p>

      {periodeTerakhir && (
        <section aria-labelledby="judul-keputusan-terakhir" className={styles.terakhir}>
          <h3 id="judul-keputusan-terakhir" className={styles.judulTerakhir}>
            Keputusan terakhir: {namaPeriode(periodeTerakhir.tahun)}
          </h3>
          <p>
            {ringkasTerpakai(periodeTerakhir)}. {rincianHasil(periodeTerakhir.jumlah)}.
          </p>
          <Link href={`${RUTE.keputusan}/${periodeTerakhir.tahun}`}>Baca keputusan dan alasannya</Link>
        </section>
      )}

      <p>
        <Link href={RUTE.forum} className="tombol tombol-kedua">
          Lihat usulan di forum
        </Link>
      </p>
    </div>
  );
}
