import styles from "./Forum.module.css";

/**
 * Kerangka daftar forum. Tinggi tiap bagian mendekati yang sebenarnya, supaya isi yang datang
 * tidak menggeser halaman (CLS). Tidak bergerak: tidak ada yang perlu diatur untuk
 * prefers-reduced-motion.
 */
export function SkeletonDaftar() {
  return (
    <div className={styles.kerangka} role="status" aria-label="Memuat usulan">
      <div className={styles.kerangkaFilter} aria-hidden="true" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.kerangkaBaris} aria-hidden="true">
          <div className={styles.blok} style={{ width: "42%" }} />
          <div className={styles.blok} style={{ width: "86%", height: "1.75rem" }} />
          <div className={styles.blok} style={{ width: "64%" }} />
          <div className={styles.blok} style={{ width: "30%" }} />
        </div>
      ))}
      <span className="sr-only">Memuat usulan…</span>
    </div>
  );
}
