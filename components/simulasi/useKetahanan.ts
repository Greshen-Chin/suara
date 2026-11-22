"use client";

// Uji ketahanan dan ajakan "Coba pagu ..." untuk layar simulasi.
//
// Keduanya berat bila usulannya banyak, jadi: (1) ditunda 150 ms setelah masukan terakhir berhenti berubah,
// (2) dihitung bertahap dengan jalankanBertahap sehingga tidak ada tugas utas utama yang panjang, (3) dibatalkan
// begitu masukan berubah lagi, dan (4) selama hitungan baru berjalan, hasil lama tetap tampil (diredam oleh
// pemakai). Uji ketahanan TIDAK bergantung pada bobot yang sedang digeser (ia menguji semua bobot), jadi
// menggeser bobot tidak memicu hitungan ulang; hanya pagu dan daftar usulan.
//
// Keadaan awal (resmi) dihitung di server dan diterima lewat props, supaya HTML pertama sudah memuat kalimatnya
// dan tidak ada yang melompat setelah hidrasi.
import { useEffect, useRef, useState } from "react";
import {
  bergantungPadaBobot,
  cariPaguBergantung,
  kunciKetahanan,
  ketahananBertahap,
  type AwalKetahanan,
  type HasilKetahanan,
} from "@/lib/ketahanan";
import type { Tangga } from "@/lib/peta-pagu";
import type { UsulanHitung } from "@/lib/pratinjau";
import type { Wilayah } from "@/lib/seleksi";
import { jalankanBertahap } from "./bagiGiliran";

export type { AwalKetahanan };

const TUNDA_MULAI_MS = 150;

interface Masukan {
  pagu: number;
  usulan: readonly UsulanHitung[];
  wilayah: readonly Wilayah[];
  /** Tangga untuk bobot yang sedang dipakai; sumber calon pagu bagi ajakan. */
  tangga: Tangga;
  kunciBobot: string;
  awal: AwalKetahanan;
  /** Batas pagu yang boleh ditawarkan. */
  rentang: { langkah: number; min: number; maks: number };
}

export interface KetahananLayar {
  hasil: HasilKetahanan;
  /** Hasil di atas berasal dari masukan sebelumnya; yang baru masih dihitung. */
  menghitung: boolean;
  ajakan: number | null;
}

export function useKetahanan(m: Masukan): KetahananLayar {
  const kunci = kunciKetahanan(m.pagu, m.usulan);
  const kunciAjakan = `${kunci}|${m.kunciBobot}`;

  const [selesai, setSelesai] = useState<{ kunci: string; hasil: HasilKetahanan }>({
    kunci: m.awal.kunci,
    hasil: m.awal.ketahanan,
  });
  const [ajakanSelesai, setAjakanSelesai] = useState<{ kunci: string; pagu: number | null }>({
    kunci: m.awal.kunciAjakan,
    pagu: m.awal.ajakan,
  });
  // Kunci yang sudah dihitung; dibaca di efek tanpa menjadikannya masukan efek.
  const sudah = useRef(m.awal.kunci);
  const sudahAjakan = useRef(m.awal.kunciAjakan);

  const { pagu, usulan, wilayah, tangga, rentang } = m;

  useEffect(() => {
    if (sudah.current === kunci) return;
    let batal: (() => void) | undefined;
    const mulai = setTimeout(() => {
      batal = jalankanBertahap(ketahananBertahap(usulan, wilayah, pagu), (hasil) => {
        sudah.current = kunci;
        setSelesai({ kunci, hasil });
      });
    }, TUNDA_MULAI_MS);
    return () => {
      clearTimeout(mulai);
      batal?.();
    };
  }, [kunci, pagu, usulan, wilayah]);

  const hasilSaatIni = selesai.kunci === kunci ? selesai.hasil : null;
  const perluAjakan = hasilSaatIni !== null && !bergantungPadaBobot(hasilSaatIni);

  useEffect(() => {
    if (!perluAjakan || sudahAjakan.current === kunciAjakan) return;
    let batal: (() => void) | undefined;
    const mulai = setTimeout(() => {
      batal = jalankanBertahap(cariPaguBergantung(usulan, wilayah, tangga, pagu, rentang), (hasil) => {
        sudahAjakan.current = kunciAjakan;
        setAjakanSelesai({ kunci: kunciAjakan, pagu: hasil });
      });
    }, TUNDA_MULAI_MS);
    return () => {
      clearTimeout(mulai);
      batal?.();
    };
  }, [perluAjakan, kunciAjakan, pagu, usulan, wilayah, tangga, rentang]);

  const hasil = hasilSaatIni ?? selesai.hasil;
  return {
    hasil,
    menghitung: hasilSaatIni === null,
    ajakan: perluAjakan && ajakanSelesai.kunci === kunciAjakan ? ajakanSelesai.pagu : null,
  };
}
