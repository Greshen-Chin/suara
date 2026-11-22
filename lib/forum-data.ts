// Membaca data forum untuk halaman. Hanya untuk server.
//
// Pola sama dengan lib/data.ts: bila database tidak menjawab dalam 3 detik atau skemanya
// belum cocok (mis. migrasi 0004 belum dijalankan), datanya diambil dari
// lib/fallback-forum.json dan dataCadangan = true. Halaman lalu menampilkan penandanya
// dan mematikan aksi tulis.
//
// Yang di-cache ('use cache') hanya data yang sama untuk semua pengunjung. Apakah warga
// yang sedang masuk sudah mendukung sebuah usulan bergantung pada sesi, jadi dibaca terpisah
// (dukunganSaya) dan tidak pernah masuk ke cache bersama.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  denganFallback,
  getPagu,
  getRekomendasi,
  getWilayah,
  logDariDb,
  wajib,
  type BarisLog,
} from "./data";
import type { Database } from "./database.types";
import fallbackJson from "./fallback-forum.json";
import { statusUsulan, type StatusUsulan } from "./seleksi";
import { supabaseServer } from "./supabase-server";
import { TAG } from "./tag-cache";

// Jumlah usulan yang dibaca sekali jalan. Forum desa jauh di bawah ini; kalau suatu saat
// lebih, daftar dipotong menurut yang terbaru dan perlu paginasi di sisi database.
const BATAS_BARIS = 500;

// Kolom dipilih satu per satu, bukan select("*"). Bila migrasi 0004 belum dijalankan, view lama
// (v_forum hanya memuat status 'forum') mengembalikan nol baris TANPA galat, dan forum tampak
// kosong padahal datanya ada. Dengan kolom eksplisit, skema lama menghasilkan galat
// "kolom tidak ada", sehingga halaman beralih ke data cadangan dan menampilkan penandanya.
const KOLOM_FORUM =
  "id, title, nama_singkat, category, estimated_budget, status, source, rw, created_at, pengusul_nama_depan, pengusul_rw, vote_count, jumlah_komentar, penduduk, suara_per_1000" as const;
const KOLOM_USULAN =
  "id, title, nama_singkat, category, estimated_budget, status, source, rw, created_at, pengusul_nama_depan, pengusul_rw, vote_count, jumlah_komentar, penduduk, suara_per_1000, description, urgency_score, urgency_reason, disembunyikan_pada, alasan_disembunyikan" as const;
const KOLOM_KOMENTAR =
  "id, proposal_id, isi, created_at, disembunyikan_pada, alasan_disembunyikan, dari_admin, penulis_nama_depan, penulis_rw" as const;
const BATAS_WAKTU_DUKUNGAN_MS = 3000;

type Baca<T extends "v_forum" | "v_usulan" | "v_komentar"> = Database["public"]["Views"][T]["Row"];

/** Satu baris di daftar forum. Tidak memuat deskripsi: daftar tidak menampilkannya. */
export interface BarisForum {
  id: string;
  title: string;
  nama_singkat: string | null;
  category: string;
  estimated_budget: number;
  status: string;
  source: string;
  rw: number | null;
  created_at: string;
  /** Nama depan saja. Nomor dan nama lengkap warga tidak pernah dibaca dari database. */
  pengusul_nama_depan: string | null;
  pengusul_rw: number | null;
  vote_count: number;
  jumlah_komentar: number;
  penduduk: number | null;
  suara_per_1000: number | null;
}

/** Posisi usulan 'voting' pada rekomendasi resmi, dari perhitungan yang sama dengan Garis Pagu. */
export interface PosisiAnggaran {
  peringkat: number;
  status: StatusUsulan;
  jumlahUsulan: number;
}

export interface ItemForum extends BarisForum {
  posisi: PosisiAnggaran | null;
}

export interface DataForum {
  usulan: ItemForum[];
  wilayah: { rw: number; nama: string }[];
  /** true bila datanya dari cadangan karena database tidak terjangkau. */
  dataCadangan: boolean;
}

