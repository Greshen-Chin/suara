import Image from "next/image";
import styles from "./SimulasiHero.module.css";

interface Props {
  deskripsi: string;
}

export function SimulasiHero({ deskripsi }: Props) {
  return (
    <div className={styles.heroCard}>
      <div className={styles.leftCol}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden="true" />
          <span>Laboratorium Transparansi APBDes</span>
        </div>

        <h1 className={styles.title}>Simulasi Anggaran &amp; Kriteria.</h1>

        <p className={styles.lead}>{deskripsi}</p>
      </div>

      <div className={styles.rightCol}>
        <div className={styles.mascotContainer}>
          <p className={styles.speechBubble}>
            &ldquo;Eksperimen aman: geser tuas pagu &amp; bobot untuk menguji seleksi Knapsack 0/1!&rdquo;
          </p>
          <div className={styles.tunasImgWrap}>
            <Image
              src="/assets/mascot/tunas-analyze.png"
              alt="Tunas menganalisis data alokasi anggaran"
              width={85}
              height={85}
              className={styles.tunasImg}
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
