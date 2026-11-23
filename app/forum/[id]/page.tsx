import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatatanCadangan } from "@/components/forum/CatatanCadangan";
import { DaftarKomentar } from "@/components/forum/DaftarKomentar";
import { DialogSembunyikan } from "@/components/forum/DialogSembunyikan";
import { FormKomentar } from "@/components/forum/FormKomentar";
import { KeputusanUsulan } from "@/components/forum/KeputusanUsulan";
import { PosisiAnggaran } from "@/components/forum/PosisiAnggaran";
import { RiwayatUsulan } from "@/components/forum/RiwayatUsulan";
import { SaranAiPublik } from "@/components/forum/SaranAiPublik";
import { TombolDukung } from "@/components/forum/TombolDukung";
import { PetaMini } from "@/components/peta/PetaMini";
import { StatusSiklus } from "@/components/ui/StatusSiklus";
import styles from "@/components/forum/Detail.module.css";
import { tentukanKeadaanDukungan } from "@/lib/aturan-dukungan";
import { ambilPenggunaUntukBaca } from "@/lib/auth";
import { dukunganSaya, muatUsulan } from "@/lib/forum-data";
import { rupiah } from "@/lib/format";
import { muatKeputusanUsulan } from "@/lib/keputusan-data";
import { koordinatUntukUsulan } from "@/lib/peta-data";
import { RUTE } from "@/lib/tautan";
import { LABEL_KATEGORI, adalahKategori, adalahUuid } from "@/lib/usulan-skema";
import { tanggalPanjang, waktuRelatif } from "@/lib/waktu";

type Param = Record<string, string | string[] | undefined>;
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Param>;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  if (!adalahUuid(id)) return { title: "Usulan tidak ditemukan" };
  const { usulan } = await muatUsulan(id);
  if (!usulan) return { title: "Usulan tidak ditemukan" };
  if (usulan.disembunyikan_pada !== null) return { title: "Usulan disembunyikan" };

  const ringkas = (usulan.description ?? "").replace(/\s+/g, " ").slice(0, 160);
  return {
    title: usulan.title,
    description: `${rupiah(usulan.estimated_budget)}. ${ringkas}`,
    openGraph: { title: usulan.title ?? undefined, type: "article", locale: "id_ID" },
  };
}

