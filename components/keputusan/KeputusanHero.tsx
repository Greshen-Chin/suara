import Image from "next/image";
import styles from "./Keputusan.module.css";

export function KeputusanHero() {
  return (
    <section className={styles.heroSection} aria-labelledby="judul-utama-keputusan">
      <div className={styles.heroGrid}>
        {/* Left Column: Mission & Axiom */}
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <span>Kedaulatan Warga & Akuntabilitas APBDes</span>
          </div>

          <h1 id="judul-utama-keputusan" className={styles.heroTitle}>
            Keputusan Musyawarah Desa.<br />
            <span className={styles.heroGradient}>Keadilan Nyata yang Tertulis.</span>
          </h1>

          <p className={styles.heroLead}>
            Musyawarah desa memegang mandat tertinggi penetapan pembangunan. Algoritma SUARA memberi rekomendasi objektif multi-kriteria; <strong>setiap perbedaan keputusan dicatat terbuka beserta berita acara dan alasan yang dapat dibaca seluruh warga.</strong>
          </p>

          <div className={styles.aksiomaRow}>
            <div className={styles.aksiomaItem}>
              <span className={styles.aksiomaIcon} aria-hidden="true">⚖️</span>
              <span>SUARA Merekomendasikan</span>
            </div>
            <span className={styles.aksiomaPanah} aria-hidden="true">→</span>
            <div className={styles.aksiomaItem}>
              <span className={styles.aksiomaIcon} aria-hidden="true">🏛️</span>
              <span>Musyawarah Memutuskan</span>
            </div>
            <span className={styles.aksiomaPanah} aria-hidden="true">→</span>
            <div className={styles.aksiomaItem}>
              <span className={styles.aksiomaIcon} aria-hidden="true">📜</span>
              <span>Perbedaan Wajib Beralasan</span>
            </div>
          </div>
        </div>

        {/* Right Column: Village Art & Welcoming Tunas */}
        <div className={styles.heroVisualCol}>
          <div className={styles.heroArtCard}>
            <div className={styles.heroImageWrapper}>
              <Image
                src="/assets/scenes/hero-approved-tunas-village.png"
                alt="Balai Musyawarah Desa Sukamaju"
                width={640}
                height={480}
                className={styles.heroVillageImg}
                priority
              />
              <div className={styles.heroGradientOverlay} />
            </div>

            <div className={styles.balaiTag}>
              <span className={styles.balaiDot} aria-hidden="true" />
              <span>Balai Desa Sukamaju</span>
            </div>

            <div className={styles.tunasFloatWrap}>
              <Image
                src="/assets/mascot/tunas-wave.png"
                alt="Tunas, maskot akuntabilitas SUARA"
                width={180}
                height={180}
                className={styles.tunasHeroMascot}
                priority
              />
            </div>

            <div className={styles.speechBubble}>
              <p className={styles.speechText}>
                &ldquo;Musyawarah bukan cap stempel. Mari kita teliti mana usulan yang disetujui &amp; mengapa!&rdquo;
              </p>
              <span className={styles.speechAuthor}>Tunas · Maskot Akuntabilitas SUARA</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.heroHillsDivider} aria-hidden="true">
        <Image
          src="/assets/scenes/decorative-hills.svg"
          alt=""
          width={1440}
          height={60}
          className={styles.hillsSvg}
        />
      </div>
    </section>
  );
}
