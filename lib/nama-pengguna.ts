// Nama pengguna untuk akun warga baru: pola yang sama dengan database (akun.nama_pengguna),
// saran otomatis dari nama warga, dan alternatif bila sudah dipakai.

/** Sama dengan check pada akun.nama_pengguna dan POLA_NAMA di app/masuk/aksi.ts. */
export const POLA_NAMA_PENGGUNA = /^[a-z0-9._-]{3,32}$/;
export const PANJANG_NAMA = { min: 3, maks: 32 } as const;

/** null bila boleh dipakai, atau alasan penolakan yang bisa ditindaklanjuti. */
export function periksaNamaPengguna(nama: string): string | null {
  if (nama === "") return "Isi nama pengguna.";
  if (nama.length < PANJANG_NAMA.min) return `Nama pengguna minimal ${PANJANG_NAMA.min} karakter.`;
  if (nama.length > PANJANG_NAMA.maks) return `Nama pengguna maksimal ${PANJANG_NAMA.maks} karakter.`;
  if (!POLA_NAMA_PENGGUNA.test(nama)) {
    return "Pakai huruf kecil, angka, titik, garis bawah, atau tanda hubung. Tanpa spasi.";
  }
  return null;
}

/** "Agus Santoso" -> "agus.santoso". Tanpa tanda baca, aksen dibuang, maksimal 32 karakter. */
export function saranNamaPengguna(namaLengkap: string): string {
  const kata = namaLengkap
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let saran = kata.join(".");
  if (saran.length > PANJANG_NAMA.maks) saran = saran.slice(0, PANJANG_NAMA.maks).replace(/[._-]+$/, "");
  return saran.length >= PANJANG_NAMA.min ? saran : "warga";
}

/** Alternatif bila `dasar` sudah dipakai: dasar2, dasar3, ... tetap muat dalam 32 karakter. */
export function alternatifNama(dasar: string, urutan: number): string {
  const akhiran = String(urutan);
  return dasar.slice(0, PANJANG_NAMA.maks - akhiran.length).replace(/[._-]+$/, "") + akhiran;
}
