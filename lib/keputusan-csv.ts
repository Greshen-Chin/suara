// Unduhan data keputusan sebagai CSV. Murni, supaya bisa diuji (lib/keputusan-csv.test.ts).
//
//   - UTF-8 dengan BOM, supaya Excel membaca huruf Indonesia dengan benar.
//   - Pemisah baris CRLF, tanda kutip ganda di sel yang memuat koma, kutip, atau baris baru.
//   - Injeksi rumus: sel TEKS yang diawali = + - @ (juga tab dan carriage return) diberi awalan ' supaya
//     Excel dan Google Sheets tidak menjalankannya sebagai rumus. Alasan dan judul ditulis warga dan admin,
//     jadi isinya tidak boleh dipercaya. Sel angka tidak diubah.
import { LABEL_HASIL, TEKS_STATUS_REKOMENDASI, type Hasil } from "./keputusan.ts";
import type { StatusUsulan } from "./seleksi.ts";
import { teksSiklus } from "./teks-siklus.ts";

export const BOM = "﻿";

const AWAL_RUMUS = /^[\s]*[=+\-@]|^[\t\r]/;

/** Netralkan teks yang bisa dibaca spreadsheet sebagai rumus. */
export function netralkanSel(teks: string): string {
  return AWAL_RUMUS.test(teks) ? `'${teks}` : teks;
}

/** Satu sel: angka apa adanya, teks dinetralkan lalu dikutip bila perlu, kosong untuk null. */
export function sel(nilai: string | number | null | undefined): string {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "number") return Number.isFinite(nilai) ? String(nilai) : "";
  const aman = netralkanSel(nilai);
  return /[",\r\n]/.test(aman) ? `"${aman.replaceAll('"', '""')}"` : aman;
}

export interface BarisCsv {
  peringkat: number | null;
  judul: string | null;
  rw: number | null;
  biaya: number;
  hasil: Hasil;
  beda: boolean;
  statusRekomendasi: StatusUsulan | null;
  skor: number | null;
  dukungan: number;
  alasan: string | null;
  sumberDana: string | null;
  statusSekarang: string | null;
  selesaiPada: string | null;
  catatanSelesai: string | null;
  biayaRealisasi: number | null;
}

export const KEPALA_CSV = [
  "Tahun Anggaran",
  "Peringkat rekomendasi",
  "Usulan",
  "RW",
  "Biaya (Rp)",
  "Hasil musyawarah",
  "Berbeda dari rekomendasi",
  "Status rekomendasi",
  "Skor",
  "Dukungan",
  "Alasan",
  "Sumber dana",
  "Status sekarang",
  "Selesai pada",
  "Catatan selesai",
  "Biaya realisasi (Rp)",
] as const;

export function bangunCsv(tahun: number, baris: readonly BarisCsv[]): string {
  const urut = [...baris].sort(
    (a, b) => (a.peringkat ?? Number.MAX_SAFE_INTEGER) - (b.peringkat ?? Number.MAX_SAFE_INTEGER) || a.biaya - b.biaya,
  );
  const garis = [KEPALA_CSV.map((k) => sel(k)).join(",")];
  for (const b of urut) {
    garis.push(
      [
        sel(tahun),
        sel(b.peringkat),
        sel(b.judul ?? "(usulan disembunyikan)"),
        sel(b.rw),
        sel(b.biaya),
        sel(LABEL_HASIL[b.hasil]),
        sel(b.statusRekomendasi === null ? "" : b.beda ? "Ya" : "Tidak"),
        sel(b.statusRekomendasi === null ? "" : TEKS_STATUS_REKOMENDASI[b.statusRekomendasi]),
        sel(b.skor),
        sel(b.dukungan),
        sel(b.alasan),
        sel(b.sumberDana),
        sel(teksSiklus(b.statusSekarang)),
        sel(b.selesaiPada === null ? null : b.selesaiPada.slice(0, 10)),
        sel(b.catatanSelesai),
        sel(b.biayaRealisasi),
      ].join(","),
    );
  }
  return `${BOM}${garis.join("\r\n")}\r\n`;
}
