import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import { Paginasi } from "@/components/admin/Paginasi";
import { PesanKonfirmasi } from "@/components/admin/PesanKonfirmasi";
import { TabelUsulan } from "@/components/admin/TabelUsulan";
import styles from "@/components/admin/Admin.module.css";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaDasarHitung, bacaSemuaUsulan } from "@/lib/admin-data";
import {
  LABEL_STATUS_USULAN_ADMIN,
  LABEL_URUTAN_USULAN_ADMIN,
  STATUS_USULAN_ADMIN,
  URUTAN_USULAN_ADMIN,
  adaFilterUsulanAktif,
  bacaFilterUsulan,
  bangunQueryUsulan,
  terapkanFilterUsulan,
} from "@/lib/admin-filter";
import { bacaBerhasil } from "@/lib/admin-pesan";
import { ribuan } from "@/lib/format";
import { hitungRekomendasi, petaPosisi, type PosisiHitung } from "@/lib/pratinjau";
import { KATEGORI, LABEL_KATEGORI } from "@/lib/usulan-skema";

export const metadata: Metadata = { title: "Admin · Usulan" };

type Param = Record<string, string | string[] | undefined>;

export default function HalamanUsulanAdmin({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <Suspense fallback={<Kerangka judul="usulan" />}>
      <IsiUsulan searchParams={searchParams} />
    </Suspense>
  );
}

async function IsiUsulan({ searchParams }: { searchParams: Promise<Param> }) {
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;
  const admin = akses.pengguna;

  const params = await searchParams;
  const filter = bacaFilterUsulan(params);
  const berhasil = bacaBerhasil(params);

  const [semua, dasar] = await Promise.all([bacaSemuaUsulan(admin), bacaDasarHitung(admin)]);
  const hasil = terapkanFilterUsulan(semua, filter);

  // Posisi pada rekomendasi untuk usulan yang masuk hitungan; sama dengan Garis Pagu dan forum.
  let posisi: ReadonlyMap<string, PosisiHitung> = new Map();
  try {
    posisi = petaPosisi(hitungRekomendasi(dasar));
  } catch {
    // Lebih dari 16 usulan tidak bisa dihitung; daftar tetap tampil tanpa posisi.
  }

  const href = (halaman: number) => `/admin/usulan${bangunQueryUsulan(filter, { halaman })}`;
  const namaBerhasil = berhasil ? (semua.find((u) => u.id === berhasil.id)?.title ?? null) : null;
  const sekarang = new Date();

  return (
    <>
      <header className={styles.kepala}>
        <h1>Usulan</h1>
        <p>
          Tinjau usulan warga. Yang menunggu ditinjau berada paling atas, dan yang paling lama menunggu didahulukan.
        </p>
      </header>

      {berhasil && <PesanKonfirmasi berhasil={berhasil} nama={namaBerhasil} />}

      <form action="/admin/usulan" method="get" className={styles.filter} aria-label="Saring dan urutkan usulan">
        <div className={`${styles.kolom} ${styles.penuh}`}>
          <label htmlFor="f-q">Cari judul</label>
          <input id="f-q" name="q" type="search" defaultValue={filter.q} autoComplete="off" maxLength={80} />
        </div>
        <div className={`${styles.kolom} ${styles.penuh}`}>
          <label htmlFor="f-status">Status</label>
          <select id="f-status" name="status" defaultValue={filter.status}>
            {STATUS_USULAN_ADMIN.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUS_USULAN_ADMIN[s]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.kolom}>
          <label htmlFor="f-rw">RW</label>
          <select id="f-rw" name="rw" defaultValue={filter.rw ?? ""}>
            <option value="">Semua</option>
            {dasar.wilayah.map((w) => (
              <option key={w.rw} value={w.rw}>
                {w.nama}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.kolom}>
          <label htmlFor="f-kategori">Kategori</label>
          <select id="f-kategori" name="kategori" defaultValue={filter.kategori ?? ""}>
            <option value="">Semua</option>
            {KATEGORI.map((k) => (
              <option key={k} value={k}>
                {LABEL_KATEGORI[k]}
              </option>
            ))}
          </select>
        </div>
        <div className={`${styles.kolom} ${styles.penuh}`}>
          <label htmlFor="f-urut">Urutkan</label>
          <select id="f-urut" name="urut" defaultValue={filter.urut}>
            {URUTAN_USULAN_ADMIN.map((u) => (
              <option key={u} value={u}>
                {LABEL_URUTAN_USULAN_ADMIN[u]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterTombol}>
          <button type="submit" className="tombol tombol-kedua">
            Terapkan
          </button>
          {adaFilterUsulanAktif(filter) && (
            <Link href="/admin/usulan" className={styles.hapus}>
              Hapus filter
            </Link>
          )}
        </div>
      </form>

      {hasil.total === 0 ? (
        <div className={styles.kosong}>
          {semua.length === 0 ? (
            <>
              <h2>Belum ada usulan</h2>
              <p>Usulan warga akan muncul di sini begitu ada yang mengajukan.</p>
              <Link href="/admin" className="tombol tombol-kedua">
                Kembali ke ringkasan
              </Link>
            </>
          ) : (
            <>
              <h2>Tidak ada usulan yang cocok</h2>
              <p>Belum ada usulan dengan pencarian, status, RW, dan kategori yang Anda pilih. Hapus filter untuk melihat semuanya.</p>
              <Link href="/admin/usulan" className="tombol tombol-kedua">
                Hapus filter
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <TabelUsulan
            usulan={hasil.tampil}
            posisi={posisi}
            baru={berhasil?.id ?? null}
            sekarang={sekarang}
            keterangan={`Menampilkan ${ribuan(hasil.tampil.length)} dari ${ribuan(hasil.total)} usulan`}
          />
          <Paginasi halaman={hasil.halaman} jumlahHalaman={hasil.jumlahHalaman} href={href} />
        </>
      )}
    </>
  );
}
