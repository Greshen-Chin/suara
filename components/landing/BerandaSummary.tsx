import { ribuan } from "@/lib/format";
import styles from "./BerandaSummary.module.css";

interface Props {
  pagu: number;
  jumlahUsulan: number;
  totalDukungan: number;
  jumlahWilayah: number;
}

export function BerandaSummary({
  pagu,
  jumlahUsulan,
  totalDukungan,
  jumlahWilayah,
}: Props) {
  const paguJuta = Math.round(pagu / 1_000_000);

  return (
    <section className={styles.pembungkus} aria-label="Ringkasan data desa">
      <div className={`wadah ${styles.grid}`}>
        <div className={styles.utama}>
          <span className={styles.label}>PAGU ANGGARAN DESA</span>
          <strong className={styles.nilaiUtama}>
            Rp{ribuan(paguJuta)} <small>juta</small>
          </strong>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>USULAN VOTING</span>
          <strong className={styles.nilai}>
            {jumlahUsulan} <small>usulan</small>
          </strong>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>TOTAL DUKUNGAN</span>
          <strong className={styles.nilai}>
            {ribuan(totalDukungan)} <small>dukungan</small>
          </strong>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>WILAYAH</span>
          <strong className={styles.nilai}>
            {jumlahWilayah} <small>RW</small>
          </strong>
        </div>
      </div>
    </section>
  );
}
