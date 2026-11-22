import { URL_KODE_SUMBER, URL_VIDEO_DEMO } from "@/lib/tautan";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.kaki}>
      <div className={`wadah ${styles.isi}`}>
        <p className={styles.batas}>
          Rekomendasi untuk musyawarah desa, bukan pengesahan anggaran. Data
          dalam demo ini adalah data purwarupa.
        </p>
        <ul className={styles.tautan}>
          <li>
            <a href={URL_KODE_SUMBER}>Kode sumber</a>
          </li>
          <li>
            <a href={URL_VIDEO_DEMO}>Video demo</a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
