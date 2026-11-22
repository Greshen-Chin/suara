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
  ulangi: "Ulangi kata sandi baru",
};

const OTOMATIS: Record<NamaKolom, string> = {
  lama: "current-password",
  baru: "new-password",
  ulangi: "new-password",
};

/**
 * Formulir ganti kata sandi untuk semua peran. Aturan kata sandi baru tampil SEBELUM mengetik, bukan
 * hanya saat galat. Tombol tampilkan/sembunyikan per kolom; autocomplete current-password dan
 * new-password supaya pengelola kata sandi bekerja dengan benar. `lanjut` adalah tujuan semula
 * (dari ?lanjut=), ditawarkan setelah berhasil.
 */
export function FormGantiSandi({ wajib, lanjut }: { wajib: boolean; lanjut: string | null }) {
  const [status, aksi, menunggu] = useActionState(gantiKataSandi, STATUS_GANTI_SANDI_AWAL);
  const [lihat, setLihat] = useState<Record<NamaKolom, boolean>>({ lama: false, baru: false, ulangi: false });

  if (status.hasil === "berhasil") {
    return (
      <div role="status" className={styles.berhasil}>
        <strong>{status.pesan}</strong>
        <p>
          Sesi Anda di perangkat lain sudah keluar. Di perangkat ini Anda tetap masuk.
        </p>
        <Link href={lanjut ?? "/forum"} className="tombol tombol-utama">
          {lanjut ? "Lanjutkan" : "Ke forum warga"}
        </Link>
      </div>
    );
  }

  const daftarGalat = (["lama", "baru", "ulangi"] as const).flatMap((k) => (status.galat[k] ? [{ k, pesan: status.galat[k] }] : []));

  return (
    <form action={aksi} className={styles.form} noValidate>
      {wajib && (
        <p className={styles.wajib}>
          <strong>Ganti kata sandi Anda dulu.</strong> Kata sandi akun ini dibuat atau diatur ulang oleh admin desa, jadi
          hanya admin yang tahu. Setelah diganti, hanya Anda yang tahu.
        </p>
      )}

      {status.hasil === "galat" && (
        <div role="alert" className={styles.galat}>
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
      )}

      <div className={styles.aturan}>
        <p id="aturan-sandi">Kata sandi baru:</p>
        <ul aria-labelledby="aturan-sandi">
          {ATURAN_SANDI.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>

      {(["lama", "baru", "ulangi"] as const).map((k) => {
        const galat = status.galat[k] ?? null;
        return (
          <div key={k} className={styles.kolom}>
            <label htmlFor={`sandi-${k}`}>{LABEL[k]}</label>
            <div className={styles.sandi}>
              <input
                id={`sandi-${k}`}
                name={k}
                type={lihat[k] ? "text" : "password"}
                required
                maxLength={PANJANG_MAKS}
                autoComplete={OTOMATIS[k]}
                spellCheck={false}
                aria-invalid={galat ? true : undefined}
                aria-describedby={galat ? `sandi-${k}-galat` : undefined}
              />
              <button
                type="button"
                className="tombol tombol-kedua"
                aria-pressed={lihat[k]}
                aria-controls={`sandi-${k}`}
                onClick={() => setLihat((l) => ({ ...l, [k]: !l[k] }))}
              >
                {lihat[k] ? "Sembunyikan" : "Tampilkan"}
                <span className="sr-only"> {LABEL[k].toLowerCase()}</span>
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

      <button
        type="submit"
        className="tombol tombol-utama"
        aria-disabled={menunggu || undefined}
        onClick={(e) => {
          if (menunggu) e.preventDefault();
        }}
      >
        {menunggu ? "Menyimpan…" : "Ganti kata sandi"}
      </button>
    </form>
  );
}
