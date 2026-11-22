import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import { Paginasi } from "@/components/admin/Paginasi";
import { TabelAkun } from "@/components/admin/TabelAkun";
import styles from "@/components/admin/Admin.module.css";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaSemuaAkun } from "@/lib/admin-data";
import {
  LABEL_PERAN_FILTER,
  LABEL_STATUS_AKUN,
  PERAN_FILTER,
  STATUS_AKUN_FILTER,
  adaFilterAkunAktif,
  bacaFilterAkun,
  bangunQueryAkun,
  terapkanFilterAkun,
} from "@/lib/admin-filter";
import { ribuan } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · Akun" };

type Param = Record<string, string | string[] | undefined>;

export default function HalamanAkunAdmin({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <Suspense fallback={<Kerangka judul="akun" />}>
      <IsiAkun searchParams={searchParams} />
    </Suspense>
  );
}

async function IsiAkun({ searchParams }: { searchParams: Promise<Param> }) {
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;

  const filter = bacaFilterAkun(await searchParams);
  const semua = await bacaSemuaAkun(akses.pengguna);
  const hasil = terapkanFilterAkun(semua, filter);
  const href = (halaman: number) => `/admin/akun${bangunQueryAkun(filter, { halaman })}`;

  return (
    <>
      <header className={styles.kepala}>
        <div className={styles.kepalaAksi}>
          <h1>Akun</h1>
          <Link href="/admin/akun/baru" className="tombol tombol-utama">
            Buat akun warga
          </Link>
        </div>
        <p>
          Akun warga dibuat di sini, bukan lewat pendaftaran sendiri, supaya satu orang tidak bisa membuat banyak akun untuk
          menambah dukungan. Nama lengkap dan nomor warga hanya terlihat di halaman admin.
        </p>
      </header>

      <form action="/admin/akun" method="get" className={`${styles.filter} ${styles.filterAkun}`} aria-label="Saring akun">
        <div className={`${styles.kolom} ${styles.penuh}`}>
          <label htmlFor="f-q">Cari nama pengguna, nama warga, atau nomor warga</label>
          <input id="f-q" name="q" type="search" defaultValue={filter.q} autoComplete="off" maxLength={80} />
        </div>
        <div className={styles.kolom}>
          <label htmlFor="f-peran">Peran</label>
          <select id="f-peran" name="peran" defaultValue={filter.peran}>
            {PERAN_FILTER.map((p) => (
              <option key={p} value={p}>
                {LABEL_PERAN_FILTER[p]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.kolom}>
          <label htmlFor="f-status">Status</label>
          <select id="f-status" name="status" defaultValue={filter.status}>
            {STATUS_AKUN_FILTER.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUS_AKUN[s]}
              </option>
            ))}
          </select>
        </div>
        <div className={`${styles.kolom} ${styles.pilihanMode}`}>
          <label>
            <input type="checkbox" name="sandi" value="belum" defaultChecked={filter.belumGanti} />
            <span>Belum mengganti kata sandi</span>
          </label>
        </div>
        <div className={styles.filterTombol}>
          <button type="submit" className="tombol tombol-kedua">
            Terapkan
          </button>
          {adaFilterAkunAktif(filter) && (
            <Link href="/admin/akun" className={styles.hapus}>
              Hapus filter
            </Link>
          )}
        </div>
      </form>

      {hasil.total === 0 ? (
        <div className={styles.kosong}>
          <h2>Tidak ada akun yang cocok</h2>
          <p>Belum ada akun dengan pencarian dan pilihan yang Anda tentukan. Hapus filter untuk melihat semuanya.</p>
          <Link href="/admin/akun" className="tombol tombol-kedua">
            Hapus filter
          </Link>
        </div>
      ) : (
        <>
          <TabelAkun akun={hasil.tampil} keterangan={`Menampilkan ${ribuan(hasil.tampil.length)} dari ${ribuan(hasil.total)} akun`} />
          <Paginasi halaman={hasil.halaman} jumlahHalaman={hasil.jumlahHalaman} href={href} />
        </>
      )}
    </>
  );
}
