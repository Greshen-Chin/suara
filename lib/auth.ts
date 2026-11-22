// Data Access Layer untuk autentikasi. Semua pemeriksaan "siapa yang sedang masuk"
// lewat sini, dekat dengan data, bukan hanya di proxy.ts.
import "server-only";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  cariAkunById,
  cariAkunUntukMasuk,
  catatGagalMasuk,
  gantiHashKataSandi,
  hapusPercobaanMasuk,
  terkunciSampai,
} from "./akun";
import { hashKataSandi, perluHashUlang, verifikasiKataSandi } from "./kata-sandi";
import { bacaSesi } from "./sesi";
import type { IsiSesi, Peran } from "./sesi-token";
import { RUTE } from "./tautan";

export interface Pengguna {
  id: string;
  nama: string;
  peran: Peran;
}

/**
 * Pengguna yang sedang masuk, atau null. Token diperiksa, lalu akun dicek di database:
 * masih ada, masih aktif, dan versi sesinya belum dicabut. Satu kali per permintaan.
 */
export const ambilPengguna = cache(async (): Promise<Pengguna | null> => {
  const sesi = await bacaSesi();
  if (!sesi) return null;
  const akun = await cariAkunById(sesi.id);
  if (!akun || !akun.aktif || akun.versi_sesi !== sesi.versi) return null;
  return { id: akun.id, nama: akun.nama_pengguna, peran: akun.peran };
});

/** Arahkan ke halaman masuk bila belum masuk. */
export async function wajibMasuk(): Promise<Pengguna> {
  const pengguna = await ambilPengguna();
  if (!pengguna) redirect(RUTE.masuk);
  return pengguna;
}

/** Hanya untuk peran tertentu. Peran lain diarahkan ke halaman akun. */
export async function wajibPeran(peran: Peran): Promise<Pengguna> {
  const pengguna = await wajibMasuk();
  if (pengguna.peran !== peran) redirect(RUTE.akun);
  return pengguna;
}

// Hash palsu untuk nama pengguna yang tidak terdaftar: verifikasi tetap dijalankan,
// sehingga lama respons tidak membocorkan apakah sebuah nama terdaftar.
let hashPalsu: Promise<string> | null = null;
const ambilHashPalsu = () =>
  (hashPalsu ??= hashKataSandi(randomBytes(32).toString("base64url")));

export type HasilKredensial =
  | { status: "berhasil"; sesi: IsiSesi }
  | { status: "gagal" }
  | { status: "terkunci"; sampai: Date };

/**
 * Periksa nama pengguna dan kata sandi. Pesan ke pengguna sama untuk nama yang tidak ada,
 * kata sandi salah, dan akun nonaktif. Error database dilempar ke pemanggil.
 */
export async function periksaKredensial(
  nama: string,
  kataSandi: string,
): Promise<HasilKredensial> {
  const kunci = await terkunciSampai(nama);
  if (kunci) return { status: "terkunci", sampai: kunci };

  const akun = await cariAkunUntukMasuk(nama);
  const cocok = await verifikasiKataSandi(
    kataSandi,
    akun?.hash_kata_sandi ?? (await ambilHashPalsu()),
  );

  if (!akun || !cocok || !akun.aktif) {
    const sampai = await catatGagalMasuk(nama);
    return sampai ? { status: "terkunci", sampai } : { status: "gagal" };
  }

  await hapusPercobaanMasuk(nama);
  if (perluHashUlang(akun.hash_kata_sandi)) {
    await gantiHashKataSandi(akun.id, await hashKataSandi(kataSandi));
  }

  return {
    status: "berhasil",
    sesi: {
      id: akun.id,
      nama: akun.nama_pengguna,
      peran: akun.peran,
      versi: akun.versi_sesi,
    },
  };
}
