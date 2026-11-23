import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BedaDariRekomendasi } from "@/components/keputusan/BedaDariRekomendasi";
import { CatatanCadanganKeputusan } from "@/components/keputusan/CatatanCadanganKeputusan";
import { DuaGaris } from "@/components/keputusan/DuaGaris";
import { KeputusanPeriodeHeader } from "@/components/keputusan/KeputusanPeriodeHeader";
import { TabelKeputusan } from "@/components/keputusan/TabelKeputusan";
import { TabelRwKeputusan } from "@/components/keputusan/TabelRwKeputusan";
import { TombolCetak } from "@/components/keputusan/TombolCetak";
import styles from "@/components/keputusan/Keputusan.module.css";
import { anggaranTiapRw, susunDuaBatang } from "@/lib/keputusan-banding";
import {
  namaPeriode,
  rincianHasil,
  ringkasTerpakai,
  tanggalMusyawarahTeks,
} from "@/lib/keputusan-kalimat";
import { muatPeriode } from "@/lib/keputusan-data";
import { bacaTahun } from "@/lib/keputusan-pesan";
import { RUTE } from "@/lib/tautan";
import { tanggalDanJam } from "@/lib/waktu";

interface Props {
  params: Promise<{ tahun: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tahun = bacaTahun((await params).tahun);
  if (tahun === null) return { title: "Keputusan tidak ditemukan" };
  const { periode } = await muatPeriode(tahun);
  if (!periode) return { title: "Keputusan tidak ditemukan" };

  const judul = `${namaPeriode(tahun)}: keputusan musyawarah`;
  if (periode.status !== "diputuskan") return { title: judul, description: `${namaPeriode(tahun)} belum diputuskan.` };
  const deskripsi = `${ringkasTerpakai(periode)}. ${rincianHasil(periode.jumlah)}. Ringkasan keputusan musyawarah, bukan pengesahan anggaran.`;
  return { title: judul, description: deskripsi, openGraph: { title: judul, description: deskripsi, type: "article", locale: "id_ID" } };
}

export default function HalamanKeputusanPeriode({ params }: Props) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <Link href={RUTE.keputusan} className={`${styles.kembali} tanpa-cetak`}>
        <span aria-hidden="true">←&nbsp;</span>Semua keputusan
      </Link>
      <Suspense
        fallback={
          <div role="status" aria-label="Memuat keputusan" className={styles.seksi}>
            <div style={{ height: "4rem", width: "55%", background: "var(--garis-halus)", borderRadius: "1rem" }} aria-hidden="true" />
            <div style={{ height: "10rem", background: "var(--garis-halus)", borderRadius: "1rem" }} aria-hidden="true" />
            <span className="sr-only">Memuat keputusan…</span>
          </div>
        }
      >
        <IsiPeriode params={params} />
      </Suspense>
    </main>
  );
}

async function IsiPeriode({ params }: Props) {
  const tahun = bacaTahun((await params).tahun);
  if (tahun === null) notFound();

  const data = await muatPeriode(tahun);
  const { periode } = data;
  if (periode === null) {
    if (data.dataCadangan) {
      return (
        <>
          <CatatanCadanganKeputusan />
          <h1 className={styles.seksi}>Keputusan ini belum bisa dimuat</h1>
          <p>Coba lagi beberapa menit lagi, atau kembali ke daftar keputusan.</p>
        </>
      );
    }
    notFound();
  }

  if (periode.status !== "diputuskan") {
    return (
      <>
        {data.dataCadangan && <CatatanCadanganKeputusan />}
        <header className={styles.kepala}>
          <div>
            <h1>{namaPeriode(tahun)}</h1>
            <p className={styles.sorot}>Belum diputuskan.</p>
            <p className={styles.keterangan}>
              Hasil musyawarah baru tampil di sini setelah admin desa mencatatnya. Bila sebelumnya sudah pernah ditetapkan lalu
              dibatalkan, alasan pembatalannya terbaca di{" "}
              <Link href={`${RUTE.keputusan}?jenis=decision#jejak`}>jejak keputusan</Link>.
            </p>
          </div>
        </header>
        <p>
          <Link href={RUTE.beranda}>Lihat rekomendasi saat ini di halaman utama</Link>
        </p>
      </>
    );
  }

  const batang = susunDuaBatang(periode, data.keputusan, data.wilayah);
  const rw = anggaranTiapRw(periode, data.keputusan, data.wilayah);
  const tanggal = tanggalMusyawarahTeks(periode.tanggalMusyawarah);

  return (
    <>
      {data.dataCadangan && <CatatanCadanganKeputusan />}

      <KeputusanPeriodeHeader periode={periode} />

      {batang && <DuaGaris batang={batang} />}

      {periode.adaRekomendasi && <BedaDariRekomendasi keputusan={data.keputusan} wilayah={data.wilayah} />}

      <TabelKeputusan tahun={tahun} keputusan={data.keputusan} wilayah={data.wilayah} adaRekomendasi={periode.adaRekomendasi} />

      <TabelRwKeputusan tahun={tahun} baris={rw} />

      <section className={styles.seksi} aria-labelledby="judul-catatan">
        <h2 id="judul-catatan">Catatan musyawarah</h2>
        <p className={styles.teks}>{periode.catatan}</p>
        <p className={styles.penjelas}>
          {tanggal ? `Musyawarah ${tanggal}. ` : ""}
          {periode.diputuskanOleh ? `Dicatat oleh ${periode.diputuskanOleh}` : "Dicatat sebelum SUARA dipakai"}
          {periode.diputuskanPada ? ` pada ${tanggalDanJam(periode.diputuskanPada)}.` : "."}
        </p>
      </section>

      <div className={`${styles.aksi} tanpa-cetak`} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <TombolCetak />
        <a className="tombol tombol-kedua" href={`${RUTE.keputusan}/${tahun}/csv`} download>
          Unduh data (CSV)
        </a>
      </div>
    </>
  );
}
