import { URL_KODE_SUMBER, URL_VIDEO_DEMO } from "@/lib/tautan";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.kaki}>
      <div className={`wadah ${styles.isi}`}>
        <div className={styles.merek}>
          <div className={styles.logoRow}>
            <img
              src="/assets/logo/suara-mark.svg"
              width={28}
              height={28}
              alt="Logo SUARA"
              className={styles.logoIcon}
            />
            <span className={styles.namaApp}>SUARA</span>
          </div>
          <p className={styles.batas}>
            Sistem Usulan dan Aspirasi Rakyat. Rekomendasi untuk musyawarah desa, bukan pengesahan sepihak.
            Transparansi keputusan dengan audit trail terbuka untuk seluruh warga.
          </p>
        </div>

        <ul className={styles.tautan}>
          <li>
            <a href={URL_KODE_SUMBER} target="_blank" rel="noopener noreferrer">
              Kode Sumber (GitHub)
            </a>
          </li>
          {URL_VIDEO_DEMO && (
            <li>
              <a href={URL_VIDEO_DEMO} target="_blank" rel="noopener noreferrer">
                Video Demo
              </a>
            </li>
          )}
        </ul>
      </div>
    </footer>
  );
}
