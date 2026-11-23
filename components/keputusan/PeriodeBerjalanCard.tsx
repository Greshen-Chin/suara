import Image from "next/image";
import Link from "next/link";
import { PaguBar } from "@/components/landing/PaguBar";
import { desimal, ribuan, rupiah, rupiahRinci } from "@/lib/format";
import type { DataBeranda } from "@/lib/beranda";
import type { BarisRekomendasi, BarisWilayah } from "@/lib/data";
import { RUTE } from "@/lib/tautan";
import styles from "./Keputusan.module.css";

interface Props {
  beranda: DataBeranda;
  tahun: number;
}

function dapatkanGambarUsulan(judul: string, kategori: string): string {
  const teks = (judul + " " + kategori).toLowerCase();
  if (teks.includes("drainase") || teks.includes("irigasi") || teks.includes("sawah") || teks.includes("saluran")) {
    return "/assets/scenes/sawah-desa.png";
  }
  if (teks.includes("jembatan") || teks.includes("sungai")) {
    return "/assets/scenes/jembatan-desa.png";
  }
  if (teks.includes("jalan") || teks.includes("aspal") || teks.includes("paving") || teks.includes("sdn")) {
    return "/assets/scenes/hero-village-reference.jpg";
  }
  return "/assets/scenes/balai-desa.png";
}

