import type { SaranPublik } from "@/lib/forum-data";
import { kalimatSaranPublik } from "@/lib/saran-urgensi";
import styles from "./SaranAiPublik.module.css";

/**
 * Di halaman usulan: nilai yang ditetapkan admin berdampingan dengan saran AI yang dibuka admin sebelum
 * memutuskan, lengkap dengan alasan dan kutipannya. Hanya tampil bila saran memang dibuka. Teks AI sebagai
 * teks biasa. AI hanya memberi bahan; yang menetapkan admin desa.
 */
export function SaranAiPublik({ urgensi, saran }: { urgensi: number; saran: SaranPublik }) {
  return (
    <div className={styles.saran}>
      <p className={styles.kalimat}>{kalimatSaranPublik(urgensi, saran.nilai)}</p>
      <details>
        <summary>Alasan dari saran AI</summary>
        <ul className={styles.alasan}>
          {saran.alasan.map((a) => (
            <li key={a.teks + a.kutipan}>
              <p>{a.teks}</p>
              <blockquote>“{a.kutipan}”</blockquote>
            </li>
          ))}
        </ul>
        <p className={styles.catatan}>
          Model: {saran.model}. Keyakinan {saran.keyakinan}. AI hanya memberi bahan; yang menetapkan admin desa.
        </p>
      </details>
    </div>
  );
}
