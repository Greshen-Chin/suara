import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatatanCadangan } from "@/components/forum/CatatanCadangan";
import { FilterForum } from "@/components/forum/FilterForum";
import { ForumHero } from "@/components/forum/ForumHero";
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
      <ForumHero urlUsul={URL_USUL} />

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
              <p className={styles.keterangan}>Coba ubah kata kunci atau hapus beberapa penyaring.</p>
              <p>
                <Link href="/forum" className="tombol tombol-kedua">
                  Tampilkan semua usulan
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2>Belum ada usulan</h2>
              <p className={styles.keterangan}>Jadilah warga pertama yang mengajukan kebutuhan pembangunan desa.</p>
              <p>
                <Link href={URL_USUL} className="tombol tombol-utama">
                  Ajukan usulan
                </Link>
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <p className={styles.jumlah} role="status">
            Menampilkan {tampil.length} dari {ribuan(total)} usulan
          </p>

          <ol className={styles.daftar}>
            {tampil.map((u) => (
              <li key={u.id}>
                <ItemUsulan
                  usulan={u}
                  sekarang={sekarang}
                  didukung={sudahDidukung.has(u.id)}
                  dataCadangan={data.dataCadangan}
                  query={query}
                  pengguna={untukTampilan}
                />
              </li>
            ))}
          </ol>

          {adaLagi && (
            <p className={styles.muatLebih}>
              <Link
                href={`/forum${bangunQuery(filter, { batas: filter.batas + BATAS_TAMBAH })}`}
                className="tombol tombol-kedua"
                scroll={false}
              >
                Muat lebih banyak
              </Link>
            </p>
          )}
        </>
      )}
    </>
  );
}
