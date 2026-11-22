import type { PenjelasanDitunda } from "@/lib/pagu-model";
import styles from "./KenapaDitunda.module.css";

interface Props {
  penjelasan: PenjelasanDitunda[];
}

/** Panel jujur untuk usulan yang ditunda. <details> bawaan: bisa dibuka dengan keyboard. */
export function KenapaDitunda({ penjelasan }: Props) {
  if (penjelasan.length === 0) return null;
  return (
    <div className={styles.kelompok}>
      {penjelasan.map((p) => (
        <details key={p.id} className={styles.panel}>
          <summary className={styles.pertanyaan}>{p.pertanyaan}</summary>
          <div className={styles.jawaban}>
            {p.paragraf.map((teks, i) => (
              <p key={i}>{teks}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
