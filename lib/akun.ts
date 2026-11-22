// Akses tabel akun dan percobaan_masuk. Hanya untuk server (memakai service_role).
// Berbeda dari lib/data.ts, fungsi di sini TIDAK punya data cadangan: kalau database
// bermasalah, error dilempar dan login ditolak.
import "server-only";
import { BATAS_WAKTU_MS } from "./data";
import type { Peran } from "./sesi-token";
import { supabaseServer } from "./supabase-server";

export interface AkunMasuk {
  id: string;
  nama_pengguna: string;
  hash_kata_sandi: string;
  peran: Peran;
  aktif: boolean;
  versi_sesi: number;
  /** Kata sandi dibuat atau diatur ulang admin; pemilik akun diminta menggantinya saat masuk. */
  harus_ganti_sandi: boolean;
}

export type AkunPublik = Omit<AkunMasuk, "hash_kata_sandi"> & {
  /** Warga yang ditautkan ke akun ini. Kosong untuk admin dan akun warga yang belum tertaut. */
  warga_id: string | null;
};

const sinyal = () => AbortSignal.timeout(BATAS_WAKTU_MS);

function periksa<T>(hasil: { data: T; error: { message: string } | null }): T {
  if (hasil.error) throw new Error(`Database: ${hasil.error.message}`);
  return hasil.data;
}

function sebagaiPeran(nilai: string): Peran {
  if (nilai !== "warga" && nilai !== "admin") throw new Error(`Peran tidak dikenal: ${nilai}`);
  return nilai;
}

/** Termasuk hash kata sandi. Hanya untuk memeriksa login, jangan dikirim ke klien. */
export async function cariAkunUntukMasuk(nama: string): Promise<AkunMasuk | null> {
  const data = periksa(
    await supabaseServer
      .from("akun")
      .select("id, nama_pengguna, hash_kata_sandi, peran, aktif, versi_sesi, harus_ganti_sandi")
      .eq("nama_pengguna", nama)
      .abortSignal(sinyal())
      .maybeSingle(),
  );
  return data && { ...data, peran: sebagaiPeran(data.peran) };
}

/** Tanpa hash. Dipakai untuk memastikan sesi masih berlaku. */
export async function cariAkunById(id: string): Promise<AkunPublik | null> {
  const data = periksa(
    await supabaseServer
      .from("akun")
      .select("id, nama_pengguna, peran, aktif, versi_sesi, warga_id, harus_ganti_sandi")
      .eq("id", id)
      .abortSignal(sinyal())
      .maybeSingle(),
  );
  return data && { ...data, peran: sebagaiPeran(data.peran) };
}

/** Waktu akhir penguncian bila nama pengguna sedang dikunci, selain itu null. */
export async function terkunciSampai(nama: string): Promise<Date | null> {
  const data = periksa(
    await supabaseServer
      .from("percobaan_masuk")
      .select("terkunci_sampai")
      .eq("nama_pengguna", nama)
      .abortSignal(sinyal())
      .maybeSingle(),
  );
  const t = data?.terkunci_sampai ? new Date(data.terkunci_sampai) : null;
  return t && t.getTime() > Date.now() ? t : null;
}

/** Catat satu login gagal. Mengembalikan waktu akhir penguncian bila kini terkunci. */
export async function catatGagalMasuk(nama: string): Promise<Date | null> {
  const data = periksa(
    await supabaseServer
      .rpc("catat_gagal_masuk", { p_nama_pengguna: nama })
      .abortSignal(sinyal()),
  );
  const t = data ? new Date(data) : null;
  return t && t.getTime() > Date.now() ? t : null;
}

export async function hapusPercobaanMasuk(nama: string): Promise<void> {
  periksa(
    await supabaseServer
      .from("percobaan_masuk")
      .delete()
      .eq("nama_pengguna", nama)
      .abortSignal(sinyal()),
  );
}

export async function gantiHashKataSandi(id: string, hash: string): Promise<void> {
  periksa(
    await supabaseServer
      .from("akun")
      .update({ hash_kata_sandi: hash })
      .eq("id", id)
      .abortSignal(sinyal()),
  );
}
