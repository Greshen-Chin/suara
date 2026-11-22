import styles from "./StatusSiklus.module.css";

/** Siklus usulan: forum -> voting -> approved / rejected / done. */
export const TEKS_SIKLUS: Record<string, string> = {
  forum: "Sedang dibahas",
  voting: "Masuk hitungan anggaran",
  approved: "Disetujui",
  rejected: "Ditolak",
  done: "Selesai",
};

const GAMBAR: Record<string, React.ReactNode> = {
  // gelembung percakapan
  forum: <path d="M2.5 3.5h11v7.5H8.5L5.5 13.5V11h-3z" />,
  // tiga batang anggaran
  voting: <path d="M3 13V8.5M8 13V3M13 13V6" />,
  // lingkaran dan centang
  approved: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.3 8.3l1.9 1.9 3.5-3.9" />
    </>
  ),
  // lingkaran dan silang
  rejected: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" />
    </>
  ),
  // centang di atas garis dasar
  done: <path d="M3 7.5l3.2 3.2L13 4M3 13.5h10" />,
};

/**
 * Ikon dan teks selalu berdampingan: status tidak pernah hanya warna. `teks` menimpa kata bawaan
 * (mis. "Tidak dilanjutkan" untuk usulan forum yang ditolak sebelum dinilai) tanpa mengubah ikon dan warna.
 */
export function StatusSiklus({ status, teks: teksGanti }: { status: string; teks?: string }) {
  const teks = teksGanti ?? TEKS_SIKLUS[status] ?? status;
  return (
    <span className={`${styles.label} ${styles[status] ?? ""}`}>
      <svg
        className={styles.ikon}
        viewBox="0 0 16 16"
        width={16}
        height={16}
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GAMBAR[status] ?? GAMBAR.forum}
      </svg>
      {teks}
    </span>
  );
}
