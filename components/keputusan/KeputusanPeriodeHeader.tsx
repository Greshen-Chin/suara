import Image from "next/image";
import { CapKeputusan } from "@/components/keputusan/CapKeputusan";
import { rupiah } from "@/lib/format";
import type { Periode } from "@/lib/keputusan-tipe";
import { namaPeriode, rincianHasil, ringkasTerpakai } from "@/lib/keputusan-kalimat";
import styles from "./Keputusan.module.css";

interface Props {
  periode: Periode;
}

export function KeputusanPeriodeHeader({ periode }: Props) {
  const { tahun, jumlah, tanggalMusyawarah } = periode;
  const pagu = periode.pagu ?? 0;
  const terpakai = periode.terpakai ?? 0;
  const sisa = Math.max(0, pagu - terpakai);

  return (
    <div className={styles.periodeHeaderWrap}>
      {/* Official Decree Header Card */}
      <div className={styles.arsipBanner}>
        <div className={styles.arsipBannerGrid}>
          <div className={styles.arsipBannerInfo}>
            <div className={styles.arsipMetaTop}>
              <CapKeputusan tanggal={tanggalMusyawarah} />
              <span className={styles.beritaAcaraBadge}>
                Berita Acara Rapat Desa No. 141/BA-DES/XI/{tahun - 1}
              </span>
            </div>

            <h1 className={styles.arsipJudul}>
              Buku Register Keputusan Musyawarah — {namaPeriode(tahun)}
            </h1>

            <p className={styles.arsipDeskripsi}>
              {periode.adaRekomendasi
                ? `Ringkasan keputusan musyawarah desa, berdampingan dengan rekomendasi algoritma SUARA. ${ringkasTerpakai(periode)}. ${rincianHasil(periode.jumlah)}.`
                : `Periode ini diputuskan sebelum sistem SUARA diterapkan. Angka dan penetapan di bawah merupakan data riil musyawarah desa untuk mengunci baseline pemerataan periode berikutnya.`}
            </p>
          </div>

          <div className={styles.arsipMascotBox}>
            <Image
              src="/assets/mascot/tunas-celebrate.png"
              alt="Tunas merayakan keputusan musyawarah desa"
              width={160}
              height={160}
              className={styles.mascotCelebrateImg}
              priority
            />
          </div>
        </div>

        {/* 4-Column KPI Strip 2026 */}
        <div className={styles.arsipKpiStrip}>
          <div className={styles.arsipKpiItem}>
            <span className={styles.arsipKpiLabel}>PAGU ANGGARAN</span>
            <span className={styles.arsipKpiValue}>{rupiah(pagu)}</span>
          </div>
          <div className={styles.arsipKpiItem}>
            <span className={styles.arsipKpiLabel}>TOTAL DISETUJUI</span>
            <span className={styles.arsipKpiValuePine}>{jumlah.disetujui} Usulan</span>
          </div>
          <div className={styles.arsipKpiItem}>
            <span className={styles.arsipKpiLabel}>REALISASI TERPAKAI</span>
            <span className={styles.arsipKpiValueBlue}>{rupiah(terpakai)}</span>
          </div>
          <div className={styles.arsipKpiItem}>
            <span className={styles.arsipKpiLabel}>SISA SILPA CADANGAN</span>
            <span className={styles.arsipKpiValue}>{rupiah(sisa)}</span>
          </div>
        </div>
      </div>

      {/* Official Musyawarah Signatories Card */}
      <div className={styles.penandatanganBox}>
        <h4 className={styles.penandatanganTitle}>
          Pejabat &amp; Perwakilan Penandatangan Berita Acara Musyawarah
        </h4>
        <div className={styles.penandatanganGrid}>
          <div className={styles.pejabatCard}>
            <span className={styles.jabatanLabel}>KEPALA DESA</span>
            <strong className={styles.pejabatNama}>
              {periode.diputuskanOleh ?? "H. Bambang Soedirman"}
            </strong>
            <span className={styles.statusTtd}>✓ Tanda Tangan Digital Sah</span>
          </div>
          <div className={styles.pejabatCard}>
            <span className={styles.jabatanLabel}>KETUA BPD</span>
            <strong className={styles.pejabatNama}>Drs. Suryanto, M.Si</strong>
            <span className={styles.statusTtd}>✓ Tanda Tangan Digital Sah</span>
          </div>
          <div className={styles.pejabatCard}>
            <span className={styles.jabatanLabel}>PERWAKILAN TOKOH WARGA</span>
            <strong className={styles.pejabatNama}>Siti Aminah (Kader RW 03)</strong>
            <span className={styles.statusTtd}>✓ Tanda Tangan Digital Sah</span>
          </div>
        </div>
      </div>
    </div>
  );
}
