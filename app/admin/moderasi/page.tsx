import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DialogTampilkan } from "@/components/admin/DialogTampilkan";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import { PesanKonfirmasi } from "@/components/admin/PesanKonfirmasi";
import styles from "@/components/admin/Admin.module.css";
import { DialogSembunyikan } from "@/components/forum/DialogSembunyikan";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaJejakModerasi, bacaSemuaKomentar, bacaSemuaUsulan, type JejakAdmin, type KomentarAdmin } from "@/lib/admin-data";
import { bacaBerhasil } from "@/lib/admin-pesan";
import { ribuan, rupiah } from "@/lib/format";
import { tanggalDanJam, waktuRelatif } from "@/lib/waktu";

export const metadata: Metadata = { title: "Admin · Moderasi" };

type Param = Record<string, string | string[] | undefined>;

const JUMLAH_TERBARU = 15;

export default function HalamanModerasi({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <Suspense fallback={<Kerangka judul="moderasi" />}>
      <IsiModerasi searchParams={searchParams} />
    </Suspense>
  );
}

const pad = (rw: number) => String(rw).padStart(2, "0");
const penulis = (k: KomentarAdmin) =>
  k.dari_admin ? "Admin desa" : `${k.penulis_nama_depan ?? "Warga"}${k.penulis_rw !== null ? `, RW ${pad(k.penulis_rw)}` : ""}`;

/** Siapa yang menyembunyikan, dari jejak tertutup. Konten yang disembunyikan sebelum jejak ini ada tidak punya catatan. */
function pencatat(jejak: readonly JejakAdmin[], id: string): string {
  const j = jejak.find((x) => x.aksi === "sembunyikan" && typeof x.detail === "object" && x.detail !== null && !Array.isArray(x.detail) && x.detail.id === id);
  return j ? j.pelaku_nama : "tidak tercatat (disembunyikan sebelum jejak admin ada)";
}

async function IsiModerasi({ searchParams }: { searchParams: Promise<Param> }) {
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;
  const admin = akses.pengguna;

  const berhasil = bacaBerhasil(await searchParams);
  const [komentar, usulan, jejak] = await Promise.all([
    bacaSemuaKomentar(admin),
    bacaSemuaUsulan(admin),
    bacaJejakModerasi(admin),
  ]);

  const sekarang = new Date();
  const terbaru = komentar.filter((k) => k.disembunyikan_pada === null).slice(0, JUMLAH_TERBARU);
  const komentarTersembunyi = komentar.filter((k) => k.disembunyikan_pada !== null);
  const usulanTersembunyi = usulan.filter((u) => u.disembunyikan_pada !== null);
  const totalTersembunyi = komentarTersembunyi.length + usulanTersembunyi.length;

  return (
    <>
      <header className={styles.kepala}>
        <h1>Moderasi</h1>
        <p>
          Sembunyikan yang tidak pantas, atau tampilkan kembali yang keliru disembunyikan. Setiap tindakan butuh alasan
          tertulis dan tercatat di jejak keputusan yang bisa dibaca semua warga.
        </p>
      </header>

      {berhasil && <PesanKonfirmasi berhasil={berhasil} nama={null} />}

      <section className={styles.seksi} aria-labelledby="judul-terbaru">
        <h2 id="judul-terbaru">Komentar terbaru</h2>
        {terbaru.length === 0 ? (
          <p className={styles.penjelas}>Belum ada komentar yang tampil.</p>
        ) : (
          <ol className={styles.komentarDaftar}>
            {terbaru.map((k) => (
              <li key={k.id} className={berhasil?.id === k.id ? styles.baruDiubah : undefined}>
                <p className={styles.baris}>
                  <strong>{penulis(k)}</strong>
                  <time dateTime={k.created_at} className={styles.sedikit}>
                    {waktuRelatif(k.created_at, sekarang)}
                  </time>
                  <span className={styles.sedikit}>
                    pada <Link href={`/admin/usulan/${k.proposal_id}`}>{k.proposal_judul}</Link>
                  </span>
                </p>
                <p className={styles.isiKonten}>{k.isi}</p>
                <DialogSembunyikan
                  jenis="komentar"
                  id={k.id}
                  idUsulan={k.proposal_id}
                  teksTombol="Sembunyikan"
                  tentang={`komentar dari ${penulis(k)}`}
                  daftarSetelah="/admin/moderasi"
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={styles.seksi} aria-labelledby="judul-tersembunyi">
        <h2 id="judul-tersembunyi">Konten tersembunyi ({ribuan(totalTersembunyi)})</h2>
        <p className={styles.penjelas}>
          Isinya hanya terlihat oleh admin di sini, supaya bisa dinilai ulang. Warga hanya melihat tanggal dan alasannya.
        </p>

        {totalTersembunyi === 0 ? (
          <p className={styles.penjelas}>Tidak ada konten yang disembunyikan.</p>
        ) : (
          <ol className={styles.register}>
            {usulanTersembunyi.map((u) => (
              <li key={u.id} className={`${styles.registerBaris} ${styles.registerSatu} ${berhasil?.id === u.id ? styles.baruDiubah : ""}`}>
                <div>
                  <p className={styles.baris}>
                    <span className={styles.capPutus}>Tidak terlihat publik</span>
                    <span className={styles.cap}>Usulan</span>
                  </p>
                  <p className={styles.judulBaris}>
                    <Link href={`/admin/usulan/${u.id}`}>{u.title}</Link>
                  </p>
                  <p className={styles.sedikit}>
                    {rupiah(u.estimated_budget)}
                    {u.rw !== null ? ` · RW ${pad(u.rw)}` : ""}
                  </p>
                  <p className={styles.deskripsi}>{u.description}</p>
                  <p className={styles.registerKet}>
                    Disembunyikan <time dateTime={u.disembunyikan_pada!}>{tanggalDanJam(u.disembunyikan_pada!)}</time> oleh{" "}
                    {pencatat(jejak, u.id)}. Alasan: {u.alasan_disembunyikan}
                  </p>
                  <DialogTampilkan jenis="usulan" id={u.id} idUsulan={u.id} voting={u.status === "voting"} tentang={u.title} />
                </div>
              </li>
            ))}
            {komentarTersembunyi.map((k) => (
              <li key={k.id} className={`${styles.registerBaris} ${styles.registerSatu} ${berhasil?.id === k.id ? styles.baruDiubah : ""}`}>
                <div>
                  <p className={styles.baris}>
                    <span className={styles.capPutus}>Tidak terlihat publik</span>
                    <span className={styles.cap}>Komentar</span>
                    <strong>{penulis(k)}</strong>
                    <span className={styles.sedikit}>
                      pada <Link href={`/admin/usulan/${k.proposal_id}`}>{k.proposal_judul}</Link>
                    </span>
                  </p>
                  <p className={styles.isiKonten}>{k.isi}</p>
                  <p className={styles.registerKet}>
                    Disembunyikan <time dateTime={k.disembunyikan_pada!}>{tanggalDanJam(k.disembunyikan_pada!)}</time> oleh{" "}
                    {pencatat(jejak, k.id)}. Alasan: {k.alasan_disembunyikan}
                  </p>
                  <DialogTampilkan jenis="komentar" id={k.id} idUsulan={k.proposal_id} tentang={`komentar dari ${penulis(k)}`} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
