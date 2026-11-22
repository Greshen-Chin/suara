// Pembantu untuk Server Action forum (app/forum/aksi.ts). Hanya untuk server.
// Dipisah dari file "use server" karena file itu hanya boleh mengekspor fungsi async.
import "server-only";
import type { Json } from "./database.types";
import { lamaTunggu } from "./waktu";

/** Kode galat yang dikenal aplikasi. Sebagian berasal dari fungsi SQL (supabase/migrations/0004_forum.sql). */
export type KodeGalat =
  | "belum_masuk"
  | "akun_tidak_aktif"
  | "bukan_warga"
  | "tanpa_warga"
  | "bukan_admin"
  | "tidak_ditemukan"
  | "disembunyikan"
  | "sudah_disembunyikan"
  | "ditutup"
  | "tidak_valid"
  | "batas_laju"
  | "gangguan";

export interface Galat {
  ok: false;
  kode: KodeGalat;
  pesan: string;
  /** Untuk batas_laju: berapa detik lagi boleh mencoba. */
  ulangDetik?: number;
  /** Untuk tidak_valid dari database: bidang yang ditolak. */
  bidang?: string;
}

/** Apa yang sedang dikerjakan; menentukan kalimat untuk galat yang sama. */
export type Konteks = "dukung" | "usul" | "komentar" | "sembunyikan" | "periksa";

const GANGGUAN =
  "Belum bisa menyimpan karena server sedang bermasalah. Coba lagi beberapa menit lagi.";

export function buatGalat(
  kode: KodeGalat,
  konteks: Konteks,
  tambahan: { ulangDetik?: number; bidang?: string } = {},
): Galat {
  return {
    ok: false,
    kode,
    pesan: pesanGalat(kode, konteks, tambahan.ulangDetik),
    ...(tambahan.ulangDetik !== undefined && { ulangDetik: tambahan.ulangDetik }),
    ...(tambahan.bidang !== undefined && { bidang: tambahan.bidang }),
  };
}

export function pesanGalat(kode: KodeGalat, konteks: Konteks, ulangDetik?: number): string {
  switch (kode) {
    case "belum_masuk":
      return "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan.";
    case "akun_tidak_aktif":
      return "Akun Anda sedang tidak aktif. Hubungi admin desa.";
    case "bukan_warga":
      return konteks === "dukung"
        ? "Admin desa tidak memberi dukungan, supaya hasilnya tidak terpengaruh."
        : "Hanya akun warga yang bisa melakukan ini.";
    case "tanpa_warga":
      return "Akun Anda belum tertaut ke data warga. Hubungi admin desa.";
    case "bukan_admin":
      return "Hanya admin desa yang bisa menyembunyikan usulan atau komentar.";
    case "tidak_ditemukan":
      return konteks === "komentar"
        ? "Usulan ini sudah tidak ada, jadi komentar tidak bisa dikirim."
        : "Usulan ini tidak ditemukan. Mungkin sudah dihapus.";
    case "disembunyikan":
      return "Usulan ini sudah disembunyikan oleh admin desa.";
    case "sudah_disembunyikan":
      return "Ini sudah disembunyikan sebelumnya.";
    case "ditutup":
      return "Dukungan ditutup karena usulan ini sudah diputuskan.";
    case "tidak_valid":
      return "Ada isian yang belum sesuai. Periksa lagi isian yang bertanda galat.";
    case "batas_laju": {
      const tunggu = lamaTunggu(ulangDetik ?? 20);
      return konteks === "usul"
        ? `Anda sudah mengirim 3 usulan dalam 24 jam terakhir. Usulan berikutnya bisa dikirim ${tunggu} lagi.`
        : `Anda baru saja mengirim komentar. Tunggu ${tunggu} lagi, lalu kirim kembali.`;
    }
    case "gangguan":
      return konteks === "periksa"
        ? "Pemeriksaan usulan serupa belum bisa dijalankan sekarang. Anda tetap bisa mengajukan usulan."
        : GANGGUAN;
  }
}

export type HasilRpc =
  | { ok: true; data: Record<string, Json | undefined> }
  | { ok: false; kode: KodeGalat; ulangDetik?: number; bidang?: string };

const KODE_DIKENAL = new Set<string>([
  "akun_tidak_aktif",
  "bukan_warga",
  "tanpa_warga",
  "bukan_admin",
  "tidak_ditemukan",
  "disembunyikan",
  "sudah_disembunyikan",
  "ditutup",
  "tidak_valid",
  "batas_laju",
]);

/** Mengurai jsonb dari fungsi SQL: {"ok": true, ...} atau {"ok": false, "kode": "..."}. */
export function uraiHasilRpc(nilai: Json): HasilRpc {
  if (typeof nilai !== "object" || nilai === null || Array.isArray(nilai)) {
    return { ok: false, kode: "gangguan" };
  }
  if (nilai.ok === true) return { ok: true, data: nilai };
  const kode = typeof nilai.kode === "string" && KODE_DIKENAL.has(nilai.kode) ? (nilai.kode as KodeGalat) : "gangguan";
  return {
    ok: false,
    kode,
    ...(typeof nilai.ulang_detik === "number" && { ulangDetik: nilai.ulang_detik }),
    ...(typeof nilai.bidang === "string" && { bidang: nilai.bidang }),
  };
}

const BATAS_WAKTU_TULIS_MS = 5000;

type NamaFungsi = "dukung_usulan" | "batal_dukung" | "ajukan_usulan" | "tambah_komentar" | "sembunyikan";

/**
 * Memanggil fungsi SQL penulis. `panggil` membuat permintaannya (dengan tipe argumen lengkap
 * di tempat pemanggil); di sini hanya batas waktu, pencatatan galat, dan penguraian hasil.
 * Kegagalan jaringan atau database menjadi { kode: "gangguan" }. Yang dicatat hanya nama
 * fungsi dan kode galat, tidak ada isi masukan warga.
 */
export async function panggilFungsi(
  nama: NamaFungsi,
  panggil: (sinyal: AbortSignal) => PromiseLike<{ data: Json | null; error: { code?: string; message: string } | null }>,
): Promise<HasilRpc> {
  try {
    const { data, error } = await panggil(AbortSignal.timeout(BATAS_WAKTU_TULIS_MS));
    if (error || data === null) {
      console.error(`rpc ${nama} gagal:`, error?.code, error?.message);
      return { ok: false, kode: "gangguan" };
    }
    return uraiHasilRpc(data);
  } catch (err) {
    console.error(`rpc ${nama} gagal:`, err instanceof Error ? err.name : "tidak diketahui");
    return { ok: false, kode: "gangguan" };
  }
}
