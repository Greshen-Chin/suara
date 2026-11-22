// Tujuan setelah login (?lanjut=...). Hanya jalur di situs ini yang diterima, supaya
// tautan login tidak bisa dipakai untuk mengarahkan orang ke situs lain (open redirect).

const ASAL_SEMENTARA = "http://suara.invalid";

export function amankanTujuan(nilai: unknown, bawaan = "/akun"): string {
  if (typeof nilai !== "string" || nilai.length === 0 || nilai.length > 512) return bawaan;
  // Harus jalur absolut di situs ini: "/...", bukan "//host" atau "/\host".
  if (!nilai.startsWith("/") || nilai.startsWith("//") || nilai.startsWith("/\\")) return bawaan;
  // Karakter kontrol dan garis miring terbalik bisa ditafsirkan browser sebagai host lain.
  if (/[\u0000-\u001f\u007f\\]/.test(nilai)) return bawaan;

  let url: URL;
  try {
    url = new URL(nilai, ASAL_SEMENTARA);
  } catch {
    return bawaan;
  }
  if (url.origin !== ASAL_SEMENTARA) return bawaan;
  // Jangan kembali ke halaman masuk itu sendiri.
  if (url.pathname === "/masuk") return bawaan;
  return url.pathname + url.search + url.hash;
}
