import styles from "./Admin.module.css";

/** Kerangka pemuatan halaman admin: tinggi mendekati isi sebenarnya, tanpa lompatan saat isi datang. */
export function Kerangka({ judul }: { judul: string }) {
  return (
    <div className={styles.kerangka} role="status" aria-label={`Memuat ${judul}`}>
      <div className={styles.blok} style={{ width: "38%", height: "2.5rem" }} aria-hidden="true" />
      <div className={styles.blok} style={{ width: "70%" }} aria-hidden="true" />
      <div className={styles.blok} style={{ width: "100%", height: "9rem", marginTop: "1rem" }} aria-hidden="true" />
      <div className={styles.blok} style={{ width: "100%", height: "9rem" }} aria-hidden="true" />
      <span className="sr-only">Memuat {judul}…</span>
    </div>
  );
}
