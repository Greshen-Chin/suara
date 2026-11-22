// Fungsi data untuk halaman SUARA. Hanya untuk server.
// Setiap fungsi mengembalikan { data, source }. Kalau database error atau tidak menjawab
// dalam 3 detik, datanya diambil dari lib/fallback-data.json dan source = 'fallback'.
import "server-only";
import type { Database } from "./database.types";
import fallbackJson from "./fallback-data.json";
import { JENIS_LOG, type JenisLog } from "./jenis-log";
import {
  greedyPilih,
  pilihOptimal,
  type Bobot,
  type HasilPilih,
  type ModeSeleksi,
  type Usulan,
  type Wilayah,
} from "./seleksi";
import { supabaseServer } from "./supabase-server";

export const BATAS_WAKTU_MS = 3000;
/**
 * Pagu yang berlaku ada di tabel pengaturan_anggaran (admin mengubahnya). Nilai ini hanya
 * cadangan untuk halaman PUBLIK bila database tidak terjangkau: sama dengan pagu awal di seed.
 * Halaman admin tidak pernah memakainya (lihat lib/admin-data.ts).
 */
export const PAGU_DEFAULT = 300_000_000;

// Bobot bawaan fungsi SQL greedy_pilih bila argumen bobot tidak diberikan.
const BOBOT_BAWAAN_SQL: Bobot = { popularitas: 30, urgensi: 40, pemerataan: 30 };

// ---------------------------------------------------------------------------
// Tipe hasil
// ---------------------------------------------------------------------------

export type Sumber = "db" | "fallback";
export interface Hasil<T> {
  data: T;
  source: Sumber;
}

export interface BarisRekomendasi {
  peringkat: number;
  id: string;
  title: string;
  nama_singkat: string;
  category: string;
  rw: number;
  estimated_budget: number;
  vote_count: number;
  /** Skala 1-10. */
  urgency_score: number;
  skor: number;
  selected: boolean;
  total_berjalan: number;
}

export interface BarisWilayah {
  rw: number;
  nama: string;
  penduduk: number;
  anggaran_lalu: number;
  jumlah_usulan: number;
  jumlah_suara: number;
}

// Jenis log dan labelnya ada di lib/jenis-log.ts (murni, bisa dipakai komponen mana pun).
export { JENIS_LOG, type JenisLog };

type BarisLogDb = Database["public"]["Tables"]["accountability_logs"]["Row"];
export type BarisLog = Omit<BarisLogDb, "log_type"> & { log_type: JenisLog };

/** Jenis yang tidak dikenal (mis. kode lebih lama dari database) dibaca sebagai 'note', bukan merusak halaman. */
export function logDariDb(r: BarisLogDb): BarisLog {
  const jenis = (JENIS_LOG as readonly string[]).includes(r.log_type)
    ? (r.log_type as JenisLog)
    : "note";
  return { ...r, log_type: jenis };
}

type HasilPilihDb = Database["public"]["CompositeTypes"]["hasil_pilih"];
type BarisWilayahDb = Database["public"]["Views"]["v_wilayah"]["Row"];

interface UsulanFallback {
  id: string;
  title: string;
  nama_singkat: string;
  category: string;
  rw: number;
  estimated_budget: number;
  vote_count: number;
  urgency_score: number;
}

interface WilayahFallback {
  rw: number;
  nama: string;
  penduduk: number;
  anggaran_lalu: number;
}

interface DataFallback {
  dibuat: string;
  pagu_contoh: number;
  bobot_resmi: Bobot;
  wilayah: WilayahFallback[];
  usulan_voting: UsulanFallback[];
  log_terbaru: BarisLogDb[];
}

const FALLBACK: DataFallback = fallbackJson;

// ---------------------------------------------------------------------------
// Pembantu
// ---------------------------------------------------------------------------

interface Jawaban<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Jalankan kueri dengan batas waktu; apa pun yang gagal jatuh ke fallback. */
export async function denganFallback<T>(
  kueri: (sinyal: AbortSignal) => PromiseLike<Jawaban<T>>,
  fallback: () => T,
): Promise<Hasil<T>> {
  try {
    const { data, error } = await kueri(AbortSignal.timeout(BATAS_WAKTU_MS));
    if (error || data === null)
      throw new Error(error?.message ?? "data kosong");
    return { data, source: "db" };
  } catch {
    return { data: fallback(), source: "fallback" };
  }
}

/** Kolom wajib ada dan tidak null. Kolom yang hilang berarti skema database belum cocok dengan kode. */
export function wajib<T>(nilai: T | null | undefined, nama: string): T {
  if (nilai === null || nilai === undefined)
    throw new Error(`kolom ${nama} kosong atau tidak ada`);
  return nilai;
}

function dariDb(r: HasilPilihDb): BarisRekomendasi {
  return {
    peringkat: wajib(r.peringkat, "peringkat"),
    id: wajib(r.id, "id"),
    title: wajib(r.title, "title"),
    nama_singkat: wajib(r.nama_singkat, "nama_singkat"),
    category: wajib(r.category, "category"),
    rw: wajib(r.rw, "rw"),
    estimated_budget: wajib(r.estimated_budget, "estimated_budget"),
    vote_count: wajib(r.vote_count, "vote_count"),
    urgency_score: wajib(r.urgency_score, "urgency_score"),
    skor: wajib(r.skor, "skor"),
    selected: wajib(r.selected, "selected"),
    total_berjalan: wajib(r.total_berjalan, "total_berjalan"),
  };
}

