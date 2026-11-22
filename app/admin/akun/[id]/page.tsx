import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DialogAturAktif, DialogAturUlangSandi } from "@/components/admin/DialogAkun";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import { PesanKonfirmasi } from "@/components/admin/PesanKonfirmasi";
import { NAMA_PERAN, StatusAkun, Tertaut } from "@/components/admin/TabelAkun";
import styles from "@/components/admin/Admin.module.css";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaAkun, bacaJejakAkun, type JejakAdmin } from "@/lib/admin-data";
import { bacaBerhasil } from "@/lib/admin-pesan";
import { adalahUuid } from "@/lib/usulan-skema";
import { tanggalDanJam, tanggalPanjang } from "@/lib/waktu";

export const metadata: Metadata = { title: "Admin · Akun" };

type Param = Record<string, string | string[] | undefined>;
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Param>;
}

export default function HalamanDetailAkun({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Kerangka judul="akun" />}>
      <IsiDetailAkun params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** Kalimat jejak admin yang bisa dibaca, tanpa memuat kata sandi atau hash (tidak pernah disimpan). */
function kalimatJejak(j: JejakAdmin): string {
  switch (j.aksi) {
    case "buat_akun":
      return `Akun dibuat oleh ${j.pelaku_nama}.`;
    case "atur_ulang_sandi":
      return `Kata sandi diatur ulang oleh ${j.pelaku_nama}. Pemiliknya diminta menggantinya.`;
    case "nonaktifkan":
      return `Dinonaktifkan oleh ${j.pelaku_nama}. Semua sesinya dicabut.`;
    case "aktifkan":
      return `Diaktifkan kembali oleh ${j.pelaku_nama}.`;
    case "ganti_sandi":
      return "Pemilik akun mengganti kata sandinya sendiri.";
    default:
      return `${j.aksi} oleh ${j.pelaku_nama}.`;
  }
}

async function IsiDetailAkun({ params, searchParams }: Props) {
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;
  const admin = akses.pengguna;

  const { id } = await params;
  if (!adalahUuid(id)) notFound();

  const akun = await bacaAkun(admin, id);
  if (!akun) notFound();

  const [jejak, berhasil] = [await bacaJejakAkun(admin, id), bacaBerhasil(await searchParams)];
  const diriSendiri = akun.id === admin.id;

  return (
    <>
      <Link href="/admin/akun" className={styles.kembali}>
        <span aria-hidden="true">←&nbsp;</span>Semua akun
      </Link>

      <header className={styles.kepala}>
        <h1>{akun.nama_pengguna}</h1>
        <p>
          {NAMA_PERAN[akun.peran] ?? akun.peran}, dibuat {tanggalPanjang(akun.created_at)}
          {akun.dibuat_oleh_nama ? ` oleh ${akun.dibuat_oleh_nama}` : ""}.
        </p>
      </header>

      {berhasil && berhasil.id === akun.id && <PesanKonfirmasi berhasil={berhasil} nama={akun.nama_pengguna} />}

      <div className={styles.tata}>
        <div className={styles.utama}>
          <section className={styles.seksi} aria-labelledby="judul-data">
            <h2 id="judul-data">Data akun</h2>
            <dl className={styles.ringkasData}>
              <dt>Status</dt>
              <dd>
                <StatusAkun a={akun} />
              </dd>
              <dt>Warga tertaut</dt>
              <dd>
                <Tertaut a={akun} />
              </dd>
            </dl>
          </section>

          <section className={styles.seksi} aria-labelledby="judul-jejak">
            <h2 id="judul-jejak">Jejak admin</h2>
            <p className={styles.penjelas}>Siapa membuat, mengatur ulang, dan menonaktifkan akun ini, dan kapan. Hanya terlihat oleh admin.</p>
            {jejak.length === 0 ? (
              <p className={styles.penjelas}>Belum ada catatan untuk akun ini. Akun yang dibuat lewat terminal tidak punya catatan pembuatan.</p>
            ) : (
              <ol className={styles.register}>
                {jejak.map((j) => (
                  <li key={j.id} className={`${styles.registerBaris} ${styles.registerTanggal}`}>
                    <time dateTime={j.created_at} className={styles.tanggalBaris}>
                      {tanggalDanJam(j.created_at)}
                    </time>
                    <p>{kalimatJejak(j)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className={styles.samping} aria-label="Tindakan untuk akun ini">
          <section className={styles.seksi} aria-labelledby="judul-aksi">
            <h2 id="judul-aksi">Tindakan</h2>
            {diriSendiri ? (
              <>
                <p className={styles.penjelas}>
                  Ini akun Anda. Akun sendiri tidak bisa dinonaktifkan dari sini, dan kata sandinya diganti di halaman{" "}
                  <Link href="/akun">Akun</Link>.
                </p>
              </>
            ) : (
              <div className={styles.tombolBaris}>
                <DialogAturUlangSandi id={akun.id} nama={akun.nama_pengguna} />
                <DialogAturAktif id={akun.id} nama={akun.nama_pengguna} aktif={akun.aktif} />
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
