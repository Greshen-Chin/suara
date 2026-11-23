// Kata sandi awal untuk akun warga yang dibuat admin. Dibuat di server, ditampilkan SEKALI, lalu
// hanya hash-nya yang tersimpan. Dirancang untuk dibacakan lewat telepon atau disalin dari kertas:
// tiga kelompok empat karakter, tanpa karakter yang mudah tertukar (l, 1, i, o, 0).
//
// Sengaja tanpa "server-only" supaya bisa diuji; memakai node:crypto, jadi tidak untuk klien.
import { randomInt } from "node:crypto";
import { periksaKataSandiBaru } from "./kata-sandi.ts";

/** Huruf kecil tanpa i, l, o. */
export const HURUF_SANDI = "abcdefghjkmnpqrstuvwxyz";
/** Angka tanpa 0 dan 1. */
export const ANGKA_SANDI = "23456789";
const SEMUA = HURUF_SANDI + ANGKA_SANDI;

export const KELOMPOK = 3;
export const PANJANG_KELOMPOK = 4;

type Acak = (min: number, maks: number) => number;

/**
 * Contoh: "k7mq-w3pa-hx8t". 12 karakter dari 31 simbol, sekitar 59 bit entropi. Selalu memuat
 * paling sedikit satu huruf dan satu angka, dan lolos periksaKataSandiBaru (mis. tidak memuat nama
 * pengguna). `acak` bisa diganti untuk pengujian; bawaannya randomInt dari node:crypto.
 */
export function buatSandiAcak(namaPengguna = "", acak: Acak = randomInt): string {
  for (let percobaan = 0; percobaan < 100; percobaan++) {
    const kelompok: string[] = [];
    for (let i = 0; i < KELOMPOK; i++) {
      let bagian = "";
      for (let j = 0; j < PANJANG_KELOMPOK; j++) bagian += SEMUA[acak(0, SEMUA.length)];
      kelompok.push(bagian);
    }
    const sandi = kelompok.join("-");
    const bahan = sandi.replaceAll("-", "");
    const adaAngka = [...bahan].some((c) => ANGKA_SANDI.includes(c));
    const adaHuruf = [...bahan].some((c) => HURUF_SANDI.includes(c));
    // Sandi acak tetap dihindarkan memuat nama pengguna (kebiasaan baik, bukan lagi aturan sandi buatan sendiri).
    const lolos =
      (namaPengguna === "" || !sandi.toLowerCase().includes(namaPengguna.toLowerCase())) &&
      periksaKataSandiBaru(sandi, namaPengguna) === null;
    if (adaAngka && adaHuruf && lolos) return sandi;
  }
  // Sampai di sini hanya bila `acak` rusak: 100 undian beruntun gagal tidak terjadi pada randomInt.
  throw new Error("Tidak bisa membuat kata sandi acak yang memenuhi aturan.");
}
