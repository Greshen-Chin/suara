"use client";

import { useState } from "react";
import styles from "./Admin.module.css";

interface Props {
  namaPengguna: string;
  kataSandi: string;
  /** Kalimat pembuka, mis. "Akun dibuat." atau "Kata sandi diatur ulang." */
  judul: string;
  /** Tombol penutup layar (mis. "Selesai"). */
  selesai?: { teks: string; aksi: () => void };
  /** Id untuk judul layar ini, bila layar dipakai di dalam dialog yang bernama lewat aria-labelledby. */
  idJudul?: string;
}

/**
 * Layar kata sandi yang tampil SEKALI. Kata sandi hanya ada di memori komponen ini: tidak masuk URL,
 * sessionStorage, atau cache, dan hilang saat komponen dilepas (dialog ditutup, halaman berganti).
 * Ditampilkan sebagai teks, bukan kolom isian, supaya pengelola kata sandi di browser tidak
 * menawarkan untuk menyimpannya.
 */
export function LayarSandi({ namaPengguna, kataSandi, judul, selesai, idJudul }: Props) {
  const [disalin, setDisalin] = useState<string | null>(null);

  async function salin(teks: string, pesan: string) {
    try {
      await navigator.clipboard.writeText(teks);
      setDisalin(pesan);
    } catch {
      setDisalin("Tidak bisa menyalin otomatis. Pilih tulisan di atas lalu salin dengan tangan.");
    }
  }

  return (
    <div className={styles.sandi}>
      <h2 id={idJudul} className={styles.judulSeksiKecil}>
        {judul} Catat kata sandi ini sekarang.
      </h2>

      <div className={styles.sandiKotak}>
        <dl>
          <div className={styles.sandiBaris}>
            <dt>Nama pengguna</dt>
            <dd className={styles.sandiNama}>{namaPengguna}</dd>
          </div>
          <div className={styles.sandiBaris}>
            <dt>Kata sandi</dt>
            <dd className={styles.sandiNilai}>{kataSandi}</dd>
          </div>
        </dl>
        <div className={styles.tombolBaris}>
          <button type="button" className="tombol tombol-kedua" onClick={() => salin(kataSandi, "Kata sandi disalin.")}>
            Salin kata sandi
          </button>
          <button
            type="button"
            className="tombol tombol-kedua"
            onClick={() => salin(`Nama pengguna: ${namaPengguna}\nKata sandi: ${kataSandi}`, "Nama pengguna dan kata sandi disalin.")}
          >
            Salin keduanya
          </button>
        </div>
        <p role="status" className={styles.petunjuk}>
          {disalin}
        </p>
      </div>

      <p className={styles.teks}>
        <strong>Serahkan langsung ke warga.</strong> Kata sandi ini tidak akan tampil lagi, dan tidak tersimpan di mana pun
        selain dalam bentuk yang tidak bisa dibaca. Warga diminta menggantinya saat pertama masuk.
      </p>

      {selesai && (
        <div className={styles.tombolBaris}>
          <button type="button" className="tombol tombol-utama" onClick={selesai.aksi}>
            {selesai.teks}
          </button>
        </div>
      )}
    </div>
  );
}
