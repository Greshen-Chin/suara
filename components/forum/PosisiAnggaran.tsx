import { StatusLabel } from "@/components/ui/StatusLabel";
import type { PosisiAnggaran as Posisi } from "@/lib/forum-data";
import styles from "./Forum.module.css";

const KETERANGAN = {
  terpilih: "masuk pilihan rekomendasi",
  ditunda: "biayanya tidak muat di sisa pagu",
  "tidak-terpilih": "skornya di bawah usulan yang terpilih",
} as const;

const TEKS = {
  terpilih: "Terbiayai",
  ditunda: "Ditunda",
  "tidak-terpilih": "Tidak terpilih",
} as const;

/**
 * Pembeda SUARA dari forum biasa: untuk usulan yang masuk hitungan anggaran, tampilkan
 * posisinya pada rekomendasi, dengan ikon, teks, dan warna status yang sama seperti Garis
 * Pagu di halaman utama. Tenang: satu baris, bukan panel.
 */
export function PosisiAnggaran({ posisi }: { posisi: Posisi }) {
  return (
    <p className={styles.posisi}>
      <span className={styles.peringkat}>
        Peringkat {posisi.peringkat} dari {posisi.jumlahUsulan} rekomendasi
      </span>
      <StatusLabel status={posisi.status} teks={TEKS[posisi.status]} />
      <span className={styles.keterangan}>{KETERANGAN[posisi.status]}</span>
    </p>
  );
}
