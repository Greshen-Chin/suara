"use client";

import { useId, useMemo, useState } from "react";
import type { BarisRekomendasi, BarisWilayah } from "@/lib/data";
import { rupiah, rupiahRinci, ribuan } from "@/lib/format";
import {
  greedyPilih,
  pilihOptimal,
  type Bobot,
  type Usulan,
  type Wilayah,
} from "@/lib/seleksi";
import { IkonSuara } from "@/components/ui/IkonSuara";
import styles from "./Simulasi.module.css";

interface Props {
  paguAwal: number;
  bobotAwal: Bobot;
  wilayahList: BarisWilayah[];
  usulanList: BarisRekomendasi[];
  dataContoh?: boolean;
}

/** 3 Preset Pagu Skenario sesuai standar Master Prompt */
const PRESET_PAGU = [
  { label: "150 Jt", nilai: 150_000_000 },
  { label: "300 Jt (Pagu resmi)", nilai: 300_000_000 },
  { label: "500 Jt", nilai: 500_000_000 },
];

/** Palet warna harmonis civic tech untuk segmen batang visualisasi */
const PALET_WARNA = [
  "#176448", // Hijau hutan primer
  "#0F5132", // Hijau pinus pekat
  "#27409B", // Biru stempel musyawarah
  "#B45309", // Amber marka
  "#0D9488", // Teal telaga
  "#4338CA", // Indigo arsip
  "#047857", // Zamrud
  "#1D4ED8", // Biru bahari
];

