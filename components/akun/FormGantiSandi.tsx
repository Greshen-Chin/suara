"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { gantiKataSandi } from "@/app/akun/aksi";
import { STATUS_GANTI_SANDI_AWAL } from "@/lib/akun-status";
import { ATURAN_SANDI, PANJANG_MAKS } from "@/lib/aturan-sandi";
import styles from "./FormGantiSandi.module.css";

type NamaKolom = "lama" | "baru" | "ulangi";

const LABEL: Record<NamaKolom, string> = {
  lama: "Kata sandi sekarang",
  baru: "Kata sandi baru",
  ulangi: "Konfirmasi kata sandi baru",
};

const PLACEHOLDER: Record<NamaKolom, string> = {
  lama: "Masukkan kata sandi saat ini",
  baru: "Minimal 8 karakter baru",
  ulangi: "Ulangi kata sandi baru",
};

const OTOMATIS: Record<NamaKolom, string> = {
  lama: "current-password",
  baru: "new-password",
  ulangi: "new-password",
};

/**
 * Formulir ganti kata sandi untuk semua peran warga dan perangkat desa.
 * Didesain dengan estetika modern, petunjuk keamanan interaktif, dan kontrol keterlihatan inline.
 */
export function FormGantiSandi({
  wajib,
  lanjut,
}: {
  wajib: boolean;
  lanjut: string | null;
}) {
  const [status, aksi, menunggu] = useActionState(
    gantiKataSandi,
    STATUS_GANTI_SANDI_AWAL
  );
  const [lihat, setLihat] = useState<Record<NamaKolom, boolean>>({
    lama: false,
    baru: false,
    ulangi: false,
  });

  // Tampilan Berhasil
  if (status.hasil === "berhasil") {
    return (
      <div role="status" className={styles.berhasilCard}>
        <div className={styles.ikonBerhasil}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className={styles.berhasilKonten}>
          <h2 className={styles.berhasilJudul}>{status.pesan}</h2>
          <p className={styles.berhasilKeterangan}>
            Sesi Anda di perangkat lain telah otomatis dinonaktifkan demi privasi.
            Di perangkat ini Anda tetap masuk.
          </p>
        </div>
        <div className={styles.berhasilAksi}>
          <Link
            href={lanjut ?? "/forum"}
            className={styles.tombolLanjut}
          >
            {lanjut ? "Lanjutkan ke Tujuan" : "Ke Forum Usulan Warga"}
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
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link href="/" className={styles.tombolBeranda}>
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const daftarGalat = (["lama", "baru", "ulangi"] as const).flatMap((k) =>
    status.galat[k] ? [{ k, pesan: status.galat[k] }] : []
  );

  return (
    <div className={styles.wadahForm}>
      {/* Header Kartu Keamanan */}
      <div className={styles.kartuKepala}>
        <div className={styles.ikonPerisai}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className={styles.kepalaTeks}>
          <h2 className={styles.judulForm}>Perbarui Kata Sandi</h2>
          <p className={styles.deskripsiForm}>
            Gunakan kombinasi yang aman untuk melindungi hak suara dan aspirasi Anda.
          </p>
        </div>
      </div>

      <form action={aksi} className={styles.form} noValidate>
        {/* Peringatan jika akun wajib ganti kata sandi bawaan admin */}
        {wajib && (
          <div className={styles.wajibNotice}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Kata Sandi Bawaan Terdeteksi</strong>
              Akun Anda masih menggunakan kata sandi awal yang diatur oleh admin desa. Demi keamanan penuh dan kerahasiaan pilihan Anda, silakan ganti sekarang.
            </div>
          </div>
        )}

        {/* Notifikasi Galat Global */}
        {status.hasil === "galat" && (
          <div role="alert" className={styles.galatNotice}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className={styles.galatKonten}>
              <p>{status.pesan}</p>
              {daftarGalat.length > 0 && (
                <ul>
                  {daftarGalat.map((g) => (
                    <li key={g.k}>
                      <a href={`#sandi-${g.k}`}>{g.pesan}</a>
                    </li>
                  ))}
                </ul>
              )}
              {status.perluMasuk && (
                <p>
                  <Link href="/masuk?lanjut=%2Fakun">Masuk lagi</Link>. Isian Anda tetap di layar.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Kotak Petunjuk Ketentuan Kata Sandi */}
        <div className={styles.aturanBox}>
          <div className={styles.aturanJudul} id="aturan-sandi">
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Ketentuan kata sandi baru:
          </div>
          <ul aria-labelledby="aturan-sandi">
            {ATURAN_SANDI.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>

        {/* Daftar Input Password */}
        {(["lama", "baru", "ulangi"] as const).map((k) => {
          const galat = status.galat[k] ?? null;
          const isAktif = lihat[k];

          return (
            <div key={k} className={styles.kolom}>
              <label htmlFor={`sandi-${k}`}>{LABEL[k]}</label>
              <div className={styles.inputWrapper}>
                <input
                  id={`sandi-${k}`}
                  name={k}
                  type={isAktif ? "text" : "password"}
                  placeholder={PLACEHOLDER[k]}
                  required
                  maxLength={PANJANG_MAKS}
                  autoComplete={OTOMATIS[k]}
                  spellCheck={false}
                  aria-invalid={galat ? true : undefined}
                  aria-describedby={galat ? `sandi-${k}-galat` : undefined}
                  className={styles.inputSandi}
                />
                <button
                  type="button"
                  className={styles.tombolMata}
                  aria-pressed={isAktif}
                  aria-controls={`sandi-${k}`}
                  aria-label={isAktif ? `Sembunyikan ${LABEL[k]}` : `Tampilkan ${LABEL[k]}`}
                  onClick={() => setLihat((l) => ({ ...l, [k]: !l[k] }))}
                >
                  {isAktif ? (
                    /* Ikon Mata Tertutup (Eye Off) */
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Ikon Mata Terbuka (Eye) */
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {galat && (
                <p id={`sandi-${k}-galat`} className={styles.galatKolom}>
                  {galat}
                </p>
              )}
            </div>
          );
        })}

        {/* Tombol Simpan */}
        <button
          type="submit"
          className={styles.tombolSimpan}
          aria-disabled={menunggu || undefined}
          onClick={(e) => {
            if (menunggu) e.preventDefault();
          }}
        >
          {menunggu ? (
            <>
              <svg
                className={styles.spinner}
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
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
              <span>Menyimpan Kata Sandi…</span>
            </>
          ) : (
            <>
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
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>Simpan Kata Sandi Baru</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
