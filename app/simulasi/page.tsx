import type { Metadata } from "next";
import Link from "next/link";
import { KalkulatorSimulasi } from "@/components/simulasi/KalkulatorSimulasi";
import { muatBeranda } from "@/lib/beranda";
import styles from "@/components/simulasi/Simulasi.module.css";

export const metadata: Metadata = {
  title: "Simulasi anggaran",
  description:
    "Simulasikan pagu anggaran dan bobot kriteria musyawarah desa secara interaktif. Uji coba alokasi usulan warga dengan transparansi penuh.",
};

export default async function HalamanSimulasi() {
  const data = await muatBeranda();

  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumbNav}>
        <ol className={styles.breadcrumbList}>
          <li>
            <Link href="/" className={styles.breadcrumbLink}>
              Beranda
            </Link>
          </li>
          <li aria-hidden="true" className={styles.breadcrumbPemisah}>
            /
          </li>
          <li aria-current="page" className={styles.breadcrumbAktif}>
            Simulasi anggaran
          </li>
        </ol>
      </nav>

      <header className={styles.kepalaHalaman}>
        <h1 className={styles.judulHalaman}>Simulasikan pilihan anggaran</h1>
        <p className={styles.keteranganHalaman}>
          Ubah pagu dan cara memilih usulan untuk melihat apa yang mungkin terbiayai.
          Bandingkan hasilnya tanpa mengubah anggaran resmi desa.
        </p>
      </header>

      <KalkulatorSimulasi
        paguAwal={data.pagu}
        bobotAwal={data.bobot}
        wilayahList={data.wilayah}
        usulanList={data.usulan}
        dataContoh={data.dataContoh}
      />
    </main>
  );
}
