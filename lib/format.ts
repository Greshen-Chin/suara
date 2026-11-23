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

/**
 * Rentang rupiah dalam satu satuan: (395_000_000, 460_000_000) -> "Rp 395–460 juta".
 * Beda satuan (juta dan miliar) ditulis lengkap: "Rp 950 juta sampai Rp 1,2 miliar".
 */
export function rentangRupiah(dari: number, sampai: number): string {
  const a = rupiah(dari).split(NBSP);
  const b = rupiah(sampai).split(NBSP);
  if (a.length === 3 && b.length === 3 && a[2] === b[2]) {
    return `Rp${NBSP}${a[1]}–${b[1]}${NBSP}${a[2]}`;
  }
  return `${rupiah(dari)} sampai ${rupiah(sampai)}`;
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

/** Persen `nilai` terhadap `maks` untuk lebar batang. 0 bila `maks` nol atau tidak sah (tanpa NaN% atau Infinity%), dibatasi 0 sampai 100. */
export function persen(nilai: number, maks: number): number {
  if (!(maks > 0) || !Number.isFinite(nilai)) return 0;
  return Math.min(100, Math.max(0, (nilai / maks) * 100));
}
