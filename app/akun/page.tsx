import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormGantiSandi } from "@/components/akun/FormGantiSandi";
import { wajibMasuk } from "@/lib/auth";
import { amankanTujuan } from "@/lib/tujuan";
import { keluar } from "../masuk/aksi";
import styles from "./akun.module.css";

export const metadata: Metadata = {
  title: "Akun & Keamanan",
  robots: { index: false },
};

const NAMA_PERAN = { warga: "Warga Desa Terverifikasi", admin: "Admin Desa" } as const;

type Param = Record<string, string | string[] | undefined>;

export default function HalamanAkun({
  searchParams,
}: {
  searchParams: Promise<Param>;
}) {
  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <Link href="/" className={styles.kembaliLink}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Kembali ke Beranda
      </Link>

      <div className={styles.kepala}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          Pengaturan Akun & Keamanan
        </div>
        <h1 className={styles.judul}>Akun Anda</h1>
        <p className={styles.keterangan}>
          Kelola profil akses Anda dan perbarui kata sandi untuk menjamin kerahasiaan suara aspirasi warga.
        </p>
      </div>

      <Suspense fallback={<p className={styles.keterangan}>Memuat data akun...</p>}>
        <InfoAkun searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InfoAkun({ searchParams }: { searchParams: Promise<Param> }) {
  const pengguna = await wajibMasuk();
  const params = await searchParams;
  const lanjutMentah = Array.isArray(params.lanjut) ? params.lanjut[0] : params.lanjut;
  const lanjut = lanjutMentah ? amankanTujuan(lanjutMentah, "") : "";
  const inisial = (pengguna.nama[0] ?? "W").toUpperCase();
  const isAdmin = pengguna.peran === "admin";

  return (
    <>
      <div className={styles.kartuProfil}>
        <div className={styles.profilKiri}>
          <div className={styles.avatar}>{inisial}</div>
          <div className={styles.infoTeks}>
            <div className={styles.namaPengguna}>{pengguna.nama}</div>
            <div className={styles.barisLabel}>
              <span className={`${styles.badgePeran} ${isAdmin ? styles.badgePeranAdmin : ""}`}>
                {isAdmin ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {NAMA_PERAN[pengguna.peran]}
              </span>
              <span className={styles.badgeStatus}>
                <span className={styles.dotHijau} />
                Sesi Aktif
              </span>
            </div>
          </div>
        </div>

        <form action={keluar}>
          <button type="submit" className={styles.tombolKeluar} title="Keluar dari akun Anda">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Keluar Akun
          </button>
        </form>
      </div>

      <section aria-labelledby="judul-ganti-sandi" className={styles.bagianForm}>
        <FormGantiSandi
          wajib={pengguna.harusGantiSandi}
          lanjut={lanjut && lanjut !== "/akun" ? lanjut : null}
        />
      </section>
    </>
  );
}
