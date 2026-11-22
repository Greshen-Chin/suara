import styles from "./PaguSwitch.module.css";

interface Props {
  /** true = Rekomendasi SUARA, false = Suara terbanyak. */
  rekomendasi: boolean;
  onUbah: (rekomendasi: boolean) => void;
}

/**
 * Sakelar dua posisi. Satu <button role="switch">: Space atau Enter menggeser,
 * mengeklik tulisan di sisi tertentu memilih sisi itu. Nama aksesibelnya
 * "Rekomendasi SUARA"; aria-checked menyatakan apakah pilihan itu sedang aktif.
 */
export function PaguSwitch({ rekomendasi, onUbah }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rekomendasi}
      aria-label="Rekomendasi SUARA"
      className={styles.sakelar}
      onClick={(e) => {
        const sisi = (e.target as HTMLElement).closest<HTMLElement>("[data-sisi]")
          ?.dataset.sisi;
        onUbah(sisi ? sisi === "rekomendasi" : !rekomendasi);
      }}
    >
      <span
        data-sisi="suara"
        aria-hidden="true"
        className={`${styles.teks} ${rekomendasi ? "" : styles.aktif}`}
      >
        Suara terbanyak
      </span>
      <span className={styles.jalur} aria-hidden="true">
        <span className={styles.geser} />
      </span>
      <span
        data-sisi="rekomendasi"
        aria-hidden="true"
        className={`${styles.teks} ${rekomendasi ? styles.aktif : ""}`}
      >
        Rekomendasi SUARA
      </span>
    </button>
  );
}
