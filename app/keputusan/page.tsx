import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CatatanCadanganKeputusan } from "@/components/keputusan/CatatanCadanganKeputusan";
import { JejakLengkap } from "@/components/keputusan/JejakLengkap";
import styles from "@/components/keputusan/Keputusan.module.css";
import { muatBeranda } from "@/lib/beranda";
import { rupiah } from "@/lib/format";
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

// Kerangka halaman (judul, pengantar) diprerender statis. Hanya isi yang bergantung pada alamat (penyaring jejak) yang
// ditunda di balik Suspense.
export default function HalamanKeputusan({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <header className={styles.kepala}>
        <div>
          <h1>Keputusan musyawarah</h1>
          <p className={styles.keterangan} style={{ fontSize: "var(--t-md)" }}>
            SUARA merekomendasikan, musyawarah memutuskan, dan setiap perbedaan punya alasan yang bisa dibaca. Ini ringkasan
            keputusan musyawarah desa, bukan pengesahan anggaran.
          </p>
        </div>
      </header>
      <Suspense
        fallback={
          <div role="status" aria-label="Memuat keputusan" className={styles.seksi}>
            <div style={{ height: "9rem", background: "var(--garis-halus)" }} aria-hidden="true" />
            <div style={{ height: "12rem", background: "var(--garis-halus)" }} aria-hidden="true" />
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
  const terbiayai = beranda.modeRekomendasi.terpilih.length;
  const dataCadangan = daftar.dataCadangan || jejak.dataCadangan || beranda.dataContoh;

  return (
    <>
      {dataCadangan && <CatatanCadanganKeputusan />}

      {berjalan && (
        <section className={styles.berjalan} aria-labelledby="judul-berjalan">
          <h2 id="judul-berjalan">{namaPeriode(berjalan.tahun)} belum diputuskan</h2>
          <p className={styles.teks}>
            {beranda.usulan.length === 0
              ? "Belum ada usulan dalam hitungan anggaran, jadi belum ada yang bisa diputuskan."
              : `Rekomendasi saat ini: ${terbiayai} dari ${beranda.usulan.length} usulan terbiayai, sisa ${rupiah(beranda.modeRekomendasi.tata.sisa.rupiah)} dari pagu ${rupiah(beranda.pagu)}. Rekomendasi bisa berubah sampai musyawarah memutuskan.`}
          </p>
          <p className={styles.berjalanAksi}>
            <Link href={RUTE.beranda}>Lihat Garis Pagu di halaman utama</Link>
            <Link href={RUTE.simulasi}>Coba simulasi anggaran</Link>
          </p>
        </section>
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
                      Baca keputusan dan alasannya<span className="sr-only"> {namaPeriode(p.tahun)}</span>
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
