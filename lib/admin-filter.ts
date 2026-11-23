// Filter, urutan, dan paginasi untuk daftar usulan dan daftar akun di halaman admin. Semua keadaan
// hidup di URL (searchParams), jadi bisa dibagikan dan tombol kembali bekerja. Murni, dipakai
// server untuk data yang sudah dibaca dari database.
import { adalahKategori, type Kategori } from "./usulan-skema.ts";

export const PER_HALAMAN = 25;

type Param = string | string[] | undefined;
const pertama = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);

function bacaHalaman(p: Param): number {
  const n = Number(pertama(p));
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

function bacaCari(p: Param): string {
  return (pertama(p) ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export interface Halaman<T> {
  tampil: T[];
  total: number;
  /** Halaman yang benar-benar ditampilkan (dibatasi ke halaman terakhir). */
  halaman: number;
  jumlahHalaman: number;
}

export function potongHalaman<T>(daftar: readonly T[], halaman: number, perHalaman = PER_HALAMAN): Halaman<T> {
  const jumlahHalaman = Math.max(1, Math.ceil(daftar.length / perHalaman));
  const h = Math.min(Math.max(halaman, 1), jumlahHalaman);
  return { tampil: daftar.slice((h - 1) * perHalaman, h * perHalaman), total: daftar.length, halaman: h, jumlahHalaman };
}

function rakit(pasangan: [string, string | null][]): string {
  const q = new URLSearchParams();
  for (const [k, v] of pasangan) if (v !== null && v !== "") q.set(k, v);
  const teks = q.toString();
  return teks ? `?${teks}` : "";
}

// ---------------------------------------------------------------------------
// Usulan
// ---------------------------------------------------------------------------

export const STATUS_USULAN_ADMIN = ["semua", "menunggu", "voting", "diputuskan", "tidak-dilanjutkan", "disembunyikan"] as const;
export type StatusUsulanAdmin = (typeof STATUS_USULAN_ADMIN)[number];

export const LABEL_STATUS_USULAN_ADMIN: Record<StatusUsulanAdmin, string> = {
  semua: "Semua",
  menunggu: "Menunggu ditinjau",
  voting: "Masuk hitungan anggaran",
  diputuskan: "Sudah diputuskan",
  "tidak-dilanjutkan": "Tidak dilanjutkan",
  disembunyikan: "Disembunyikan",
};

export const URUTAN_USULAN_ADMIN = ["antrean", "terbaru", "dukungan"] as const;
export type UrutanUsulanAdmin = (typeof URUTAN_USULAN_ADMIN)[number];

export const LABEL_URUTAN_USULAN_ADMIN: Record<UrutanUsulanAdmin, string> = {
  antrean: "Paling lama menunggu",
  terbaru: "Terbaru",
  dukungan: "Dukungan terbanyak",
};

export interface FilterUsulanAdmin {
  status: StatusUsulanAdmin;
  rw: number | null;
  kategori: Kategori | null;
  q: string;
  urut: UrutanUsulanAdmin;
  halaman: number;
}

export const FILTER_USULAN_AWAL: FilterUsulanAdmin = {
  status: "semua",
  rw: null,
  kategori: null,
  q: "",
  urut: "antrean",
  halaman: 1,
};

export function bacaFilterUsulan(params: Record<string, Param>): FilterUsulanAdmin {
  const status = pertama(params.status) ?? "";
  const urut = pertama(params.urut) ?? "";
  const rw = Number(pertama(params.rw));
  const kategori = pertama(params.kategori);
  return {
    status: (STATUS_USULAN_ADMIN as readonly string[]).includes(status) ? (status as StatusUsulanAdmin) : "semua",
    rw: Number.isInteger(rw) && rw > 0 && rw < 1000 ? rw : null,
    kategori: adalahKategori(kategori) ? kategori : null,
    q: bacaCari(params.q),
    urut: (URUTAN_USULAN_ADMIN as readonly string[]).includes(urut) ? (urut as UrutanUsulanAdmin) : "antrean",
    halaman: bacaHalaman(params.halaman),
  };
}

/** Query string tanpa nilai bawaan, mis. "?status=menunggu&halaman=2". Kosong bila semua bawaan. */
export function bangunQueryUsulan(f: FilterUsulanAdmin, ubah: Partial<FilterUsulanAdmin> = {}): string {
  const g = { ...f, ...ubah };
  return rakit([
    ["status", g.status === "semua" ? null : g.status],
    ["rw", g.rw === null ? null : String(g.rw)],
    ["kategori", g.kategori],
    ["q", g.q],
    ["urut", g.urut === "antrean" ? null : g.urut],
    ["halaman", g.halaman > 1 ? String(g.halaman) : null],
  ]);
}

export const adaFilterUsulanAktif = (f: FilterUsulanAdmin): boolean =>
  f.status !== "semua" || f.rw !== null || f.kategori !== null || f.q !== "";

export interface BisaDisaringUsulan {
  id: string;
  title: string | null;
  status: string;
  rw: number | null;
  category: string;
  created_at: string;
  vote_count: number;
  disembunyikan_pada: string | null;
  /** Usulan yang ditolak tanpa pernah dinilai urgensinya adalah "tidak dilanjutkan"; yang bernilai ditolak musyawarah. */
  urgency_score?: number | null;
}

const DIPUTUSKAN_MUSYAWARAH = new Set(["approved", "referred", "done"]);

export function cocokStatusUsulan(
  u: Pick<BisaDisaringUsulan, "status" | "disembunyikan_pada" | "urgency_score">,
  status: StatusUsulanAdmin,
): boolean {
  const tersembunyi = u.disembunyikan_pada !== null;
  switch (status) {
    case "semua":
      return true;
    case "disembunyikan":
      return tersembunyi;
    case "menunggu":
      return !tersembunyi && u.status === "forum";
    case "voting":
      return !tersembunyi && u.status === "voting";
    case "diputuskan":
      return !tersembunyi && (DIPUTUSKAN_MUSYAWARAH.has(u.status) || (u.status === "rejected" && (u.urgency_score ?? null) !== null));
    case "tidak-dilanjutkan":
      return !tersembunyi && u.status === "rejected" && (u.urgency_score ?? null) === null;
  }
}

/** 0 menunggu ditinjau, 1 masuk hitungan, 2 sudah diputuskan, 3 tersembunyi. */
function kelompokAntrean(u: BisaDisaringUsulan): number {
  if (u.disembunyikan_pada !== null) return 3;
  return u.status === "forum" ? 0 : u.status === "voting" ? 1 : 2;
}

const lebihBaru = (a: BisaDisaringUsulan, b: BisaDisaringUsulan) =>
  b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
const lebihLama = (a: BisaDisaringUsulan, b: BisaDisaringUsulan) =>
  a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

export function terapkanFilterUsulan<T extends BisaDisaringUsulan>(
  daftar: readonly T[],
  f: FilterUsulanAdmin,
): Halaman<T> {
  const kata = f.q.toLowerCase();
  const lolos = daftar.filter(
    (u) =>
      cocokStatusUsulan(u, f.status) &&
      (f.rw === null || u.rw === f.rw) &&
      (f.kategori === null || u.category === f.kategori) &&
      (kata === "" || (u.title ?? "").toLowerCase().includes(kata)),
  );

  const urut: Record<UrutanUsulanAdmin, (a: T, b: T) => number> = {
    // Yang menunggu ditinjau paling lama di atas; sisanya menyusul, yang terbaru dulu.
    antrean: (a, b) => {
      const ka = kelompokAntrean(a);
      const kb = kelompokAntrean(b);
      if (ka !== kb) return ka - kb;
      return ka === 0 ? lebihLama(a, b) : lebihBaru(a, b);
    },
    terbaru: lebihBaru,
    dukungan: (a, b) => b.vote_count - a.vote_count || lebihBaru(a, b),
  };
  return potongHalaman([...lolos].sort(urut[f.urut]), f.halaman);
}

// ---------------------------------------------------------------------------
// Akun
// ---------------------------------------------------------------------------

export const PERAN_FILTER = ["semua", "warga", "admin"] as const;
export type PeranFilter = (typeof PERAN_FILTER)[number];
export const STATUS_AKUN_FILTER = ["semua", "aktif", "nonaktif"] as const;
export type StatusAkunFilter = (typeof STATUS_AKUN_FILTER)[number];

export const LABEL_PERAN_FILTER: Record<PeranFilter, string> = { semua: "Semua", warga: "Warga", admin: "Admin desa" };
export const LABEL_STATUS_AKUN: Record<StatusAkunFilter, string> = { semua: "Semua", aktif: "Aktif", nonaktif: "Nonaktif" };

export interface FilterAkun {
  q: string;
  peran: PeranFilter;
  status: StatusAkunFilter;
  /** Hanya akun yang kata sandinya dibuat atau diatur ulang admin dan belum diganti pemiliknya. */
  belumGanti: boolean;
  halaman: number;
}

export const FILTER_AKUN_AWAL: FilterAkun = { q: "", peran: "semua", status: "semua", belumGanti: false, halaman: 1 };

export function bacaFilterAkun(params: Record<string, Param>): FilterAkun {
  const peran = pertama(params.peran) ?? "";
  const status = pertama(params.status) ?? "";
  return {
    q: bacaCari(params.q),
    peran: (PERAN_FILTER as readonly string[]).includes(peran) ? (peran as PeranFilter) : "semua",
    status: (STATUS_AKUN_FILTER as readonly string[]).includes(status) ? (status as StatusAkunFilter) : "semua",
    belumGanti: pertama(params.sandi) === "belum",
    halaman: bacaHalaman(params.halaman),
  };
}

export function bangunQueryAkun(f: FilterAkun, ubah: Partial<FilterAkun> = {}): string {
  const g = { ...f, ...ubah };
  return rakit([
    ["q", g.q],
    ["peran", g.peran === "semua" ? null : g.peran],
    ["status", g.status === "semua" ? null : g.status],
    ["sandi", g.belumGanti ? "belum" : null],
    ["halaman", g.halaman > 1 ? String(g.halaman) : null],
  ]);
}

export const adaFilterAkunAktif = (f: FilterAkun): boolean =>
  f.q !== "" || f.peran !== "semua" || f.status !== "semua" || f.belumGanti;

export interface BisaDisaringAkun {
  id: string;
  nama_pengguna: string;
  peran: string;
  aktif: boolean;
  harus_ganti_sandi: boolean;
  created_at: string;
  warga_nama: string | null;
  warga_nomor: number | null;
}

export function terapkanFilterAkun<T extends BisaDisaringAkun>(daftar: readonly T[], f: FilterAkun): Halaman<T> {
  const kata = f.q.toLowerCase();
  const lolos = daftar.filter(
    (a) =>
      (f.peran === "semua" || a.peran === f.peran) &&
      (f.status === "semua" || a.aktif === (f.status === "aktif")) &&
      (!f.belumGanti || a.harus_ganti_sandi) &&
      (kata === "" ||
        a.nama_pengguna.toLowerCase().includes(kata) ||
        (a.warga_nama ?? "").toLowerCase().includes(kata) ||
        (a.warga_nomor !== null && String(a.warga_nomor) === kata)),
  );
  // Yang terbaru dibuat di atas: akun yang baru saja dibuat admin langsung terlihat.
  const terurut = [...lolos].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  return potongHalaman(terurut, f.halaman);
}
