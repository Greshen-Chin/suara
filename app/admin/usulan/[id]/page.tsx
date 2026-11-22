import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DialogKembalikan, DialogTidakDilanjutkan } from "@/components/admin/DialogStatus";
import { FormPindahStatus } from "@/components/admin/FormPindahStatus";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import styles from "@/components/admin/Admin.module.css";
import { RiwayatUsulan } from "@/components/forum/RiwayatUsulan";
import { StatusSiklus } from "@/components/ui/StatusSiklus";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaDasarHitung, bacaKomentarUsulan, bacaLogKeputusan, bacaUsulan } from "@/lib/admin-data";
import { BATAS_ADMIN } from "@/lib/admin-skema";
import { desimal, ribuan, rupiah } from "@/lib/format";
import { cariUsulanMirip } from "@/lib/forum-mirip";
import { transisiTersedia, keteranganTanpaAksi, teksStatusAdmin } from "@/lib/transisi-status";
import { LABEL_KATEGORI, adalahKategori, adalahUuid } from "@/lib/usulan-skema";
import { tanggalDanJam, tanggalPanjang, waktuRelatif } from "@/lib/waktu";
import { labelRw } from "@/lib/pratinjau";

export const metadata: Metadata = { title: "Admin · Tinjau usulan" };

interface Props {
  params: Promise<{ id: string }>;
}

export default function HalamanTinjau({ params }: Props) {
  return (
    <Suspense fallback={<Kerangka judul="usulan" />}>
      <IsiTinjau params={params} />
    </Suspense>
  );
}

