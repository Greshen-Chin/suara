import type { BarisLog } from "@/lib/data";
import { LABEL_JENIS_LOG } from "@/lib/jenis-log";
import { tanggalDanJam } from "@/lib/waktu";
import styles from "./Admin.module.css";

/**
 * Jejak keputusan publik (accountability_logs) sebagai baris register: tanggal dan jam, jenis catatan,
 * kalimat yang sama dengan yang dibaca warga, dan siapa yang mencatat. Teks dirender sebagai teks.
 */
export function RiwayatKeputusan({ log, kosong }: { log: readonly BarisLog[]; kosong: string }) {
  if (log.length === 0) return <p className={styles.penjelas}>{kosong}</p>;
  return (
    <ol className={styles.register}>
      {log.map((l) => (
        <li key={l.id} className={`${styles.registerBaris} ${styles.registerTanggal}`}>
          <time dateTime={l.created_at} className={styles.tanggalBaris}>
            {tanggalDanJam(l.created_at)}
          </time>
          <div>
            <p className={styles.cap}>{LABEL_JENIS_LOG[l.log_type]}</p>
            <p>{l.message}</p>
            <p className={styles.registerKet}>Dicatat oleh {l.actor}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