export function PeriodeBerjalanCard({ beranda, tahun }: Props) {
  const { pagu, modeRekomendasi, usulan, wilayah } = beranda;
  const terpilih = modeRekomendasi.terpilih;
  const totalBiayaTerpilih = terpilih.reduce((acc, curr) => acc + curr.biaya, 0);
  const sisaRupiah = pagu - totalBiayaTerpilih;
  const totalDukungan = usulan.reduce((acc, curr) => acc + curr.vote_count, 0);

  // Proyek tertunda dengan urgensi tinggi (contoh: Talud)
  const usulanDitunda = usulan.find((u) => !u.selected && u.urgency_score >= 8);

  return (
    <div className={styles.berjalanWrap}>
      {/* 4-Column Metric Ribbon */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Pagu Anggaran Desa</span>
            <span className={styles.kpiIcon} aria-hidden="true">💰</span>
          </div>
          <div className={styles.kpiAngkaRow}>
            <span className={styles.kpiAngka}>{rupiah(pagu)}</span>
          </div>
          <p className={styles.kpiSub}>Batas mutlak APBDes murni {tahun}</p>
          <div className={styles.kpiBarAmber} aria-hidden="true" />
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Rekomendasi Terpilih</span>
            <span className={styles.kpiIcon} aria-hidden="true">🎯</span>
          </div>
          <div className={styles.kpiAngkaRow}>
            <span className={styles.kpiAngka}>{terpilih.length}</span>
            <span className={styles.kpiSatuan}>Usulan Proyek</span>
          </div>
          <p className={styles.kpiSub}>
            Total alokasi {rupiah(totalBiayaTerpilih)} ({Math.round((totalBiayaTerpilih / pagu) * 100)}%)
          </p>
          <div className={styles.kpiBarPine} aria-hidden="true" />
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Sisa Cadangan Kas</span>
            <span className={styles.kpiIcon} aria-hidden="true">🛡️</span>
          </div>
          <div className={styles.kpiAngkaRow}>
            <span className={styles.kpiAngka}>{rupiah(sisaRupiah)}</span>
          </div>
          <p className={styles.kpiSub}>Cadangan tanggap darurat &amp; SILPA</p>
          <div className={styles.kpiBarBlue} aria-hidden="true" />
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Partisipasi Warga</span>
            <span className={styles.kpiIcon} aria-hidden="true">👥</span>
          </div>
          <div className={styles.kpiAngkaRow}>
            <span className={styles.kpiAngka}>{totalDukungan}</span>
            <span className={styles.kpiSatuan}>Dukungan</span>
          </div>
          <p className={styles.kpiSub}>RW 01, RW 03, RW 07 terwakili</p>
          <div className={styles.kpiBarPurple} aria-hidden="true" />
        </div>
      </div>

      {/* Dual Garis Pagu Comparison Section */}
      <div className={styles.paguContainer}>
        <div className={styles.paguHeaderRow}>
          <div>
            <div className={styles.paguEyebrow}>
              <span>📊 Dua Garis, Satu Keputusan</span>
              <span className={styles.pemisah} aria-hidden="true">|</span>
              <span>Skala Anggaran Seragam {rupiah(pagu)}</span>
            </div>
            <h2 className={styles.paguTitle}>
              Komparasi: Rekomendasi Algoritma vs Rancangan Musyawarah
            </h2>
            <p className={styles.paguDesc}>
              Bandingkan bagaimana pagu dialokasikan. Proyek yang <strong>berbeda</strong> ditandai dengan bingkai putus-putus dan tanda <span className={styles.bedaSimbol}>≠</span>.
            </p>
          </div>

          <Link href={RUTE.simulasi} className={styles.tombolSimulasi}>
            <span>Uji di Simulasi Pagu</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Garis 1: Rekomendasi SUARA */}
        <div className={styles.garisBox}>
          <div className={styles.garisLabelRow}>
            <span className={styles.garisNama}>
              <span className={styles.dotGaris1} aria-hidden="true" />
              Garis 1: Rekomendasi Sistem SUARA (Berdasarkan Skor Knapsack 0/1)
            </span>
            <span className={styles.garisMeta}>
              Terpakai: <strong>{rupiah(totalBiayaTerpilih)} ({desimal((totalBiayaTerpilih / pagu) * 100)}%)</strong>
            </span>
          </div>
          <PaguBar
            pagu={pagu}
            mode={modeRekomendasi}
            ringkas
            skalaBulat
            kataStatus="Direkomendasikan"
            label={`Rekomendasi SUARA, pagu ${rupiah(pagu)}`}
          />
        </div>

        {/* Divergence note */}
        <div className={styles.divergenceNote}>
          <div className={styles.divergenceContent}>
            <span className={styles.divergenceSymbol} aria-hidden="true">≠</span>
            <span>
              Musyawarah Desa berwenang mengalihkan usulan darurat besar seperti <strong>Talud Tebing RW 07</strong> ke <em>Dana Tanggap Bencana BPBD</em> agar 4 proyek dasar tetap terealisasi penuh tanpa melampaui pagu APBDes.
            </span>
          </div>
          <span className={styles.divergenceBadge}>Status: Diajukan ke Dana Lain</span>
        </div>
      </div>

      {/* Spotlight Transparansi AI Knapsack */}
      {usulanDitunda && (
        <div className={styles.spotlightCard}>
          <div className={styles.spotlightGrid}>
            <div className={styles.spotlightMascotWrap}>
              <div className={styles.mascotFloatBox}>
                <Image
                  src="/assets/mascot/tunas-thinking.png"
                  alt="Tunas menimbang solusi Knapsack"
                  width={150}
                  height={150}
                  className={styles.mascotThinkingImg}
                />
                <span className={styles.aiBadge}>Transparansi AI</span>
              </div>
            </div>

            <div className={styles.spotlightDetails}>
              <div className={styles.spotlightTag}>
                <span aria-hidden="true">⚠️</span>
                <span>Catatan Akuntabilitas Algoritma (Knapsack 0/1)</span>
              </div>

              <h3 className={styles.spotlightHeading}>
                Mengapa Proyek {usulanDitunda.title} (Urgensi {usulanDitunda.urgency_score}/10) Ditunda oleh Sistem?
              </h3>

              <p className={styles.spotlightParagraph}>
                Usulan <em>{usulanDitunda.title}</em> dinilai memiliki urgensi darurat tinggi (<strong>{usulanDitunda.urgency_score}/10</strong>). Namun biayanya mencapai <strong>{rupiah(usulanDitunda.estimated_budget)}</strong> ({Math.round((usulanDitunda.estimated_budget / pagu) * 100)}% dari seluruh pagu desa). Jika dipaksakan masuk anggaran murni, pagu desa yang tersisa tidak cukup untuk membiayai kebutuhan dasar warga lainnya.
              </p>

              <div className={styles.solusiMusyawarahBox}>
                <div>
                  <span className={styles.solusiLabel}>Keputusan Solutif Musyawarah Desa:</span>
                  <span className={styles.solusiDesc}>
                    Alokasikan 4 usulan berbiaya proporsional, dan ajukan {usulanDitunda.title} ke <strong>BPBD Kabupaten</strong> sebagai penanganan tanggap darurat bencana.
                  </span>
                </div>
                <Link href={`${RUTE.forum}/${usulanDitunda.id}`} className={styles.solusiTombol}>
                  Lihat Detail Usulan →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scenic Priority Proposal Cards */}
      <div className={styles.scenicSection}>
        <div className={styles.scenicHeaderRow}>
          <div>
            <h3 className={styles.scenicTitle}>Daftar Usulan Prioritas Periode {tahun}</h3>
            <p className={styles.scenicSub}>Usulan yang masuk alokasi rekomendasi Knapsack 0/1 berdasarkan data voting dan urgensi warga</p>
          </div>
          <span className={styles.scenicTotalBadge}>
            Total Terbiayai: {rupiah(totalBiayaTerpilih)}
          </span>
        </div>

        <div className={styles.scenicGrid}>
          {usulan
            .filter((u) => u.selected)
            .slice(0, 4)
            .map((item, idx) => {
              const bgImg = dapatkanGambarUsulan(item.title, item.category);
              return (
                <article key={item.id} className={styles.scenicCard}>
                  <div className={styles.scenicImageContainer}>
                    <Image
                      src={bgImg}
                      alt={item.title}
                      width={480}
                      height={240}
                      className={styles.scenicCardImg}
                    />
                    <div className={styles.scenicCardOverlay} />

                    <div className={styles.scenicRankBadge}>
                      {String(idx + 1).padStart(2, "0")} · REKOMENDASI TERPILIH
                    </div>
                    <div className={styles.scenicScoreBadge}>
                      Skor {desimal(item.skor)} / 10
                    </div>

                    <div className={styles.scenicCardTitleBox}>
                      <span className={styles.scenicCategory}>
                        {item.category} · RW {String(item.rw).padStart(2, "0")}
                      </span>
                      <h4 className={styles.scenicCardTitle}>{item.title}</h4>
                    </div>
                  </div>

                  <div className={styles.scenicBody}>
                    <div className={styles.scenicCostRow}>
                      <span className={styles.costLabel}>Estimasi Biaya Pembangunan:</span>
                      <span className={styles.costValue}>{rupiah(item.estimated_budget)}</span>
                    </div>

                    <div className={styles.scenicIndicators}>
                      <div className={styles.indicatorBox}>
                        <span className={styles.indTitle}>URGENSI</span>
                        <span className={styles.indValAmber}>{item.urgency_score} / 10</span>
                      </div>
                      <div className={styles.indicatorBox}>
                        <span className={styles.indTitle}>DUKUNGAN</span>
                        <span className={styles.indValPine}>{item.vote_count} Warga</span>
                      </div>
                      <div className={styles.indicatorBox}>
                        <span className={styles.indTitle}>STATUS</span>
                        <span className={styles.indValEmerald}>Terpilih Pagu</span>
                      </div>
                    </div>

                    <div className={styles.scenicFoot}>
                      <span className={styles.statusPaguOk}>
                        <svg className={styles.checkIcon} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Masuk Rekomendasi APBDes
                      </span>
                      <Link href={`${RUTE.forum}/${item.id}`} className={styles.scenicDetailLink}>
                        Detail Usulan →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>

      {/* Pemerataan Anggaran Antar-Wilayah Cards */}
      <div className={styles.wilayahEquityContainer}>
        <div className={styles.wilayahHeaderRow}>
          <div>
            <h3 className={styles.wilayahHeading}>
              Dampak Terhadap Pemerataan Anggaran Antar-Wilayah
            </h3>
            <p className={styles.wilayahSub}>
              Normalisasi per 1.000 penduduk memastikan RW kecil terpencil mendapatkan hak pembangunan yang adil
            </p>
          </div>
          <span className={styles.wilayahTag}>Target Keadilan Sosial Desa</span>
        </div>

        <div className={styles.wilayahGrid}>
          {wilayah.map((w: BarisWilayah) => {
            // Hitung alokasi usulan terpilih untuk RW ini
            const alokasiRw = usulan
              .filter((u) => u.selected && u.rw === w.rw)
              .reduce((sum, u) => sum + u.estimated_budget, 0);
            const perJiwa = w.penduduk > 0 ? Math.round(alokasiRw / w.penduduk) : 0;
            const isPrioritasBaru = w.anggaran_lalu === 0 && alokasiRw > 0;

            return (
              <div
                key={w.rw}
                className={`${styles.wilayahCard} ${isPrioritasBaru ? styles.wilayahCardHighlight : ""}`}
              >
                <div className={styles.wilayahCardTop}>
                  <span className={styles.wilayahNama}>{w.nama}</span>
                  <span className={styles.wilayahPop}>{ribuan(w.penduduk)} Jiwa</span>
                </div>

                <div className={styles.wilayahStats}>
                  <div className={styles.statRow}>
                    <span>Anggaran Periode Lalu:</span>
                    <strong className={w.anggaran_lalu === 0 ? styles.merahTeks : ""}>
                      {w.anggaran_lalu === 0 ? "Rp 0 (Tertinggal)" : rupiah(w.anggaran_lalu)}
                    </strong>
                  </div>
                  <div className={styles.statRow}>
                    <span>Alokasi Rekomendasi {tahun}:</span>
                    <strong className={styles.alokasiSekarang}>{rupiah(alokasiRw)}</strong>
                  </div>
                  <div className={`${styles.statRow} ${styles.statBorder}`}>
                    <span>Alokasi per Jiwa:</span>
                    <strong className={styles.perJiwaTeks}>{rupiahRinci(perJiwa)} / jiwa</strong>
                  </div>
                </div>

                <p className={styles.wilayahKeterangan}>
                  {w.anggaran_lalu > 100_000_000
                    ? `${w.nama} menerima alokasi dominan di tahun lalu, sehingga skor pemerataannya disesuaikan secara proporsional.`
                    : isPrioritasBaru
                    ? `Pemerataan optimal terwujud: usulan vital didahulukan bagi dusun yang belum menerima dana di tahun lalu.`
                    : `Mendapatkan pembiayaan kebutuhan prioritas berdasarkan aspirasi warga.`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
