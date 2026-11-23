import { tanggalMusyawarahTeks } from "@/lib/keputusan-kalimat";
import styles from "./Keputusan.module.css";

/**
 * Cap stempel biru: "DIPUTUSKAN · 20 November 2026". Biru stempel memang untuk "yang dicap" (DESIGN.md). Satu cap
 * per halaman, dan isinya teks asli (bukan gambar), jadi tetap terbaca pembaca layar.
 */
export function CapKeputusan({ tanggal }: { tanggal: string | null }) {
  const teks = tanggalMusyawarahTeks(tanggal);
  return (
    <p className={styles.cap}>
      <span>DIPUTUSKAN</span>
      {teks && (
        <>
          <span className={styles.capTitik} aria-hidden="true">
            ·
          </span>
          <span className="sr-only"> pada </span>
          <span>{teks}</span>
        </>
      )}
    </p>
  );
}