/** Satu usulan lengkap. Untuk usulan tersembunyi, judul dan isi sudah dikosongkan oleh database. */
export interface DetailUsulan {
  id: string;
  title: string | null;
  nama_singkat: string | null;
  description: string | null;
  category: string;
  estimated_budget: number;
  status: string;
  source: string;
  rw: number | null;
  created_at: string;
  urgency_score: number | null;
  urgency_reason: string | null;
  disembunyikan_pada: string | null;
  alasan_disembunyikan: string | null;
  pengusul_nama_depan: string | null;
  pengusul_rw: number | null;
  vote_count: number;
  jumlah_komentar: number;
  penduduk: number | null;
  suara_per_1000: number | null;
}

export interface KomentarForum {
  id: string;
  /** null bila komentar disembunyikan. */
  isi: string | null;
  created_at: string;
  disembunyikan_pada: string | null;
  alasan_disembunyikan: string | null;
  dari_admin: boolean;
  penulis_nama_depan: string | null;
  penulis_rw: number | null;
}

export interface DataUsulan {
  /** null = tidak ada usulan dengan id ini (404). */
  usulan: DetailUsulan | null;
  komentar: KomentarForum[];
  riwayat: BarisLog[];
  posisi: PosisiAnggaran | null;
  dataCadangan: boolean;
}

// ---------------------------------------------------------------------------
// Data cadangan
// ---------------------------------------------------------------------------

interface DataCadangan {
  dibuat: string;
  usulan: DetailUsulan[];
  komentar: (KomentarForum & { proposal_id: string })[];
  log: Database["public"]["Tables"]["accountability_logs"]["Row"][];
}

const CADANGAN = fallbackJson as unknown as DataCadangan;

// ---------------------------------------------------------------------------
// Pemetaan baris database. `wajib` melempar bila kolom hilang, yang berarti skema database
// belum cocok dengan kode; denganFallback menangkapnya dan beralih ke data cadangan.
// ---------------------------------------------------------------------------

function forumDariDb(r: Baca<"v_forum">): BarisForum {
  return {
    id: wajib(r.id, "id"),
    title: wajib(r.title, "title"),
    nama_singkat: r.nama_singkat,
    category: wajib(r.category, "category"),
    estimated_budget: wajib(r.estimated_budget, "estimated_budget"),
    status: wajib(r.status, "status"),
    source: wajib(r.source, "source"),
    rw: r.rw,
    created_at: wajib(r.created_at, "created_at"),
    pengusul_nama_depan: r.pengusul_nama_depan,
    pengusul_rw: r.pengusul_rw,
    vote_count: wajib(r.vote_count, "vote_count"),
    jumlah_komentar: wajib(r.jumlah_komentar, "jumlah_komentar"),
    penduduk: r.penduduk,
    suara_per_1000: r.suara_per_1000,
  };
}

function detailDariDb(r: Baca<"v_usulan">): DetailUsulan {
  return {
    id: wajib(r.id, "id"),
    title: r.title,
    nama_singkat: r.nama_singkat,
    description: r.description,
    category: wajib(r.category, "category"),
    estimated_budget: wajib(r.estimated_budget, "estimated_budget"),
    status: wajib(r.status, "status"),
    source: wajib(r.source, "source"),
    rw: r.rw,
    created_at: wajib(r.created_at, "created_at"),
    urgency_score: r.urgency_score,
    urgency_reason: r.urgency_reason,
    disembunyikan_pada: r.disembunyikan_pada,
    alasan_disembunyikan: r.alasan_disembunyikan,
    pengusul_nama_depan: r.pengusul_nama_depan,
    pengusul_rw: r.pengusul_rw,
    vote_count: wajib(r.vote_count, "vote_count"),
    jumlah_komentar: wajib(r.jumlah_komentar, "jumlah_komentar"),
    penduduk: r.penduduk,
    suara_per_1000: r.suara_per_1000,
  };
}

