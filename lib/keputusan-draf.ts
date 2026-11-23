// Draf lembar kerja keputusan yang disimpan di perangkat admin (localStorage). Rapat bisa lama dan sinyal bisa putus,
// jadi pilihan yang sudah diisi tidak boleh hilang. Murni dan tanpa "server-only": komponen klien yang memanggilnya.
//
// Kuncinya per tahun DAN sidik hitungan: draf melekat pada hitungan yang sedang dilihat. Bila hitungan berubah (sidik
// baru), draf tahun yang sama dengan sidik lama tetap dipulihkan untuk usulan yang masih ada, dengan pemberitahuan,
// supaya admin tidak mengulang dari awal karena ada yang menekan tombol di tempat lain.
//
// Semua akses penyimpanan dibungkus try/catch: jendela pribadi, data situs yang diblokir, atau penyimpanan penuh
// membuat localStorage melempar. Lembar kerja tetap berfungsi tanpa draf.
import { adalahHasil, type Isian, type Pilihan } from "./keputusan.ts";

export const AWALAN_DRAF = "suara:keputusan:";
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const BATAS_TEKS = 2_000;

export interface Draf {
  isian: Isian;
  /** Tanggal musyawarah (YYYY-MM-DD) atau "". */
  tanggal: string;
  catatan: string;
  /** Waktu simpan, milidetik sejak epoch. */
  disimpan: number;
}

export interface Penyimpanan {
  readonly length: number;
  key(indeks: number): string | null;
  getItem(kunci: string): string | null;
  setItem(kunci: string, nilai: string): void;
  removeItem(kunci: string): void;
}

export const kunciDraf = (tahun: number, sidik: string): string => `${AWALAN_DRAF}${tahun}:${sidik}`;

export function serialkanDraf(d: Draf): string {
  return JSON.stringify({ v: 1, isian: d.isian, tanggal: d.tanggal, catatan: d.catatan, disimpan: d.disimpan });
}

const adalahObjek = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const potong = (v: unknown): string => (typeof v === "string" ? v.slice(0, BATAS_TEKS) : "");

/**
 * Membaca draf dari teks yang tidak dipercaya. Hanya usulan yang masih ada (idSah) yang dipulihkan, dengan isian yang
 * sudah dibersihkan. null bila teksnya rusak atau tidak ada isian yang berarti.
 */
export function bacaDraf(teks: string | null, idSah: ReadonlySet<string>): Draf | null {
  if (!teks || teks.length > 200_000) return null;
  let j: unknown;
  try {
    j = JSON.parse(teks);
  } catch {
    return null;
  }
  if (!adalahObjek(j) || j.v !== 1 || !adalahObjek(j.isian)) return null;

  const isian: Isian = {};
  for (const [id, p] of Object.entries(j.isian)) {
    if (!idSah.has(id) || !adalahObjek(p)) continue;
    const pilihan: Pilihan = {
      hasil: adalahHasil(p.hasil) ? p.hasil : null,
      alasan: potong(p.alasan),
      sumberDana: potong(p.sumberDana),
    };
    if (pilihan.hasil !== null || pilihan.alasan !== "" || pilihan.sumberDana !== "") isian[id] = pilihan;
  }
  const tanggal = typeof j.tanggal === "string" && TANGGAL.test(j.tanggal) ? j.tanggal : "";
  const catatan = potong(j.catatan);
  if (Object.keys(isian).length === 0 && tanggal === "" && catatan === "") return null;
  return { isian, tanggal, catatan, disimpan: typeof j.disimpan === "number" && Number.isFinite(j.disimpan) ? j.disimpan : 0 };
}

export function simpanDraf(simpanan: Penyimpanan, tahun: number, sidik: string, draf: Draf): boolean {
  try {
    simpanan.setItem(kunciDraf(tahun, sidik), serialkanDraf(draf));
    return true;
  } catch {
    return false;
  }
}

export interface DrafDitemukan {
  draf: Draf;
  /** true bila kuncinya persis tahun dan sidik ini; false bila dari hitungan sebelumnya (sidik lain). */
  persis: boolean;
}

/** Draf untuk hitungan ini; bila tidak ada, draf terbaru tahun yang sama dari sidik lain. */
export function temukanDraf(simpanan: Penyimpanan, tahun: number, sidik: string, idSah: ReadonlySet<string>): DrafDitemukan | null {
  try {
    const persis = bacaDraf(simpanan.getItem(kunciDraf(tahun, sidik)), idSah);
    if (persis) return { draf: persis, persis: true };

    const awalan = `${AWALAN_DRAF}${tahun}:`;
    let terbaik: Draf | null = null;
    for (let i = 0; i < simpanan.length; i++) {
      const k = simpanan.key(i);
      if (!k || !k.startsWith(awalan)) continue;
      const d = bacaDraf(simpanan.getItem(k), idSah);
      if (d && (terbaik === null || d.disimpan > terbaik.disimpan)) terbaik = d;
    }
    return terbaik ? { draf: terbaik, persis: false } : null;
  } catch {
    return null;
  }
}

/** Hapus semua draf tahun ini (sidik apa pun). Dipanggil setelah penetapan berhasil atau tombol "Hapus draf". */
export function hapusDraf(simpanan: Penyimpanan, tahun: number): void {
  try {
    const awalan = `${AWALAN_DRAF}${tahun}:`;
    const kunci: string[] = [];
    for (let i = 0; i < simpanan.length; i++) {
      const k = simpanan.key(i);
      if (k && k.startsWith(awalan)) kunci.push(k);
    }
    for (const k of kunci) simpanan.removeItem(k);
  } catch {
    // Penyimpanan tidak tersedia: tidak ada yang perlu dihapus.
  }
}
