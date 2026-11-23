import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CatatanCadanganKeputusan } from "@/components/keputusan/CatatanCadanganKeputusan";
import { JejakLengkap } from "@/components/keputusan/JejakLengkap";
import { KeputusanHero } from "@/components/keputusan/KeputusanHero";
import { PeriodeBerjalanCard } from "@/components/keputusan/PeriodeBerjalanCard";
import styles from "@/components/keputusan/Keputusan.module.css";
import { muatBeranda } from "@/lib/beranda";
import { muatDaftarKeputusan, muatJejak } from "@/lib/keputusan-data";
import { bacaFilterJejak } from "@/lib/keputusan-jejak";
import { namaPeriode, rincianHasil, ringkasTerpakai, tanggalMusyawarahTeks } from "@/lib/keputusan-kalimat";
import { RUTE } from "@/lib/tautan";

export const metadata: Metadata = {
  title: "Keputusan musyawarah",
  description:
    "Apa yang diputuskan musyawarah desa, berdampingan dengan rekomendasi SUARA, lengkap dengan alasan tertulis di tiap perbedaan.",
};

type Param = Record<string, string | string[] | undefined>;

export default function HalamanKeputusan({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <KeputusanHero />
      <Suspense
        fallback={
          <div role="status" aria-label="Memuat keputusan" className={styles.seksi}>
            <div style={{ height: "9rem", background: "var(--garis-halus)", borderRadius: "1rem" }} aria-hidden="true" />
            <div style={{ height: "12rem", background: "var(--garis-halus)", borderRadius: "1rem" }} aria-hidden="true" />
            <span className="sr-only">Memuat keputusan…</span>
          </div>
        }
      >
        <IsiKeputusan searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function IsiKeputusan({ searchParams }: { searchParams: Promise<Param> }) {
  const filter = bacaFilterJejak(await searchParams);
  const [daftar, beranda, jejak] = await Promise.all([muatDaftarKeputusan(), muatBeranda(), muatJejak(filter)]);

  const berjalan = daftar.periode.find((p) => p.status === "berjalan") ?? null;
  const diputuskan = daftar.periode.filter((p) => p.status === "diputuskan");
  const dataCadangan = daftar.dataCadangan || jejak.dataCadangan || beranda.dataContoh;
  const tahunBerjalan = berjalan?.tahun ?? 2027;
  const tampilkanBerjalan = Boolean(berjalan || beranda.usulan.length > 0);

  return (
    <>
      {dataCadangan && <CatatanCadanganKeputusan />}

      {tampilkanBerjalan && (
        <PeriodeBerjalanCard beranda={beranda} tahun={tahunBerjalan} />
      )}

      <section className={styles.seksi} aria-labelledby="judul-periode">
        <h2 id="judul-periode">Periode yang sudah diputuskan</h2>
        {diputuskan.length === 0 ? (
          <p className={styles.teks}>Belum ada periode yang diputuskan.</p>
        ) : (
          <ol className={styles.register}>
            {diputuskan.map((p) => {
              const tanggal = tanggalMusyawarahTeks(p.tanggalMusyawarah);
              return (
                <li key={p.tahun} className={styles.baris}>
                  <div className={styles.barisIsi}>
                    <h3>{namaPeriode(p.tahun)}</h3>
                    <p>{ringkasTerpakai(p)}.</p>
                    <p className={styles.meta}>
                      {rincianHasil(p.jumlah)}.{" "}
                      {p.adaRekomendasi
                        ? p.beda === 0
                          ? "Semuanya sejalan dengan rekomendasi."
                          : `${p.beda} berbeda dari rekomendasi.`
                        : "Diputuskan sebelum SUARA dipakai."}
                      {tanggal ? ` Musyawarah ${tanggal}.` : ""}
                    </p>
                    <Link href={`${RUTE.keputusan}/${p.tahun}`}>
                      Baca keputusan dan alasannya<span className="sr-only"> {namaPeriode(p.tahun)}</span> →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <JejakLengkap filter={filter} log={jejak.log} adaLagi={jejak.adaLagi} judul={jejak.judul} />
    </>
  );
}