function komentarDariDb(r: Baca<"v_komentar">): KomentarForum {
  return {
    id: wajib(r.id, "id"),
    isi: r.isi,
    created_at: wajib(r.created_at, "created_at"),
    disembunyikan_pada: r.disembunyikan_pada,
    alasan_disembunyikan: r.alasan_disembunyikan,
    dari_admin: wajib(r.dari_admin, "dari_admin"),
    penulis_nama_depan: r.penulis_nama_depan,
    penulis_rw: r.penulis_rw,
  };
}

function keBarisForum(u: DetailUsulan): BarisForum {
  return {
    id: u.id,
    title: u.title ?? "",
    nama_singkat: u.nama_singkat,
    category: u.category,
    estimated_budget: u.estimated_budget,
    status: u.status,
    source: u.source,
    rw: u.rw,
    created_at: u.created_at,
    pengusul_nama_depan: u.pengusul_nama_depan,
    pengusul_rw: u.pengusul_rw,
    vote_count: u.vote_count,
    jumlah_komentar: u.jumlah_komentar,
    penduduk: u.penduduk,
    suara_per_1000: u.suara_per_1000,
  };
}

// ---------------------------------------------------------------------------
// Pembaca
// ---------------------------------------------------------------------------

/**
 * Semua usulan yang tampil di forum (tanpa yang tersembunyi), beserta posisi anggaran untuk
 * yang berstatus voting. Disaring dan diurutkan di server halaman dengan terapkanFilter,
 * bukan di sini, supaya satu entri cache melayani semua kombinasi filter.
 */
export async function muatForum(): Promise<DataForum> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  // forum: jumlah dukungan dan komentar. beranda: peringkat berasal dari perhitungan yang sama
  // dengan Garis Pagu, jadi ikut berubah bila dukungan pada usulan voting berubah.
  // pengaturan: pagu dan bobot yang dipakai perhitungan itu.
  cacheTag(TAG.forum, TAG.beranda, TAG.pengaturan);

  const pagu = await getPagu();
  const [forum, rekomendasi, wilayah] = await Promise.all([
    denganFallback<BarisForum[]>(
      async (sinyal) => {
        const { data, error } = await supabaseServer
          .from("v_forum")
          .select(KOLOM_FORUM)
          .order("created_at", { ascending: false })
          .limit(BATAS_BARIS)
          .abortSignal(sinyal);
        return { data: data?.map(forumDariDb) ?? null, error };
      },
      () =>
        CADANGAN.usulan
          .filter((u) => u.disembunyikan_pada === null)
          .map(keBarisForum),
    ),
    getRekomendasi(pagu.data),
    getWilayah(),
  ]);

  return {
    usulan: gabungPosisi(forum.data, rekomendasi.data),
    wilayah: wilayah.data.map((w) => ({ rw: w.rw, nama: w.nama })),
    dataCadangan: [pagu, forum, rekomendasi, wilayah].some((h) => h.source === "fallback"),
  };
}

type Rekomendasi = Awaited<ReturnType<typeof getRekomendasi>>["data"];

function petaPosisi(rekomendasi: Rekomendasi): Map<string, PosisiAnggaran> {
  const peta = new Map<string, PosisiAnggaran>();
  if (rekomendasi.length === 0) return peta;
  // Mode 'skor' dengan bobot resmi: status "ditunda" sama dengan yang tampil di halaman utama.
  for (const r of statusUsulan(
    rekomendasi.map((x) => ({ id: x.id, peringkat: x.peringkat, selected: x.selected, skor: x.skor })),
    "skor",
  )) {
    peta.set(r.id, { peringkat: r.peringkat, status: r.status, jumlahUsulan: rekomendasi.length });
  }
  return peta;
}

function gabungPosisi(forum: BarisForum[], rekomendasi: Rekomendasi): ItemForum[] {
  const posisi = petaPosisi(rekomendasi);
  return forum.map((u) => ({
    ...u,
    posisi: u.status === "voting" ? (posisi.get(u.id) ?? null) : null,
  }));
}

