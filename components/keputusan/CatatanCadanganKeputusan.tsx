import styles from "./Keputusan.module.css";

/** Penanda bahwa halaman keputusan memakai data cadangan (database tidak terjangkau atau migrasi 0006 belum dijalankan). */
export function CatatanCadanganKeputusan() {
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
        <strong>Ini data contoh.</strong> Data keputusan sedang tidak bisa dimuat, jadi yang tampil hanya periode lampau
        yang tersimpan di aplikasi. Coba lagi beberapa menit lagi.
      </p>
    </div>
  );
}
