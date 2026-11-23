import { URL_KODE_SUMBER, URL_VIDEO_DEMO } from "@/lib/tautan";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.kaki}>
      <div className={`wadah ${styles.isi}`}>
        <div className={styles.merek}>
          <div className={styles.logoRow}>
            <svg className={styles.logoIcon} viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M8 38C7 26 14 14 38 7C38 21 34 35 18 39C14 40 10 40 8 38Z" fill="#E8F3E9" />
              <path d="M10 37C15 26 23 18 36 9" stroke="#14261E" strokeWidth="3" strokeLinecap="round" />
            </svg>
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