function wilayahDariDb(r: BarisWilayahDb): BarisWilayah {
  return {
    rw: wajib(r.rw, "rw"),
    nama: wajib(r.nama, "nama"),
    penduduk: wajib(r.penduduk, "penduduk"),
    anggaran_lalu: wajib(r.anggaran_lalu, "anggaran_lalu"),
    jumlah_usulan: wajib(r.jumlah_usulan, "jumlah_usulan"),
    jumlah_suara: wajib(r.jumlah_suara, "jumlah_suara"),
  };
}

function usulanFallback(): Usulan[] {
  return FALLBACK.usulan_voting.map((u) => ({
    id: u.id,
    title: u.title,
    namaSingkat: u.nama_singkat,
    category: u.category,
    rw: u.rw,
    estimatedBudget: u.estimated_budget,
    voteCount: u.vote_count,
    urgencyScore: u.urgency_score,
  }));
}

function wilayahFallback(): Wilayah[] {
  return FALLBACK.wilayah.map((w) => ({
    rw: w.rw,
    nama: w.nama,
    penduduk: w.penduduk,
    anggaranLalu: w.anggaran_lalu,
  }));
}

function barisDariHasil(hasil: HasilPilih[]): BarisRekomendasi[] {
  return hasil.map((h) => ({
    peringkat: h.peringkat,
    id: h.id,
    title: h.title,
    nama_singkat: h.namaSingkat,
    category: h.category,
    rw: h.rw,
    estimated_budget: h.estimatedBudget,
    vote_count: h.voteCount,
    urgency_score: h.urgencyScore,
    skor: Math.round(h.skor * 10_000) / 10_000,
    selected: h.selected,
    total_berjalan: h.totalBerjalan,
  }));
}

/** Hitung ulang dari data fallback, sehingga pagu berapa pun tetap benar. */
function hitungFallback(
  pagu: number,
  mode: ModeSeleksi | "optimal",
  bobot: Bobot,
): BarisRekomendasi[] {
  const usulan = usulanFallback();
  const wilayah = wilayahFallback();
  return barisDariHasil(
    mode === "optimal"
      ? pilihOptimal(usulan, wilayah, pagu, bobot)
      : greedyPilih(usulan, wilayah, pagu, mode, bobot),
  );
}

// ---------------------------------------------------------------------------
// Fungsi yang dipakai halaman
// ---------------------------------------------------------------------------

/** Pagu yang berlaku (tabel pengaturan_anggaran). Cadangan publik: PAGU_DEFAULT. */
export function getPagu(): Promise<Hasil<number>> {
  return denganFallback(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .from("pengaturan_anggaran")
        .select("pagu")
        .eq("id", 1)
        .abortSignal(sinyal)
        .single();
      return { data: data ? data.pagu : null, error };
    },
    () => PAGU_DEFAULT,
  );
}

/** Rekomendasi resmi: kombinasi terbaik dengan bobot resmi dari tabel scoring_weights. */
export function getRekomendasi(
  pagu: number,
): Promise<Hasil<BarisRekomendasi[]>> {
  return denganFallback(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .rpc("rekomendasi_resmi", { p_pagu: pagu })
        .abortSignal(sinyal);
      return { data: data?.map(dariDb) ?? null, error };
    },
    () => hitungFallback(pagu, "optimal", FALLBACK.bobot_resmi),
  );
}

/** Seleksi greedy mode 'suara' atau 'skor'. Tanpa bobot, dipakai bobot bawaan SQL. */
export function getGreedy(
  pagu: number,
  mode: ModeSeleksi,
  bobot?: Bobot,
): Promise<Hasil<BarisRekomendasi[]>> {
  return denganFallback(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .rpc("greedy_pilih", {
          p_pagu: pagu,
          p_mode: mode,
          ...(bobot && {
            p_w_popularitas: bobot.popularitas,
            p_w_urgensi: bobot.urgensi,
            p_w_pemerataan: bobot.pemerataan,
          }),
        })
        .abortSignal(sinyal);
      return { data: data?.map(dariDb) ?? null, error };
    },
    () => hitungFallback(pagu, mode, bobot ?? BOBOT_BAWAAN_SQL),
  );
}

/** Bobot resmi hasil musyawarah (tabel scoring_weights). */
export function getBobotResmi(): Promise<Hasil<Bobot>> {
  return denganFallback(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .from("scoring_weights")
        .select("w_popularitas, w_urgensi, w_pemerataan")
        .eq("id", 1)
        .abortSignal(sinyal)
        .single();
      return {
        data: data && {
          popularitas: data.w_popularitas,
          urgensi: data.w_urgensi,
          pemerataan: data.w_pemerataan,
        },
        error,
      };
    },
    () => FALLBACK.bobot_resmi,
  );
}

/** Ringkasan tiap RW: penduduk, anggaran periode lalu, jumlah usulan dan suara. */
export function getWilayah(): Promise<Hasil<BarisWilayah[]>> {
  return denganFallback(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .from("v_wilayah")
        .select("*")
        .abortSignal(sinyal);
      return { data: data?.map(wilayahDariDb) ?? null, error };
    },
    () =>
      FALLBACK.wilayah.map((w) => {
        const usulan = FALLBACK.usulan_voting.filter((u) => u.rw === w.rw);
        return {
          ...w,
          jumlah_usulan: usulan.length,
          jumlah_suara: usulan.reduce((n, u) => n + u.vote_count, 0),
        };
      }),
  );
}

/** Log akuntabilitas, terbaru di atas. */
export function getLogTerbaru(limit = 10): Promise<Hasil<BarisLog[]>> {
  const batas = Math.min(Math.max(Math.trunc(limit), 1), 100);
  return denganFallback(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .from("accountability_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(batas)
        .abortSignal(sinyal);
      return { data: data?.map(logDariDb) ?? null, error };
    },
    () => FALLBACK.log_terbaru.slice(0, batas).map(logDariDb),
  );
}
