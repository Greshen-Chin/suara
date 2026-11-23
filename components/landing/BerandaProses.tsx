import styles from "./BerandaProses.module.css";

export function BerandaProses() {
  return (
    <section className={styles.proses} aria-labelledby="judul-proses">
      <div className={`wadah ${styles.inner}`}>
        <div className={styles.judulBlok}>
          <div className={styles.eyebrow}>PROSES YANG TERBUKA</div>
          <h2 id="judul-proses" className={styles.judul}>
            Dari usulan sampai musyawarah.
          </h2>
        </div>

        <ol className={styles.daftarLangkah}>
          <li className={styles.langkah}>
            <span className={styles.nomor}>01</span>
            <strong className={styles.judulLangkah}>Sampaikan aspirasi</strong>
            <p className={styles.deskripsiLangkah}>
              Warga mengajukan kebutuhan di forum secara terbuka.
            </p>
          </li>
          <li className={styles.langkah}>
            <span className={styles.nomor}>02</span>
            <strong className={styles.judulLangkah}>Bandingkan kebutuhan</strong>
            <p className={styles.deskripsiLangkah}>
              Urgensi, dukungan, dan pemerataan dinilai oleh sistem.
            </p>
          </li>
          <li className={styles.langkah}>
            <span className={styles.nomor}>03</span>
            <strong className={styles.judulLangkah}>Musyawarahkan</strong>
            <p className={styles.deskripsiLangkah}>
              Desa menetapkan keputusan dengan alasan tertulis dan akuntabel.
            </p>
          </li>
        </ol>

        <div className={styles.maskotWadah}>
          <img
            src="/assets/mascot/tunas-celebrate.png"
            alt="Tunas merayakan partisipasi warga desa"
            className={styles.maskotProses}
          />
        </div>
      </div>
    </section>
  );
}
