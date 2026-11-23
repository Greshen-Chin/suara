// Filter, urutan, dan "muat lebih banyak" untuk daftar forum. Semua keadaan hidup di URL
// (searchParams), jadi bisa dibagikan dan tombol kembali bekerja. Murni: dipakai server
// untuk data dari database maupun dari data cadangan.
import { adalahKategori, type Kategori } from "./usulan-skema.ts";

export const STATUS_FILTER = ["semua", "forum", "voting", "diputuskan"] as const;
export type StatusFilter = (typeof STATUS_FILTER)[number];

export const URUTAN = ["terbaru", "dukungan", "per-seribu"] as const;
export type Urutan = (typeof URUTAN)[number];

export const LABEL_STATUS_FILTER: Record<StatusFilter, string> = {
  semua: "Semua",
  forum: "Sedang dibahas",
  voting: "Masuk hitungan anggaran",
  diputuskan: "Sudah diputuskan",
};

export const LABEL_URUTAN: Record<Urutan, string> = {
  terbaru: "Terbaru",
  dukungan: "Dukungan terbanyak",
  "per-seribu": "Dukungan per 1.000 penduduk",
};

export const BATAS_AWAL = 20;
export const BATAS_TAMBAH = 20;
export const BATAS_MAKS = 200;

export interface FilterForum {
  status: StatusFilter;
  rw: number | null;
  kategori: Kategori | null;
  urut: Urutan;
  /** Jumlah usulan yang ditampilkan. Naik 20 setiap "Muat lebih banyak". */
  batas: number;
}

export const FILTER_AWAL: FilterForum = {
  status: "semua",
  rw: null,
  kategori: null,
  urut: "terbaru",
  batas: BATAS_AWAL,
};

type Param = string | string[] | undefined;

const pertama = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);

/** Membaca searchParams apa adanya dari pengunjung; nilai yang tidak dikenal jatuh ke bawaan. */
export function bacaFilter(params: Record<string, Param>): FilterForum {
  const status = pertama(params.status);
  const urut = pertama(params.urut);
  const rw = Number(pertama(params.rw));
  const kategori = pertama(params.kategori);
  const batas = Number(pertama(params.batas));

  return {
    status: (STATUS_FILTER as readonly string[]).includes(status ?? "") ? (status as StatusFilter) : "semua",
    rw: Number.isInteger(rw) && rw > 0 && rw < 1000 ? rw : null,
    kategori: adalahKategori(kategori) ? kategori : null,
    urut: (URUTAN as readonly string[]).includes(urut ?? "") ? (urut as Urutan) : "terbaru",
    batas: Number.isInteger(batas) ? Math.min(Math.max(batas, BATAS_AWAL), BATAS_MAKS) : BATAS_AWAL,
  };
}

/** Query string tanpa nilai bawaan, mis. "?status=voting&urut=dukungan". Kosong bila semua bawaan. */
export function bangunQuery(filter: FilterForum, ubah: Partial<FilterForum> = {}): string {
  const f = { ...filter, ...ubah };
  const q = new URLSearchParams();
  if (f.status !== "semua") q.set("status", f.status);
  if (f.rw !== null) q.set("rw", String(f.rw));
  if (f.kategori !== null) q.set("kategori", f.kategori);
  if (f.urut !== "terbaru") q.set("urut", f.urut);
  if (f.batas > BATAS_AWAL) q.set("batas", String(f.batas));
  const teks = q.toString();
  return teks ? `?${teks}` : "";
}

export const adaFilterAktif = (f: FilterForum): boolean =>
  f.status !== "semua" || f.rw !== null || f.kategori !== null;

// ---------------------------------------------------------------------------
// Menerapkan filter dan urutan
// ---------------------------------------------------------------------------

export interface BisaDisaring {
  id: string;
  status: string;
  rw: number | null;
  category: string;
  created_at: string;
  vote_count: number;
  suara_per_1000: number | null;
}

const DIPUTUSKAN = new Set(["approved", "rejected", "referred", "done"]);

export function cocokStatus(status: string, filter: StatusFilter): boolean {
  if (filter === "semua") return true;
  if (filter === "diputuskan") return DIPUTUSKAN.has(status);
  return status === filter;
}

const terbaru = (a: BisaDisaring, b: BisaDisaring) =>
  b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);

/** Hasil: daftar sebanyak `batas` dan penanda masih ada yang belum tampil. */
export function terapkanFilter<T extends BisaDisaring>(
  daftar: readonly T[],
  filter: FilterForum,
): { tampil: T[]; total: number; adaLagi: boolean } {
  const lolos = daftar.filter(
    (u) =>
      cocokStatus(u.status, filter.status) &&
      (filter.rw === null || u.rw === filter.rw) &&
      (filter.kategori === null || u.category === filter.kategori),
  );

  const urut: Record<Urutan, (a: T, b: T) => number> = {
    terbaru,
    dukungan: (a, b) => b.vote_count - a.vote_count || terbaru(a, b),
    // Usulan tanpa RW (tanpa data penduduk) ditaruh paling bawah.
    "per-seribu": (a, b) =>
      (b.suara_per_1000 ?? -1) - (a.suara_per_1000 ?? -1) || b.vote_count - a.vote_count || terbaru(a, b),
  };
  const terurut = [...lolos].sort(urut[filter.urut]);
  return {
    tampil: terurut.slice(0, filter.batas),
    total: terurut.length,
    adaLagi: terurut.length > filter.batas,
  };
}