/** Satu usulan beserta komentar, riwayat, dan posisinya. `usulan` null berarti tidak ada. */
export async function muatUsulan(id: string): Promise<DataUsulan> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  // beranda dan pengaturan juga: posisi anggaran usulan ini bergantung pada pagu, bobot, dan usulan
  // lain yang masuk hitungan, jadi berubah saat admin memindahkan usulan lain atau mengubah angka.
  cacheTag(TAG.usulan(id), TAG.forum, TAG.beranda, TAG.pengaturan);

  const pagu = await getPagu();
  const [usulan, komentar, riwayat, rekomendasi] = await Promise.all([
    denganFallback<{ baris: DetailUsulan | null }>(
      async (sinyal) => {
        const { data, error } = await supabaseServer
          .from("v_usulan")
          .select(KOLOM_USULAN)
          .eq("id", id)
          .abortSignal(sinyal)
          .maybeSingle();
        // "Tidak ada" adalah jawaban yang sah; hanya error yang beralih ke cadangan.
        return { data: error ? null : { baris: data ? detailDariDb(data) : null }, error };
      },
      () => ({ baris: CADANGAN.usulan.find((u) => u.id === id) ?? null }),
    ),
    denganFallback<KomentarForum[]>(
      async (sinyal) => {
        const { data, error } = await supabaseServer
          .from("v_komentar")
          .select(KOLOM_KOMENTAR)
          .eq("proposal_id", id)
          .order("created_at", { ascending: true })
          .abortSignal(sinyal);
        return { data: data?.map(komentarDariDb) ?? null, error };
      },
      () => CADANGAN.komentar.filter((k) => k.proposal_id === id),
    ),
    denganFallback<BarisLog[]>(
      async (sinyal) => {
        const { data, error } = await supabaseServer
          .from("accountability_logs")
          .select("*")
          .eq("proposal_id", id)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .abortSignal(sinyal);
        return { data: data?.map(logDariDb) ?? null, error };
      },
      () => CADANGAN.log.filter((l) => l.proposal_id === id).map(logDariDb),
    ),
    getRekomendasi(pagu.data),
  ]);

  const posisi = usulan.data.baris?.status === "voting" ? (petaPosisi(rekomendasi.data).get(id) ?? null) : null;
  return {
    usulan: usulan.data.baris,
    komentar: komentar.data,
    riwayat: riwayat.data,
    posisi,
    dataCadangan: [pagu, usulan, komentar, riwayat, rekomendasi].some((h) => h.source === "fallback"),
  };
}

/**
 * Id usulan (dari `ids`) yang sudah didukung warga ini. TIDAK di-cache: bergantung pada sesi.
 * Gangguan database dibaca sebagai "belum ada yang didukung": tombol tetap bisa dipakai dan
 * server tetap idempoten, jadi paling buruk label tombol sempat keliru.
 */
export async function dukunganSaya(wargaId: string, ids: readonly string[]): Promise<ReadonlySet<string>> {
  if (ids.length === 0) return new Set();
  try {
    const { data, error } = await supabaseServer
      .from("votes")
      .select("proposal_id")
      .eq("warga_id", wargaId)
      .in("proposal_id", [...ids])
      .abortSignal(AbortSignal.timeout(BATAS_WAKTU_DUKUNGAN_MS));
    if (error) throw new Error(error.message);
    return new Set(data.map((v) => v.proposal_id));
  } catch (err) {
    console.error("Gagal membaca dukungan warga:", err instanceof Error ? err.message : err);
    return new Set();
  }
}

/**
 * RW tempat tinggal warga ini, untuk bawaan isian "RW lokasi". Hanya angka RW yang dibaca,
 * tidak ada nama atau nomor warga. Tidak di-cache: bergantung pada sesi. Gagal = null (isian kosong).
 */
export async function rwWarga(wargaId: string): Promise<number | null> {
  try {
    const { data, error } = await supabaseServer
      .from("warga")
      .select("rw")
      .eq("id", wargaId)
      .abortSignal(AbortSignal.timeout(BATAS_WAKTU_DUKUNGAN_MS))
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.rw ?? null;
  } catch (err) {
    console.error("Gagal membaca RW warga:", err instanceof Error ? err.message : err);
    return null;
  }
}
