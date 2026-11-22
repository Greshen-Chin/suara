import type { BarisLog } from "@/lib/data";
import type { DetailUsulan } from "@/lib/forum-data";
import { LABEL_JENIS_LOG as JENIS } from "@/lib/jenis-log";
import { tanggalPanjang } from "@/lib/waktu";
import styles from "./Detail.module.css";

interface Props {
  /** Hanya yang dibutuhkan untuk baris "Diajukan"; juga dipakai halaman admin dengan data dari view admin. */
  usulan: Pick<DetailUsulan, "source" | "created_at" | "pengusul_nama_depan" | "pengusul_rw">;
  log: BarisLog[];
}

/** Jejak keputusan untuk satu usulan: dari diajukan sampai keputusan terakhir, termasuk moderasi. */
export function RiwayatUsulan({ usulan, log }: Props) {
  const awal =
    usulan.source === "musrenbang"
      ? "Usulan masuk dari musyawarah desa."
      : usulan.pengusul_nama_depan
        ? `Diajukan oleh ${usulan.pengusul_nama_depan}${usulan.pengusul_rw !== null ? `, RW ${String(usulan.pengusul_rw).padStart(2, "0")}` : ""}.`
        : "Diajukan oleh warga.";

  return (
    <ol className={styles.riwayat}>
      <li className={styles.langkah}>
        <time dateTime={usulan.created_at} className={styles.tanggalLangkah}>
          {tanggalPanjang(usulan.created_at)}
        </time>
        <div>
          <p className={styles.jenis}>Diajukan</p>
          <p>{awal}</p>
        </div>
      </li>
      {log.map((l) => (
        <li key={l.id} className={styles.langkah}>
          <time dateTime={l.created_at} className={styles.tanggalLangkah}>
            {tanggalPanjang(l.created_at)}
          </time>
          <div>
            <p className={styles.jenis}>{JENIS[l.log_type]}</p>
            <p>{l.message}</p>
            <p className={styles.pencatat}>Dicatat oleh {l.actor}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
