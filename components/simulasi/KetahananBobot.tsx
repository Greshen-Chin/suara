"use client";

import type { CSSProperties } from "react";
import { rupiah } from "@/lib/format";
import { bergantungPadaBobot, kalimatKetahanan, type HasilKetahanan } from "@/lib/ketahanan";
import styles from "./Simulasi.module.css";

interface Props {
  hasil: HasilKetahanan;
  /** Hasil di atas dari masukan sebelumnya; yang baru sedang dihitung. */
  menghitung: boolean;
  /** Pagu terdekat yang hasilnya bergantung pada bobot (dihitung, bukan ditanam); null bila tidak ada. */
  ajakan: number | null;
  /** Usulan yang dihitung, urut menurut peringkat. Nama sudah berisi penanda "andaian" bila perlu. */
  usulan: readonly { id: string; nama: string }[];
  /** Kalimat tentang apa yang berubah karena bobot Anda; kosong bila bobot sama dengan resmi. */
  perubahanBobot: readonly string[];
  onCobaPagu: (pagu: number) => void;
}

export function KetahananBobot({ hasil, menghitung, ajakan, usulan, perubahanBobot, onCobaPagu }: Props) {
  const nama = new Map(usulan.map((u) => [u.id, u.nama]));
  const kalimat = kalimatKetahanan(hasil, (id) => nama.get(id) ?? id);
  const bergantung = bergantungPadaBobot(hasil);

  return (
    <div className={menghitung ? `${styles.ketahanan} ${styles.diredam}` : styles.ketahanan} aria-busy={menghitung}>
      <h3 className={styles.judulKecil}>Seberapa bergantung hasilnya pada bobot?</h3>
      {/* Bukan wilayah langsung: yang diumumkan ke pembaca layar hanya ringkasan hasil (HasilSimulasi), supaya satu
          jeda menghasilkan satu pengumuman. Kalimat ini tetap terbaca di tempatnya. */}
      <p className={styles.kalimatUtama}>{kalimat}</p>
      {menghitung && (
        <p className={styles.petunjuk} aria-hidden="true">
          Menghitung ulang untuk pagu ini…
        </p>
      )}

      {!bergantung && ajakan !== null && (
        <div className={styles.ajakan}>
          <p>Di {rupiah(ajakan)}, bobot menentukan.</p>
          <button type="button" className="tombol tombol-kedua" onClick={() => onCobaPagu(ajakan)}>
            Coba pagu {rupiah(ajakan)}
          </button>
        </div>
      )}

      <ul className={styles.rincianKetahanan} aria-label={`Berapa kombinasi bobot yang membiayai tiap usulan, dari ${hasil.total}`}>
        {usulan.map((u) => {
          const n = hasil.perUsulan[u.id] ?? 0;
          return (
            <li key={u.id} className={styles.barisKetahanan}>
              <span className={styles.namaKetahanan}>{u.nama}</span>
              <span className={styles.kadar} aria-hidden="true">
                <span className={styles.isiKadar} style={{ "--p": hasil.total === 0 ? 0 : n / hasil.total } as CSSProperties} />
              </span>
              <span className={styles.angkaKetahanan}>
                <span className="sr-only">terbiayai pada </span>
                {n} dari {hasil.total}
                <span className="sr-only"> kombinasi</span>
              </span>
            </li>
          );
        })}
      </ul>

      {perubahanBobot.length > 0 && (
        <div className={styles.dibandingResmi}>
          <h4 className={styles.judulKecil}>Dengan bobot Anda, pada pagu ini</h4>
          <ul>
            {perubahanBobot.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
