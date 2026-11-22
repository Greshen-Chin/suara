// Menyusun data Garis Pagu untuk satu mode (suara terbanyak atau rekomendasi SUARA):
// blok di batang, daftar yang tidak terbiayai, kalimat ringkasan, dan penjelasan "ditunda".
// Fungsi murni tanpa akses database, supaya teksnya bisa diuji.
import type { BarisRekomendasi, BarisWilayah } from "./data";
import { rupiah } from "./format.ts";
import { hitungTataPagu, type TataPagu } from "./pagu.ts";
import { statusUsulan, type StatusUsulan } from "./seleksi.ts";

export type KunciMode = "suara" | "rekomendasi";

export interface ItemPagu {
  id: string;
  /** Nama singkat untuk label blok. */
  nama: string;
  judul: string;
  rw: string;
  biaya: number;
  suara: number;
  /** Skala 1-10. */
  urgensi: number;
  status: StatusUsulan;
}

export interface PenjelasanDitunda {
  id: string;
  /** Teks pertanyaan pada tautan pembuka panel. */
  pertanyaan: string;
  paragraf: string[];
}

export interface ModePagu {
  kunci: KunciMode;
  ringkasan: string;
  terpilih: ItemPagu[];
  tata: TataPagu;
  tidakTerbiayai: ItemPagu[];
  ditunda: PenjelasanDitunda[];
}

/** Batas urgensi (skala 1-10) untuk menyebut sebuah usulan "mendesak". */
const URGENSI_MENDESAK = 7;

/** ["RW 01"] -> "RW 01"; ["RW 01","RW 07"] -> "RW 01 dan RW 07"; tiga -> "A, B dan C". */
function gabung(daftar: string[]): string {
  if (daftar.length <= 1) return daftar.join("");
  return `${daftar.slice(0, -1).join(", ")} dan ${daftar[daftar.length - 1]}`;
}

function namaRw(rw: number, wilayah: readonly BarisWilayah[]): string {
  return wilayah.find((w) => w.rw === rw)?.nama ?? `RW ${rw}`;
}

function ringkasanSuara(
  terpilih: ItemPagu[],
  wilayah: readonly BarisWilayah[],
  rwTerpilih: Set<number>,
): string {
  if (terpilih.length === 0) return "Belum ada proyek yang muat dalam pagu.";

  const namaRwTerpilih = [...rwTerpilih]
    .sort((a, b) => a - b)
    .map((rw) => namaRw(rw, wilayah));
  const sebaran =
    namaRwTerpilih.length === 1
      ? `semuanya di ${namaRwTerpilih[0]}`
      : `tersebar di ${gabung(namaRwTerpilih)}`;

  const tanpaBagian = wilayah
    .filter((w) => w.anggaran_lalu === 0 && !rwTerpilih.has(w.rw))
    .map((w) => w.nama);
  const akhir = tanpaBagian.length
    ? ` ${gabung(tanpaBagian)} belum pernah menerima anggaran dan kali ini tetap tidak kebagian.`
    : "";

  return `${terpilih.length} proyek, ${sebaran}.${akhir}`;
}

function ringkasanRekomendasi(
  terpilih: ItemPagu[],
  wilayah: readonly BarisWilayah[],
  rwTerpilih: Set<number>,
): string {
  if (terpilih.length === 0) return "Belum ada proyek yang muat dalam pagu.";

  const totalAnggaran = wilayah.reduce((n, w) => n + w.anggaran_lalu, 0);
  const totalPenduduk = wilayah.reduce((n, w) => n + w.penduduk, 0);
  const rataPerKapita = totalPenduduk === 0 ? 0 : totalAnggaran / totalPenduduk;
  const tertinggal = wilayah.filter(
    (w) => w.anggaran_lalu / w.penduduk < rataPerKapita && rwTerpilih.has(w.rw),
  );

  const mendesak = terpilih.every((t) => t.urgensi >= URGENSI_MENDESAK);
  const proyek = `${terpilih.length} proyek${mendesak ? " yang mendesak" : ""}`;
  return tertinggal.length
    ? `${proyek} untuk ${tertinggal.length} RW yang selama ini tertinggal, dari pagu yang sama.`
    : `${proyek}, dari pagu yang sama.`;
}

function penjelasanDitunda(
  item: ItemPagu,
  peringkat: number,
  jumlahUsulan: number,
  terpilih: ItemPagu[],
  pagu: number,
): PenjelasanDitunda {
  const nama = item.nama.toLowerCase();
  const totalTerpilih = terpilih.reduce((n, t) => n + t.biaya, 0);
  const posisi =
    peringkat === 1
      ? `punya nilai tertinggi dari ${jumlahUsulan} usulan`
      : `berada di peringkat ${peringkat} dari ${jumlahUsulan} usulan`;

  return {
    id: item.id,
    pertanyaan: `Kenapa ${nama} ditunda?`,
    paragraf: [
      `${item.nama} ${posisi}, tetapi biayanya ${rupiah(item.biaya)}.`,
      `Kalau ${nama} dibangun, pagu tinggal ${rupiah(pagu - item.biaya)}. ` +
        `${terpilih.length} usulan yang kini terpilih (${terpilih
          .map((t) => t.nama)
          .join(", ")}) totalnya ${rupiah(totalTerpilih)}, jadi tidak semuanya muat.`,
      `SUARA menyarankan ${nama} diajukan ke sumber dana lain, misalnya dana kebencanaan kabupaten. ` +
        `Keputusan akhir tetap di musyawarah desa.`,
    ],
  };
}

export function susunModePagu(
  kunci: KunciMode,
  hasil: readonly BarisRekomendasi[],
  wilayah: readonly BarisWilayah[],
  pagu: number,
): ModePagu {
  const diurut = [...hasil].sort((a, b) => a.peringkat - b.peringkat);
  const bertanda = statusUsulan(
    diurut.map((h) => ({ ...h, skor: h.skor })),
    kunci === "suara" ? "suara" : "skor",
  );

  const semua: (ItemPagu & { peringkat: number })[] = bertanda.map((h) => ({
    id: h.id,
    nama: h.nama_singkat,
    judul: h.title,
    rw: namaRw(h.rw, wilayah),
    biaya: h.estimated_budget,
    suara: h.vote_count,
    urgensi: h.urgency_score,
    status: h.status,
    peringkat: h.peringkat,
  }));

  const terpilih = semua.filter((i) => i.status === "terpilih");
  const rwTerpilih = new Set(
    bertanda.filter((h) => h.selected).map((h) => h.rw),
  );

  return {
    kunci,
    ringkasan:
      kunci === "suara"
        ? ringkasanSuara(terpilih, wilayah, rwTerpilih)
        : ringkasanRekomendasi(terpilih, wilayah, rwTerpilih),
    terpilih,
    tata: hitungTataPagu(
      terpilih.map((t) => ({ id: t.id, biaya: t.biaya })),
      pagu,
    ),
    tidakTerbiayai: semua.filter((i) => i.status !== "terpilih"),
    ditunda: semua
      .filter((i) => i.status === "ditunda")
      .map((i) => penjelasanDitunda(i, i.peringkat, semua.length, terpilih, pagu)),
  };
}
