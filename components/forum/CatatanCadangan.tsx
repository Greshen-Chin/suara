import styles from "./Forum.module.css";

/** Penanda bahwa halaman ini memakai data cadangan. Selalu ikut dengan alasan aksi tulis dimatikan. */
export function CatatanCadangan() {
  return (
    <div role="note" className={styles.cadangan}>
      <svg
        viewBox="0 0 16 16"
        width={20}
        height={20}
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 2.5l6 10.5H2z" />
        <path d="M8 6.8v3M8 11.6v.2" />
      </svg>
      <p>
        <strong>Ini data cadangan.</strong> Server data sedang tidak bisa dijangkau, jadi angkanya bisa
        tertinggal. Anda masih bisa membaca. Mendukung, berkomentar, dan mengajukan usulan dimatikan
        sampai server kembali.
      </p>
    </div>
  );
}
