// Aturan kata sandi yang perlu dibaca di klien (ditampilkan SEBELUM mengetik). Murni, tanpa node:crypto:
// lib/kata-sandi.ts memakai crypto dan tidak boleh masuk bundel klien. Penegakannya tetap di server
// (periksaKataSandiBaru di lib/kata-sandi.ts); di sini hanya angka dan kalimatnya.

/** Batas panjang (karakter). Batas atas mencegah kata sandi raksasa dipakai untuk membebani server. */
export const PANJANG_MIN = 8;
export const PANJANG_MAKS = 128;

/** Aturan yang ditampilkan, urutannya sama dengan pemeriksaan di server. */
export const ATURAN_SANDI: readonly string[] = [
  `Minimal ${PANJANG_MIN} karakter, maksimal ${PANJANG_MAKS}.`,
  "Bukan kata sandi yang terlalu umum, misalnya 12345678 atau password.",
];