async function IsiTinjau({ params }: Props) {
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;
  const admin = akses.pengguna;

  const { id } = await params;
  if (!adalahUuid(id)) notFound();

  const u = await bacaUsulan(admin, id);
  if (!u) notFound();

  const [komentar, riwayat, dasar] = await Promise.all([
    bacaKomentarUsulan(admin, id, 5),
    bacaLogKeputusan(admin, { idUsulan: id, terbaruDulu: false, batas: 100 }),
    bacaDasarHitung(admin),
  ]);

  const sekarang = new Date();
  const tersembunyi = u.disembunyikan_pada !== null;
  const tersedia = tersembunyi ? [] : transisiTersedia(u.status);
  const kategori = adalahKategori(u.category) ? LABEL_KATEGORI[u.category] : u.category;
  const penuh = dasar.usulan.length >= BATAS_ADMIN.usulanVoting;
  const rw = u.rw !== null ? labelRw(u.rw) : "Tanpa RW";

  return (
    <>
      <Link href="/admin/usulan" className={styles.kembali}>
        <span aria-hidden="true">←&nbsp;</span>Semua usulan
      </Link>

      <header className={styles.kepala}>
        <div className={styles.baris}>
          {tersembunyi ? (
            <span className={styles.capPutus}>Disembunyikan</span>
          ) : (
            <StatusSiklus status={u.status} teks={teksStatusAdmin(u.status, u.urgency_score)} />
          )}
          <span className={styles.sedikit}>
            {rw} · {kategori}
          </span>
        </div>
        <h1>{u.title}</h1>
        <p>
          <strong>{rupiah(u.estimated_budget)}</strong> ·{" "}
          {u.source === "musrenbang"
            ? "Dari musyawarah desa"
            : u.pengusul_nama_depan
              ? `Diusulkan ${u.pengusul_nama_depan}${u.pengusul_rw !== null ? `, RW ${String(u.pengusul_rw).padStart(2, "0")}` : ""}`
              : "Diusulkan warga"}{" "}
          · <time dateTime={u.created_at}>{tanggalPanjang(u.created_at)} ({waktuRelatif(u.created_at, sekarang)})</time>
        </p>
      </header>

      <div className={styles.tata}>
        <div className={styles.utama}>
          {tersembunyi && (
            <div className={styles.tersembunyi}>
              <span className={styles.capPutus}>Tidak terlihat publik</span>
              <p>
                Disembunyikan pada <time dateTime={u.disembunyikan_pada!}>{tanggalDanJam(u.disembunyikan_pada!)}</time>. Alasan: {u.alasan_disembunyikan}
              </p>
              <p>
                Isi di bawah hanya terlihat oleh admin supaya bisa dinilai ulang.{" "}
                <Link href="/admin/moderasi">Tampilkan kembali di Moderasi</Link>.
              </p>
            </div>
          )}

          <section className={styles.seksi} aria-labelledby="judul-isi">
            <h2 id="judul-isi">Isi usulan</h2>
            <p className={styles.deskripsi}>{u.description}</p>
          </section>

          <section className={styles.seksi} aria-labelledby="judul-data">
            <h2 id="judul-data">Dukungan dan urgensi</h2>
            <dl className={styles.ringkasData}>
              <dt>Dukungan</dt>
              <dd>
                {ribuan(u.vote_count)}
                {u.suara_per_1000 !== null && <> ({desimal(u.suara_per_1000)} per 1.000 penduduk {rw})</>}
              </dd>
              <dt>Komentar</dt>
              <dd>{ribuan(u.jumlah_komentar)}</dd>
              <dt>Urgensi</dt>
              <dd>
                {u.urgency_score !== null ? (
                  <>
                    {u.urgency_score} dari 10
                    {u.urgency_reason && <span className={styles.sedikit}>. {u.urgency_reason}</span>}
                  </>
                ) : (
                  "Belum dinilai. Nilai diisi saat usulan masuk hitungan anggaran."
                )}
              </dd>
            </dl>
          </section>

          {!tersembunyi && (u.status === "forum" || u.status === "voting") && (
            <section className={styles.seksi} aria-labelledby="judul-serupa">
              <h2 id="judul-serupa">Usulan serupa</h2>
              <p className={styles.penjelas}>
                Periksa dulu apakah usulan ini duplikat sebelum memasukkannya ke hitungan anggaran, supaya dukungan warga tidak terpecah.
              </p>
              <Suspense fallback={<p className={styles.penjelas}>Mencari usulan yang mirip…</p>}>
                <UsulanSerupa
                  id={u.id}
                  judul={u.title}
                  deskripsi={u.description ?? ""}
                  rw={u.rw ?? 0}
                  kategori={u.category}
                />
              </Suspense>
            </section>
          )}

        </div>

        <aside className={styles.samping} aria-label="Keputusan">
          <section className={styles.seksi} aria-labelledby="judul-keputusan">
            <h2 id="judul-keputusan">Keputusan</h2>

            {tersedia.length === 0 && <p className={styles.penjelas}>{keteranganTanpaAksi(u.status, tersembunyi)}</p>}

            {tersedia.includes("voting") &&
              (penuh ? (
                <div className={styles.pesanGalat}>
                  <p>
                    Hitungan anggaran sudah berisi {BATAS_ADMIN.usulanVoting} usulan, batas yang bisa dihitung SUARA
                    sekaligus. Kembalikan satu usulan ke pembahasan dulu, lalu masukkan usulan ini.
                  </p>
                  <Link href="/admin/usulan?status=voting">Lihat usulan dalam hitungan</Link>
                </div>
              ) : u.rw === null ? (
                <p className={styles.penjelas}>
                  Usulan ini belum punya RW, jadi belum bisa dihitung dalam anggaran.
                </p>
              ) : (
                <p className={styles.penjelas}>
                  <a href="#form-masuk">Masukkan ke hitungan anggaran</a>: isi urgensi dengan alasan, lihat dampaknya pada
                  Garis Pagu, lalu simpan.
                </p>
              ))}

            {(tersedia.includes("rejected") || tersedia.includes("forum")) && (
              <div className={styles.tombolBaris}>
                {tersedia.includes("rejected") && <DialogTidakDilanjutkan id={u.id} statusDibaca={u.status} judul={u.title} />}
                {tersedia.includes("forum") && <DialogKembalikan id={u.id} statusDibaca={u.status} judul={u.title} />}
              </div>
            )}
          </section>
        </aside>
      </div>

      {tersedia.includes("voting") && !penuh && u.rw !== null && (
        <section className={styles.seksi} aria-labelledby="form-masuk">
          <h2 id="form-masuk" tabIndex={-1}>
            Masukkan ke hitungan anggaran
          </h2>
          <FormPindahStatus id={u.id} statusDibaca={u.status} namaSingkatAwal={u.nama_singkat ?? ""} />
        </section>
      )}

      {/* Dibaca sesudah keputusan: yang menentukan keputusan (isi, dukungan, usulan serupa) ada di atas,
          dan formulirnya tidak terdorong ke dasar halaman oleh diskusi dan riwayat. */}
      <div className={styles.utama}>
        <section className={styles.seksi} aria-labelledby="judul-komentar">
          <h2 id="judul-komentar">Komentar terbaru</h2>
          {komentar.length === 0 ? (
            <p className={styles.penjelas}>Belum ada komentar.</p>
          ) : (
            <ol className={styles.komentarDaftar}>
              {komentar.map((k) => (
                <li key={k.id}>
                  <p className={styles.baris}>
                    <strong>
                      {k.dari_admin
                        ? "Admin desa"
                        : `${k.penulis_nama_depan ?? "Warga"}${k.penulis_rw !== null ? `, RW ${String(k.penulis_rw).padStart(2, "0")}` : ""}`}
                    </strong>
                    <time dateTime={k.created_at} className={styles.sedikit}>
                      {waktuRelatif(k.created_at, sekarang)}
                    </time>
                    {k.disembunyikan_pada !== null && <span className={styles.capPutus}>Tidak terlihat publik</span>}
                  </p>
                  <p className={styles.isiKonten}>{k.isi}</p>
                </li>
              ))}
            </ol>
          )}
          <Link href={`/forum/${u.id}#komentar`}>Lihat semua komentar di forum</Link>
        </section>

        <section className={styles.seksi} aria-labelledby="judul-riwayat">
          <h2 id="judul-riwayat">Riwayat</h2>
          <RiwayatUsulan usulan={u} log={riwayat} />
        </section>
      </div>
    </>
  );
}