export function KalkulatorSimulasi({
  paguAwal,
  bobotAwal,
  wilayahList,
  usulanList,
}: Props) {
  const [pagu, setPagu] = useState<number>(paguAwal);
  const [mode, setMode] = useState<"rekomendasi" | "suara">("rekomendasi");
  const [bobot, setBobot] = useState<Bobot>(bobotAwal);

  const paguInputId = useId();
  const paguSliderId = useId();

  // Konversi data usulan untuk engine seleksi
  const usulanItems: Usulan[] = useMemo(
    () =>
      usulanList.map((u) => ({
        id: u.id,
        title: u.title,
        namaSingkat: u.nama_singkat,
        category: u.category,
        rw: u.rw,
        estimatedBudget: u.estimated_budget,
        voteCount: u.vote_count,
        urgencyScore: u.urgency_score,
      })),
    [usulanList],
  );

  // Konversi data wilayah untuk engine seleksi
  const wilayahItems: Wilayah[] = useMemo(
    () =>
      wilayahList.map((w) => ({
        rw: w.rw,
        nama: w.nama,
        penduduk: w.penduduk,
        anggaranLalu: w.anggaran_lalu,
      })),
    [wilayahList],
  );

  const totalBobot = bobot.popularitas + bobot.urgensi + bobot.pemerataan;
  const isBobotValid = totalBobot === 100;
  const isBaselinePagu = pagu === paguAwal;

  // Hitung hasil seleksi secara dinamis dengan engine resmi
  const hasil = useMemo(() => {
    if (mode === "rekomendasi") {
      return pilihOptimal(usulanItems, wilayahItems, pagu, bobot);
    }
    return greedyPilih(usulanItems, wilayahItems, pagu, "suara", bobot);
  }, [mode, usulanItems, wilayahItems, pagu, bobot]);

  const terpilih = useMemo(() => hasil.filter((h) => h.selected), [hasil]);
  const tidakTerpilih = useMemo(() => hasil.filter((h) => !h.selected), [hasil]);

  const totalBiayaTerpilih = useMemo(
    () => terpilih.reduce((n, u) => n + u.estimatedBudget, 0),
    [terpilih],
  );

  const sisaPagu = Math.max(0, pagu - totalBiayaTerpilih);
  const persenSerap =
    pagu > 0 ? Math.min(100, Math.round((totalBiayaTerpilih / pagu) * 100)) : 0;

  const rwTerjangkauSet = useMemo(
    () => new Set(terpilih.map((t) => t.rw)),
    [terpilih],
  );
  const rwTerjangkau = rwTerjangkauSet.size;

  const daftarRwTerpilih = useMemo(() => {
    const list = Array.from(rwTerjangkauSet).sort((a, b) => a - b);
    return list.map((rw) => `RW ${String(rw).padStart(2, "0")}`).join(", ");
  }, [rwTerjangkauSet]);

  function handleResetBobot() {
    setBobot({ ...bobotAwal });
  }

  function handleResetPagu() {
    setPagu(paguAwal);
  }

  return (
    <div className={styles.simulasiLayout}>
      {/* Pemberitahuan Tenang (Glass Notice Bar) */}
      <div className={styles.pemberitahuanSimulasi} role="note" aria-live="polite">
        <div className={styles.pemberitahuanKiri}>
          <div className={styles.pulseDotWadah} aria-hidden="true">
            <span className={styles.pulseDot} />
            <span className={styles.pulseRing} />
          </div>
          <span className={styles.pemberitahuanTeks}>
            <strong>Skenario Simulasi:</strong> Eksplorasi alokasi dana secara interaktif. Anggaran resmi APBDes tidak berubah.
          </span>
        </div>
        <div className={styles.pemberitahuanStatus}>
          <span className={styles.statusLabel}>Pagu resmi desa:</span>
          <span className={styles.statusNilai}>{rupiah(paguAwal)}</span>
          {!isBaselinePagu ? (
            <span className={styles.badgeSkenarioAktif}>
              Skenario aktif: {rupiah(pagu)}
            </span>
          ) : (
            <span className={styles.badgeBaselineResmi}>
              Sesuai ketetapan
            </span>
          )}
        </div>
      </div>

      {/* Pintasan Cepat Mobile untuk Langsung Loncat ke Hasil */}
      <div className={styles.wadahLompatMobile}>
        <a href="#hasil-simulasi" className={styles.tombolLompatMobile}>
          <span>Lihat hasil simulasi</span>
          <span aria-hidden="true">↓</span>
        </a>
      </div>

      {/* Grid Utama: Rel Kontrol Pengaturan (Kiri ~320px) vs Panel Hasil Terbuka (Kanan) */}
      <div className={styles.gridUtama}>
        {/* Kolom Kiri: Pengaturan Skenario Simulasi */}
        <aside className={styles.panelKontrol} aria-label="Pengaturan Skenario Simulasi">
          <div className={styles.panelKontrolKepala}>
            <div className={styles.panelKontrolIconWadah} aria-hidden="true">
              <IkonSuara nama="pengaturan" ukuran={18} />
            </div>
            <div>
              <h2 className={styles.panelKontrolJudul}>Parameter Skenario</h2>
              <span className={styles.panelKontrolKeterangan}>Ubah asumsi perhitungan</span>
            </div>
          </div>

          {/* Grup 1: Pagu Simulasi */}
          <section className={styles.grupInput} aria-labelledby="label-pagu">
            <div className={styles.labelBaris}>
              <label id="label-pagu" htmlFor={paguInputId} className={styles.labelUtama}>
                Pagu simulasi
              </label>
              {!isBaselinePagu && (
                <span className={styles.penandaSkenario}>Skenario Uji Coba</span>
              )}
            </div>

            {/* Input Nominal Rupiah dengan Pemisah Ribuan Otomatis */}
            <div className={styles.inputUangWadah}>
              <span className={styles.inputPrefix}>Rp</span>
              <input
                id={paguInputId}
                type="text"
                inputMode="numeric"
                value={pagu > 0 ? ribuan(pagu) : ""}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const val = Number(digits);
                  setPagu(Math.min(800_000_000, val));
                }}
                className={styles.inputUang}
                aria-label="Pagu simulasi dalam nominal rupiah"
              />
              <span className={styles.inputUangRingkas}>{rupiah(pagu)}</span>
            </div>

            {/* Range Slider yang Aksesibel dengan Track Bergradasi */}
            <div className={styles.sliderWadah}>
              <input
                id={paguSliderId}
                type="range"
                min={50_000_000}
                max={800_000_000}
                step={10_000_000}
                value={pagu}
                onChange={(e) => setPagu(Number(e.target.value))}
                className={styles.slider}
                aria-label="Penggeser nominal pagu"
              />
              <div className={styles.sliderRentang}>
                <span>Rp50 Jt</span>
                <span>Rp800 Jt</span>
              </div>
            </div>

            {/* Maksimal 3 Preset Skenario Sesuai Spesifikasi */}
            <div className={styles.presetBaris} role="group" aria-label="Preset Pagu Anggaran">
              {PRESET_PAGU.map((preset) => (
                <button
                  key={preset.nilai}
                  type="button"
                  onClick={() => setPagu(preset.nilai)}
                  className={`${styles.chipPreset} ${pagu === preset.nilai ? styles.chipPresetAktif : ""}`}
                  aria-pressed={pagu === preset.nilai}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Tombol Kembali ke Baseline Resmi */}
            {!isBaselinePagu && (
              <button
                type="button"
                onClick={handleResetPagu}
                className={styles.tombolKembaliBaseline}
              >
                <IkonSuara nama="putar" ukuran={14} aria-hidden="true" />
                <span>Kembali ke pagu resmi ({rupiah(paguAwal)})</span>
              </button>
            )}
          </section>

          {/* Grup 2: Metode Pemilihan Usulan */}
          <section className={styles.grupInput} aria-labelledby="label-metode">
            <div className={styles.labelBaris}>
              <span id="label-metode" className={styles.labelUtama}>
                Metode pemilihan
              </span>
            </div>
            <div
              className={styles.segmentedControl}
              role="radiogroup"
              aria-label="Metode penentuan prioritas usulan"
            >
              <button
                type="button"
                role="radio"
                aria-checked={mode === "rekomendasi"}
                onClick={() => setMode("rekomendasi")}
                className={`${styles.segmentedTombol} ${mode === "rekomendasi" ? styles.segmentedTombolAktif : ""}`}
              >
                <IkonSuara nama="timbangan" ukuran={15} aria-hidden="true" />
                <span>Rekomendasi SUARA</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "suara"}
                onClick={() => setMode("suara")}
                className={`${styles.segmentedTombol} ${mode === "suara" ? styles.segmentedTombolAktif : ""}`}
              >
                <IkonSuara nama="warga" ukuran={15} aria-hidden="true" />
                <span>Suara terbanyak</span>
              </button>
            </div>
          </section>

          {/* Grup 3: Bobot Musyawarah (Hanya aktif dalam Mode Rekomendasi) */}
          {mode === "rekomendasi" ? (
            <section className={styles.grupInput} aria-labelledby="label-bobot">
              <div className={styles.labelBaris}>
                <span id="label-bobot" className={styles.labelUtama}>
                  Bobot kriteria musyawarah
                </span>
                <span
                  className={
                    isBobotValid
                      ? styles.validasiBobotTepat
                      : styles.validasiBobotGalat
                  }
                  role="status"
                >
                  {isBobotValid ? "✓ Total 100%" : `Total: ${totalBobot}%`}
                </span>
              </div>

              <div className={styles.daftarBobot}>
                {/* 1. Popularitas Dukungan */}
                <div className={styles.barisBobot}>
                  <div className={styles.headerBobot}>
                    <label htmlFor="bobot-pop" className={styles.labelKriteria}>
                      <span className={styles.kriteriaIcon}>👥</span>
                      <span>Dukungan per 1.000 warga</span>
                    </label>
                    <span className={styles.nilaiKriteriaBadge}>{bobot.popularitas}%</span>
                  </div>
                  <input
                    id="bobot-pop"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={bobot.popularitas}
                    onChange={(e) =>
                      setBobot({ ...bobot, popularitas: Number(e.target.value) })
                    }
                    className={styles.slider}
                  />
                </div>

                {/* 2. Urgensi Masalah */}
                <div className={styles.barisBobot}>
                  <div className={styles.headerBobot}>
                    <label htmlFor="bobot-urg" className={styles.labelKriteria}>
                      <span className={styles.kriteriaIcon}>⚡</span>
                      <span>Tingkat urgensi masalah</span>
                    </label>
                    <span className={styles.nilaiKriteriaBadge}>{bobot.urgensi}%</span>
                  </div>
                  <input
                    id="bobot-urg"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={bobot.urgensi}
                    onChange={(e) =>
                      setBobot({ ...bobot, urgensi: Number(e.target.value) })
                    }
                    className={styles.slider}
                  />
                </div>

                {/* 3. Pemerataan Antar RW */}
                <div className={styles.barisBobot}>
                  <div className={styles.headerBobot}>
                    <label htmlFor="bobot-pem" className={styles.labelKriteria}>
                      <span className={styles.kriteriaIcon}>⚖</span>
                      <span>Pemerataan anggaran RW</span>
                    </label>
                    <span className={styles.nilaiKriteriaBadge}>{bobot.pemerataan}%</span>
                  </div>
                  <input
                    id="bobot-pem"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={bobot.pemerataan}
                    onChange={(e) =>
                      setBobot({ ...bobot, pemerataan: Number(e.target.value) })
                    }
                    className={styles.slider}
                  />
                </div>
              </div>

              {/* Status Validasi Total Bobot */}
              {!isBobotValid && (
                <p className={styles.pesanGalatBobot} role="alert">
                  Total bobot kriteria harus tepat 100% agar perhitungan alokasi optimal bekerja secara akurat.
                </p>
              )}

              {/* Tombol Reset Bobot ke Nilai Resmi */}
              <button
                type="button"
                onClick={handleResetBobot}
                className={styles.tombolResetBobot}
              >
                <IkonSuara nama="putar" ukuran={14} aria-hidden="true" />
                <span>Reset ke bobot resmi (30% / 40% / 30%)</span>
              </button>
            </section>
          ) : (
            <div className={styles.infoModeSuara}>
              <div className={styles.infoModeSuaraHeader}>
                <IkonSuara nama="info" ukuran={16} />
                <strong>Seleksi Suara Terbanyak</strong>
              </div>
              <p className={styles.teksInfoSuara}>
                Usulan diserap secara murni berdasarkan urutan dukungan warga terbanyak hingga pagu habis. Kriteria urgensi dan pemerataan RW tidak diperhitungkan.
              </p>
            </div>
          )}
        </aside>

        {/* Kolom Kanan: Hasil Simulasi Langsung Tanpa Kotak Border Tebal */}
        <section
          id="hasil-simulasi"
          className={styles.panelHasil}
          aria-label="Hasil Perhitungan Simulasi Anggaran"
        >
          {/* Baris 1: Kartu Hero Hasil Terbuka dengan Ambient Glow */}
          <div className={styles.heroHasilCard}>
            <div className={styles.heroHasilAura} aria-hidden="true" />
            
            <div className={styles.heroHasilContent}>
              <div className={styles.heroHeaderBaris}>
                <div className={styles.heroTagWadah}>
                  <IkonSuara nama="dompet" ukuran={16} />
                  <span className={styles.heroLabelKecil}>Kapasitas Pembiayaan Terpilih</span>
                </div>
                <div className={styles.heroBadgePersen}>
                  <span className={styles.liveIndicatorDot} aria-hidden="true" />
                  <span className={styles.angkaPersen}>{persenSerap}%</span>
                  <span className={styles.labelPersen}>terserap</span>
                </div>
              </div>

              <div className={styles.heroNominalBaris}>
                <span className={styles.heroNominal}>{rupiahRinci(totalBiayaTerpilih)}</span>
                <span className={styles.heroDari}>dari {rupiahRinci(pagu)} pagu</span>
              </div>

              {/* Track Progres Multi-Lapisan Modern */}
              <div className={styles.trackProgresWadah} aria-hidden="true">
                <div
                  className={styles.trackProgresIsi}
                  style={{ width: `${Math.min(100, persenSerap)}%` }}
                >
                  <span className={styles.trackShine} />
                </div>
              </div>
            </div>
          </div>

          {/* Baris 2: 3 Kartu Metrik Ramping Bertekstur Halus (Dribbble Style KPI Cards) */}
          <div className={styles.metrikGrid}>
            {/* Metrik 1: Usulan Terpilih */}
            <div className={styles.metrikCard}>
              <div className={styles.metrikCardHeader}>
                <div className={`${styles.metrikIconBadge} ${styles.badgeGreen}`}>
                  <IkonSuara nama="keputusan" ukuran={18} />
                </div>
                <span className={styles.metrikCardTag}>Paket Alokasi</span>
              </div>
              <div className={styles.angkaTipografi}>{terpilih.length} usulan</div>
              <div className={styles.keteranganTipografi}>
                Terpilih dari total {hasil.length} usulan musyawarah desa
              </div>
            </div>

            {/* Metrik 2: Sisa Pagu */}
            <div className={styles.metrikCard}>
              <div className={styles.metrikCardHeader}>
                <div className={`${styles.metrikIconBadge} ${styles.badgeAmber}`}>
                  <IkonSuara nama="anggaran" ukuran={18} />
                </div>
                <span className={styles.metrikCardTag}>Cadangan Kas</span>
              </div>
              <div className={styles.angkaTipografi}>{rupiah(sisaPagu)}</div>
              <div className={styles.keteranganTipografi}>
                Sisa pagu tidak teralokasi ({100 - persenSerap}% sisa kapasitas)
              </div>
            </div>

            {/* Metrik 3: Cakupan Wilayah */}
            <div className={styles.metrikCard}>
              <div className={styles.metrikCardHeader}>
                <div className={`${styles.metrikIconBadge} ${styles.badgeBlue}`}>
                  <IkonSuara nama="wilayah" ukuran={18} />
                </div>
                <span className={styles.metrikCardTag}>Pemerataan RW</span>
              </div>
              <div className={styles.angkaTipografi}>
                {rwTerjangkau} dari {wilayahList.length} RW
              </div>
              <div className={styles.keteranganTipografi}>
                {rwTerjangkau === wilayahList.length
                  ? `Mencakup seluruh wilayah desa (${daftarRwTerpilih})`
                  : `Menjangkau usulan di ${daftarRwTerpilih}`}
              </div>
            </div>
          </div>

          {/* Baris 3: Visualisasi Alokasi Garis Pagu (Segmented Track Kapsul + Legenda) */}
          <div className={styles.seksiVisualisasiCard}>
            <div className={styles.seksiVisualisasiKepala}>
              <div>
                <h3 className={styles.subjudulSeksi}>Komposisi Alokasi Proyek</h3>
                <span className={styles.subjudulKeterangan}>
                  Proporsi penyerapan anggaran per paket pekerjaan terhadap total kapasitas
                </span>
              </div>
              <span className={styles.pillRingkasUsulan}>
                {terpilih.length} Proyek Terdanai
              </span>
            </div>

            {/* Rel Batang Kapsul Modern (Revolut / Apple Card Style Segments) */}
            <div
              className={styles.batangRelKapsul}
              role="img"
              aria-label={`Visualisasi alokasi pagu: ${persenSerap}% terserap, ${100 - persenSerap}% sisa cadangan`}
            >
              {terpilih.map((u, index) => {
                const lebarPersen = pagu > 0 ? (u.estimatedBudget / pagu) * 100 : 0;
                const warna = PALET_WARNA[index % PALET_WARNA.length];
                return (
                  <div
                    key={u.id}
                    className={styles.segmenKapsul}
                    style={{ width: `${lebarPersen}%`, backgroundColor: warna }}
                    title={`${index + 1}. ${u.title}: ${rupiah(u.estimatedBudget)} (${lebarPersen.toFixed(1)}%)`}
                  >
                    <span className={styles.segmenSheen} />
                  </div>
                );
              })}
              {sisaPagu > 0 && (
                <div
                  className={styles.segmenSisaKapsul}
                  style={{ width: `${pagu > 0 ? (sisaPagu / pagu) * 100 : 0}%` }}
                  title={`Sisa pagu cadangan: ${rupiah(sisaPagu)} (${(100 - persenSerap).toFixed(1)}%)`}
                >
                  <span className={styles.teksSisaKapsul}>Sisa {rupiah(sisaPagu)}</span>
                </div>
              )}
            </div>

            {/* Legenda Card Berdampingan Bersih */}
            <div className={styles.legendaGrid}>
              {terpilih.map((u, index) => {
                const warna = PALET_WARNA[index % PALET_WARNA.length];
                const porsi = pagu > 0 ? ((u.estimatedBudget / pagu) * 100).toFixed(1) : "0";
                return (
                  <div key={u.id} className={styles.legendaItemCard}>
                    <span
                      className={styles.legendaPillNomor}
                      style={{ backgroundColor: warna }}
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <div className={styles.legendaDetail}>
                      <span className={styles.legendaJudul}>
                        {u.namaSingkat || u.title}
                      </span>
                      <span className={styles.legendaNominal}>
                        {rupiah(u.estimatedBudget)} · <strong>{porsi}%</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
              {sisaPagu > 0 && (
                <div className={`${styles.legendaItemCard} ${styles.legendaItemSisa}`}>
                  <span className={styles.legendaPillSisa} aria-hidden="true">
                    •
                  </span>
                  <div className={styles.legendaDetail}>
                    <span className={styles.legendaJudul}>Sisa pagu cadangan</span>
                    <span className={styles.legendaNominal}>
                      {rupiah(sisaPagu)} · <strong>{(100 - persenSerap).toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Baris 4: Tabel Usulan Terbiayai (Linear / Stripe Table Craft) */}
          <div className={styles.seksiTabelCard}>
            <div className={styles.seksiTabelKepala}>
              <div>
                <h3 className={styles.subjudulSeksi}>
                  Daftar Usulan Terbiayai ({terpilih.length})
                </h3>
                <span className={styles.subjudulKeterangan}>
                  Paket prioritas hasil perhitungan algoritma seleksi aktif
                </span>
              </div>
            </div>

            <div className={styles.tabelWadah}>
              <table className={styles.tabelUsulan}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.thNomor}>#</th>
                    <th scope="col" className={styles.thUsulan}>Usulan & Wilayah</th>
                    <th scope="col" className={styles.thDukungan}>Dukungan Warga</th>
                    <th scope="col" className={styles.thUrgensi}>Urgensi</th>
                    <th scope="col" className={styles.thSkor}>Skor</th>
                    <th scope="col" className={styles.thBiaya}>Estimasi Biaya</th>
                    <th scope="col" className={styles.thStatus}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {terpilih.map((u, idx) => (
                    <tr key={u.id} className={styles.barisTabel}>
                      <td className={styles.tdNomor}>
                        <span className={styles.nomorBadge}>{idx + 1}</span>
                      </td>
                      <td className={styles.tdUsulan}>
                        <div className={styles.judulUsulan}>{u.title}</div>
                        <div className={styles.metaUsulan}>
                          <span className={styles.badgeRw}>
                            RW {String(u.rw).padStart(2, "0")}
                          </span>
                          <span className={styles.badgeKategori}>
                            {u.category}
                          </span>
                        </div>
                      </td>
                      <td className={styles.tdDukungan}>
                        <div className={styles.dukunganPill}>
                          <span className={styles.dukunganIcon} aria-hidden="true">👥</span>
                          <span className={styles.angkaDukungan}>{ribuan(u.voteCount)} suara</span>
                        </div>
                      </td>
                      <td className={styles.tdUrgensi}>
                        <div className={styles.urgensiContainer}>
                          <span className={styles.urgensiNilaiTeks}>
                            {u.urgencyScore}/10
                          </span>
                          <div className={styles.urgensiMiniTrack} aria-hidden="true">
                            <div
                              className={styles.urgensiMiniFill}
                              style={{ width: `${(u.urgencyScore / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={styles.tdSkor}>
                        {mode === "rekomendasi" ? (
                          <span className={styles.nilaiSkorBadge}>{u.skor.toFixed(2)}</span>
                        ) : (
                          <span className={styles.nilaiSkorBadge}>{ribuan(u.voteCount)}</span>
                        )}
                      </td>
                      <td className={styles.tdBiaya}>
                        <span className={styles.nilaiBiaya}>
                          {rupiahRinci(u.estimatedBudget)}
                        </span>
                      </td>
                      <td className={styles.tdStatus}>
                        <span className={styles.badgeTerbiayai}>
                          <IkonSuara nama="centang" ukuran={13} aria-hidden="true" />
                          <span>Terbiayai</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Baris 5: Disclosure Usulan Tidak Terpilih dengan Transparansi Alasan */}
          {tidakTerpilih.length > 0 && (
            <details className={styles.disclosureTidakTerpilih}>
              <summary className={styles.summaryTidakTerpilih}>
                <div className={styles.summaryInfo}>
                  <div className={styles.summaryHeaderBaris}>
                    <span className={styles.summaryBadgePeringatan}>Transparansi Algoritma</span>
                    <span className={styles.summaryJudul}>
                      Usulan yang Belum Terbiayai ({tidakTerpilih.length})
                    </span>
                  </div>
                  <span className={styles.summarySub}>
                    Lihat alasan akuntabel mengapa usulan berikut belum masuk paket alokasi pagu saat ini
                  </span>
                </div>
                <div className={styles.summaryPanahWadah} aria-hidden="true">
                  <span className={styles.summaryPanah}>▾</span>
                </div>
              </summary>

              <div className={styles.isiTidakTerpilih}>
                <div className={styles.tabelWadah}>
                  <table className={styles.tabelUsulan}>
                    <thead>
                      <tr>
                        <th scope="col" className={styles.thNomor}>#</th>
                        <th scope="col" className={styles.thUsulan}>Usulan & Wilayah</th>
                        <th scope="col" className={styles.thDukungan}>Dukungan</th>
                        <th scope="col" className={styles.thBiaya}>Estimasi Biaya</th>
                        <th scope="col" className={styles.thAlasan}>Alasan Belum Terpilih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tidakTerpilih.map((u, idx) => {
                        const butuhDanaLebih = u.estimatedBudget > sisaPagu;
                        return (
                          <tr key={u.id} className={styles.barisTabelMuted}>
                            <td className={styles.tdNomor}>
                              <span className={styles.nomorBadgeMuted}>{terpilih.length + idx + 1}</span>
                            </td>
                            <td className={styles.tdUsulan}>
                              <div className={styles.judulUsulanMuted}>{u.title}</div>
                              <div className={styles.metaUsulan}>
                                <span className={styles.badgeRwMuted}>
                                  RW {String(u.rw).padStart(2, "0")}
                                </span>
                                <span className={styles.badgeKategori}>{u.category}</span>
                              </div>
                            </td>
                            <td className={styles.tdDukungan}>
                              <span className={styles.angkaDukunganMuted}>
                                {ribuan(u.voteCount)} suara
                              </span>
                            </td>
                            <td className={styles.tdBiaya}>
                              <span className={styles.nilaiBiayaMuted}>
                                {rupiahRinci(u.estimatedBudget)}
                              </span>
                            </td>
                            <td className={styles.tdAlasan}>
                              {butuhDanaLebih ? (
                                <span className={styles.tagAlasanPagu}>
                                  ⚠ Melebihi sisa pagu (butuh {rupiah(u.estimatedBudget)}, sisa {rupiah(sisaPagu)})
                                </span>
                              ) : (
                                <span className={styles.tagAlasanSkor}>
                                  Peringkat skor ({u.skor.toFixed(2)}) di bawah ambang batas
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