export default function HalamanUsulan({ params, searchParams }: Props) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <Link href={RUTE.forum} className={styles.kembali}>
        <span aria-hidden="true">←&nbsp;</span>Semua usulan
      </Link>
      <Suspense
        fallback={
          <div className={styles.kerangkaDetail} role="status" aria-label="Memuat usulan">
            <div className={styles.blok} style={{ width: "36%" }} aria-hidden="true" />
            <div className={styles.blok} style={{ width: "80%", height: "2.75rem" }} aria-hidden="true" />
            <div className={styles.blok} style={{ width: "50%" }} aria-hidden="true" />
            <span className="sr-only">Memuat usulan…</span>
          </div>
        }
      >
        <IsiUsulan params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function IsiUsulan({ params, searchParams }: Props) {
  // Umur komentar ("3 jam lalu") bergantung pada jam saat ini: bagian ini dirender per permintaan.
  await connection();
  const { id } = await params;
  if (!adalahUuid(id)) notFound();

  const [data, pengguna, query, putusan] = await Promise.all([
    muatUsulan(id),
    ambilPenggunaUntukBaca(),
    searchParams,
    muatKeputusanUsulan(id),
  ]);

  const { usulan } = data;
  if (usulan === null) {
    // Bila yang tidak terjangkau adalah databasenya, "tidak ditemukan" akan menyesatkan.
    if (data.dataCadangan) {
      return (
        <>
          <CatatanCadangan />
          <h1 className={styles.judul}>Usulan ini belum bisa dimuat</h1>
          <p>Coba lagi beberapa menit lagi, atau kembali ke daftar usulan.</p>
        </>
      );
    }
    notFound();
  }

  const sekarang = new Date();
  const tersembunyi = usulan.disembunyikan_pada !== null;
  const admin = pengguna?.peran === "admin";
  const untukTampilan = pengguna ? { peran: pengguna.peran, punyaWarga: pengguna.wargaId !== null } : null;
  const keadaan = tentukanKeadaanDukungan({ pengguna: untukTampilan, status: usulan.status, dataCadangan: data.dataCadangan });
  const didukung =
    pengguna?.wargaId && !tersembunyi ? (await dukunganSaya(pengguna.wargaId, [id])).has(id) : false;

  const alamat = `/forum/${id}`;
  const baru = query.baru === "1";
  const gabung = query.gabung === "1";
  const kategori = adalahKategori(usulan.category) ? LABEL_KATEGORI[usulan.category] : usulan.category;
  const komentarTerlihat = data.komentar.filter((k) => k.disembunyikan_pada === null).length;

  return (
    <>
      {data.dataCadangan && <CatatanCadangan />}

      {(baru || gabung) && !tersembunyi && (
        <div role="status" className={styles.konfirmasi}>
          <strong>{gabung ? "Dukungan Anda sudah digabungkan" : "Usulan Anda sudah terkirim"}</strong>
          <p>
            {gabung
              ? "Suara warga tidak terpecah: dukungan Anda masuk ke usulan yang sudah ada, dan usulan baru tidak dikirim."
              : "Usulan tampil di forum dengan status “Sedang dibahas”, dan dukungan pertama sudah dari Anda. Admin desa menilai urgensinya sebelum usulan masuk hitungan anggaran."}
          </p>
        </div>
      )}

      <header className={styles.kepala}>
        <div className={styles.baris}>
          <StatusSiklus status={usulan.status} />
          <span className={styles.lokasi}>
            {usulan.rw !== null ? `RW ${String(usulan.rw).padStart(2, "0")}` : "Tanpa RW"} · {kategori}
          </span>
        </div>
        <h1 className={styles.judul}>{tersembunyi ? "Usulan disembunyikan" : usulan.title}</h1>
        <p className={styles.meta}>
          <span className={styles.biaya}>{rupiah(usulan.estimated_budget)}</span>
          <span>
            {usulan.source === "musrenbang"
              ? "Dari musyawarah desa"
              : usulan.pengusul_nama_depan
                ? `Diusulkan ${usulan.pengusul_nama_depan}${usulan.pengusul_rw !== null ? `, RW ${String(usulan.pengusul_rw).padStart(2, "0")}` : ""}`
                : "Diusulkan warga"}
          </span>
          <time dateTime={usulan.created_at}>
            {tanggalPanjang(usulan.created_at)} · {waktuRelatif(usulan.created_at, sekarang)}
          </time>
        </p>
      </header>

      <div className={styles.tata}>
        <aside className={styles.samping} aria-label="Dukungan dan posisi anggaran">
          {!tersembunyi && (
            <>
              <TombolDukung
                idUsulan={id}
                judul={usulan.title ?? ""}
                jumlah={usulan.vote_count}
                didukung={didukung}
                per1000={usulan.suara_per_1000}
                keadaan={keadaan}
                lanjut={alamat}
              />

              {data.posisi && (
                <div className={styles.sisi}>
                  <h2>Posisi di anggaran</h2>
                  <PosisiAnggaran posisi={data.posisi} />
                  <p>
                    Peringkat ini sama dengan Garis Pagu di{" "}
                    <Link href={RUTE.beranda}>halaman utama</Link>.
                  </p>
                </div>
              )}

              {/* Usulan yang masih dibahas belum ikut hitungan anggaran. Simulasi menghitungnya hanya di peramban. */}
              {usulan.status === "forum" && (
                <Link href={`${RUTE.simulasi}?tambah=${id}.5`} className={styles.tautanSimulasi}>
                  Lihat kalau usulan ini dihitung
                </Link>
              )}

              <div className={styles.sisi}>
                <h2>Lokasi Usulan</h2>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--tinta-lemah)" }}>
                  {usulan.rw !== null ? `Kawasan Dusun RW 0${usulan.rw}` : "Wilayah Desa"}
                </p>
                <PetaMini
                  lat={koordinatUntukUsulan(id, usulan.rw).lat}
                  lng={koordinatUntukUsulan(id, usulan.rw).lng}
                  judul={usulan.title ?? ""}
                  rw={usulan.rw}
                />
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem" }}>
                  <Link href="/peta" style={{ fontWeight: 600 }}>
                    Buka di Peta Persebaran Desa &rarr;
                  </Link>
                </p>
              </div>
            </>
          )}

          {admin && !tersembunyi && !data.dataCadangan && (
            <DialogSembunyikan
              jenis="usulan"
              id={id}
              idUsulan={id}
              teksTombol="Sembunyikan usulan"
              tentang={usulan.title ?? ""}
              fokusSetelah="hasil-moderasi"
            />
          )}
        </aside>
        <div className={styles.utama}>
          {tersembunyi ? (
            <section className={styles.bagian} aria-labelledby="judul-moderasi">
              <h2 id="judul-moderasi" className="sr-only">
                Penyembunyian oleh admin
              </h2>
              <div id="hasil-moderasi" tabIndex={-1} data-tersembunyi="true" className={styles.disembunyikan}>
                <p>
                  <strong>Disembunyikan oleh admin desa</strong> pada{" "}
                  <time dateTime={usulan.disembunyikan_pada!}>{tanggalPanjang(usulan.disembunyikan_pada!)}</time>.
                </p>
                <p>Alasan: {usulan.alasan_disembunyikan}</p>
                <p>Isi usulan dan diskusinya tidak ditampilkan lagi. Jejaknya tetap tercatat di riwayat.</p>
              </div>
            </section>
          ) : (
            <section className={styles.bagian} aria-labelledby="judul-isi">
              <h2 id="judul-isi">Isi usulan</h2>
              <p className={styles.deskripsi}>{usulan.description}</p>
            </section>
          )}

          {!tersembunyi && putusan.keputusan && <KeputusanUsulan keputusan={putusan.keputusan} />}

          {!tersembunyi && (
            <section className={styles.bagian} aria-labelledby="judul-urgensi">
              <h2 id="judul-urgensi">Urgensi</h2>
              {usulan.urgency_score !== null ? (
                <div className={styles.urgensi}>
                  <p className={styles.nilaiUrgensi}>Nilai {usulan.urgency_score} dari 10</p>
                  {usulan.urgency_reason && <p>{usulan.urgency_reason}</p>}
                  {usulan.saran && <SaranAiPublik urgensi={usulan.urgency_score} saran={usulan.saran} />}
                </div>
              ) : (
                <p className={styles.catatanUrgensi}>
                  Urgensi belum dinilai. Penilaian dibuat saat usulan masuk hitungan anggaran, lengkap dengan alasan tertulis.
                </p>
              )}
            </section>
          )}

          <section className={styles.bagian} aria-labelledby="judul-riwayat">
            <h2 id="judul-riwayat">Riwayat</h2>
            <RiwayatUsulan usulan={usulan} log={data.riwayat} />
          </section>

          {!tersembunyi && (
            <section className={styles.bagian} aria-labelledby="komentar">
              <h2 id="komentar">Komentar ({komentarTerlihat})</h2>
              <DaftarKomentar komentar={data.komentar} idUsulan={id} bisaModerasi={admin && !data.dataCadangan} sekarang={sekarang} />
              {data.dataCadangan ? (
                <p className={styles.kosongKomentar}>Komentar dimatikan sementara karena data tidak bisa dimuat.</p>
              ) : pengguna ? (
                <FormKomentar idUsulan={id} lanjut={alamat} />
              ) : (
                <div className={styles.ajakMasuk}>
                  <p>Masuk dulu untuk ikut berkomentar. Semua orang tetap bisa membaca diskusi ini.</p>
                  <Link href={`${RUTE.masuk}?lanjut=${encodeURIComponent(`${alamat}#komentar`)}`} className="tombol tombol-kedua">
                    Masuk untuk berkomentar
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>

      </div>
    </>
  );
}
