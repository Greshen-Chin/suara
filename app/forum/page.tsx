import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatatanCadangan } from "@/components/forum/CatatanCadangan";
import { FilterForum } from "@/components/forum/FilterForum";
import { ItemUsulan } from "@/components/forum/ItemUsulan";
import { SkeletonDaftar } from "@/components/forum/SkeletonDaftar";
import styles from "@/components/forum/Forum.module.css";
import { ambilPenggunaUntukBaca } from "@/lib/auth";
import { dukunganSaya, muatForum } from "@/lib/forum-data";
import {
  BATAS_TAMBAH,
  adaFilterAktif,
  bacaFilter,
  bangunQuery,
  terapkanFilter,
} from "@/lib/forum-filter";
import { ribuan } from "@/lib/format";

export const metadata: Metadata = {
  title: "Forum warga",
  description:
    "Baca usulan warga, dukung yang Anda setujui, dan lihat posisinya terhadap pagu anggaran desa.",
};

const URL_USUL = "/forum/usul";

type Param = Record<string, string | string[] | undefined>;

// Kerangka halaman (judul, tombol ajukan) diprerender statis. Hanya isi yang bergantung pada
// alamat (filter) dan sesi yang ditunda di balik Suspense.
export default function HalamanForum({ searchParams }: { searchParams: Promise<Param> }) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <div className={styles.kepala}>
        <div>
          <h1>Forum warga</h1>
          <p className={styles.pengantar}>
            Baca usulan warga, dukung yang Anda setujui, dan lihat posisinya terhadap pagu anggaran desa.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/peta" className="tombol tombol-kedua" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Lihat Peta
          </Link>
          <Link href={URL_USUL} className={`tombol tombol-utama ${styles.ajukan}`}>
            Ajukan usulan
          </Link>
        </div>
      </div>

      <Suspense fallback={<SkeletonDaftar />}>
        <IsiForum searchParams={searchParams} />
      </Suspense>

      <div className={styles.ajukanMengambang}>
        <Link href={URL_USUL} className="tombol tombol-utama">
          Ajukan usulan
        </Link>
      </div>
    </main>
  );
}

async function IsiForum({ searchParams }: { searchParams: Promise<Param> }) {
  // "x hari lalu" bergantung pada jam saat ini, jadi bagian ini memang dirender per permintaan.
  await connection();
  const filter = bacaFilter(await searchParams);
  const [data, pengguna] = await Promise.all([muatForum(), ambilPenggunaUntukBaca()]);
  const { tampil, total, adaLagi } = terapkanFilter(data.usulan, filter);
  const sudahDidukung = pengguna?.wargaId
    ? await dukunganSaya(pengguna.wargaId, tampil.map((u) => u.id))
    : new Set<string>();

  const sekarang = new Date();
  const query = bangunQuery(filter);
  const untukTampilan = pengguna ? { peran: pengguna.peran, punyaWarga: pengguna.wargaId !== null } : null;

  return (
    <>
      {data.dataCadangan && <CatatanCadangan />}
      <FilterForum filter={filter} wilayah={data.wilayah} />

      {total === 0 ? (
        <div className={styles.kosong}>
          {adaFilterAktif(filter) ? (
            <>
              <h2>Tidak ada usulan yang cocok</h2>
              <p>Belum ada usulan dengan status, RW, dan kategori yang Anda pilih. Hapus filter untuk melihat semuanya.</p>
              <Link href="/forum" className="tombol tombol-kedua">
                Hapus filter
              </Link>
            </>
          ) : (
            <>
              <h2>Belum ada usulan</h2>
              <p>Jadilah yang pertama menyampaikan aspirasi untuk desa Anda.</p>
              <Link href={URL_USUL} className="tombol tombol-utama">
                Ajukan usulan
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className={styles.ringkasan} role="status">
            Menampilkan {ribuan(tampil.length)} dari {ribuan(total)} usulan
          </p>
          <ol className={styles.daftar}>
            {tampil.map((u) => (
              <ItemUsulan
                key={u.id}
                usulan={u}
                pengguna={untukTampilan}
                didukung={sudahDidukung.has(u.id)}
                dataCadangan={data.dataCadangan}
                query={query}
                sekarang={sekarang}
              />
            ))}
          </ol>
          {adaLagi && (
            <div className={styles.lagi}>
              <Link
                href={`/forum${bangunQuery(filter, { batas: filter.batas + BATAS_TAMBAH })}`}
                scroll={false}
                className="tombol tombol-kedua"
              >
                Muat {Math.min(BATAS_TAMBAH, total - tampil.length)} usulan lagi
              </Link>
              <p>
                {ribuan(total - tampil.length)} usulan belum ditampilkan.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
