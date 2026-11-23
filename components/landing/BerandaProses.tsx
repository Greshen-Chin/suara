import styles from "./BerandaProses.module.css";

interface Props {
  /** true bila saran urgensi dari AI aktif. Pernyataan tentang AI harus benar menurut keadaan ini. */
  saranAi: boolean;
}

export function BerandaProses({ saranAi }: Props) {
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
              Sistem membandingkan dukungan warga, urgensi yang dinilai admin desa, dan pemerataan.
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

        <p className={styles.peranAi}>
          <strong>Peran AI:</strong> mengenali usulan yang mirip dari maknanya{" "}
          {saranAi
            ? "dan menyarankan nilai urgensi beserta alasannya; admin desa tetap menetapkan nilainya sendiri."
            : "supaya dukungan tidak terpecah. Urgensi dinilai admin desa, bukan AI."}{" "}
          AI tidak ikut memutuskan.
        </p>
      </div>
    </section>
  );
}
