// Format angka dan rupiah untuk seluruh aplikasi.
// Ringkas: "Rp 85 juta". Rinci: "Rp 85.000.000". Spasi antara "Rp" dan angka
// memakai spasi tak terputus agar tidak pernah terpisah di akhir baris.

const NBSP = " ";

const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const bulat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 85000000 -> "Rp 85 juta"; 1500000000 -> "Rp 1,5 miliar"; 0 -> "Rp 0". */
export function rupiah(n: number): string {
  if (n === 0) return `Rp${NBSP}0`;
  const mutlak = Math.abs(n);
  if (mutlak >= 1_000_000_000)
    return `Rp${NBSP}${angka.format(n / 1_000_000_000)}${NBSP}miliar`;
  if (mutlak >= 1_000_000)
    return `Rp${NBSP}${angka.format(n / 1_000_000)}${NBSP}juta`;
  return rupiahRinci(n);
}

/** 85000000 -> "Rp 85.000.000". */
export function rupiahRinci(n: number): string {
  return `Rp${NBSP}${bulat.format(n)}`;
}

/** Angka biasa dengan pemisah ribuan: 3000 -> "3.000". */
export function ribuan(n: number): string {
  return bulat.format(n);
}

/** Satu desimal bila perlu: 67.5 -> "67,5"; 35 -> "35". */
export function desimal(n: number): string {
  return angka.format(n);
}