async function UsulanSerupa({
  id,
  judul,
  deskripsi,
  rw,
  kategori,
}: {
  id: string;
  judul: string;
  deskripsi: string;
  rw: number;
  kategori: string;
}) {
  let hasil;
  try {
    hasil = await cariUsulanMirip({ judul, deskripsi, rw, kategori, kecuali: id });
  } catch (err) {
    console.error("Pencarian usulan serupa gagal:", err instanceof Error ? err.message : err);
    return <p className={styles.penjelas}>Pemeriksaan usulan serupa belum bisa dijalankan sekarang. Anda tetap bisa meninjau usulan ini.</p>;
  }
  if (hasil.usulan.length === 0) return <p className={styles.penjelas}>Tidak ada usulan lain yang mirip.</p>;
  return (
    <>
      {hasil.mode === "teks" && (
        <p className={styles.penjelas}>Pemeriksaan ini hanya mencocokkan kata, bukan AI, jadi hasilnya bisa kurang tepat.</p>
      )}
      <div className={styles.komentarDaftar}>
        {hasil.usulan.map((m) => (
          <div key={m.id} className={styles.mirip}>
            <span className={styles.judulBaris}>
              <Link href={`/admin/usulan/${m.id}`}>{m.judul}</Link>
            </span>
            <span className={styles.baris}>
              <StatusSiklus status={m.status} />
              <span className={styles.sedikit}>
                {m.rw !== null ? labelRw(m.rw) : "Tanpa RW"} · {ribuan(m.dukungan)} dukungan
              </span>
            </span>
            <p className={styles.sedikit}>{m.alasan}</p>
          </div>
        ))}
      </div>
    </>
  );
}
