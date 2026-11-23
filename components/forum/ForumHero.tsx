import Image from "next/image";
import Link from "next/link";
import styles from "./ForumHero.module.css";

interface Props {
  urlUsul: string;
}

export function ForumHero({ urlUsul }: Props) {
  return (
    <div className={styles.heroCard}>
      <div className={styles.leftCol}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden="true" />
          <span>Ruang Aspirasi &amp; Usulan Warga</span>
        </div>

        <h1 className={styles.title}>Forum Warga Desa.</h1>

        <p className={styles.lead}>
          Baca usulan warga, dukung yang Anda prioritaskan, dan pantau posisinya terhadap pagu anggaran desa.
        </p>

        <div className={styles.actionRow}>
          <Link href="/peta" className={styles.petaBtn}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            <span>Lihat Peta Usulan</span>
          </Link>

          <Link href={urlUsul} className={styles.ajukanBtn}>
            <span>+ Ajukan Usulan</span>
          </Link>
        </div>
      </div>

      <div className={styles.rightCol}>
        <div className={styles.mascotContainer}>
          <p className={styles.speechBubble}>
            &ldquo;Punya gagasan pembangunan untuk desa kita? Ajukan usulanmu sekarang!&rdquo;
          </p>
          <div className={styles.tunasImgWrap}>
            <Image
              src="/assets/mascot/tunas-proposal.png"
              alt="Tunas membawa berkas usulan"
              width={80}
              height={80}
              className={styles.tunasImg}
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
