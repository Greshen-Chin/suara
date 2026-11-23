// Pembantu tes: bilangan acak berbenih tetap dan kasus usulan acak (termasuk seri sengaja). Hanya dipakai
// berkas *.test.ts; tidak ada hubungannya dengan aplikasi.
import type { Bobot, Usulan, Wilayah } from "./seleksi.ts";

/** mulberry32: kecil, deterministik, cukup acak untuk tes. */
export function acakBerbenih(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KasusAcak {
  usulan: Usulan[];
  wilayah: Wilayah[];
  bobot: Bobot;
}

const JT = 1_000_000;

/**
 * Kasus acak dengan `jumlah` usulan. Biaya, dukungan, dan urgensi diambil dari himpunan kecil dan sebagian
 * usulan disalin persis (id berbeda), supaya seri skor, dukungan, dan biaya benar-benar terjadi.
 */
export function kasusAcak(benih: number, jumlah: number): KasusAcak {
  const acak = acakBerbenih(benih);
  const pilih = <T>(daftar: readonly T[]): T => daftar[Math.floor(acak() * daftar.length)];
  const banyakRw = 1 + Math.floor(acak() * 4);
  const wilayah: Wilayah[] = Array.from({ length: banyakRw }, (_, i) => ({
    rw: i + 1,
    nama: `RW ${String(i + 1).padStart(2, "0")}`,
    penduduk: pilih([400, 1000, 2000, 3000]),
    anggaranLalu: pilih([0, 50 * JT, 250 * JT]),
  }));

  const usulan: Usulan[] = [];
  for (let i = 0; i < jumlah; i++) {
    const salinan = i > 0 && acak() < 0.3 ? usulan[Math.floor(acak() * i)] : null;
    usulan.push(
      salinan
        ? { ...salinan, id: `u${i}`, title: `Usulan ${i}`, namaSingkat: `U${i}` }
        : {
            id: `u${i}`,
            title: `Usulan ${i}`,
            namaSingkat: `U${i}`,
            category: "infrastruktur",
            rw: pilih(wilayah).rw,
            estimatedBudget: pilih([10, 20, 30, 40, 55, 70, 90, 120]) * JT,
            voteCount: pilih([0, 3, 5, 8, 12, 30]),
            urgencyScore: pilih([2, 5, 7, 8, 10]),
          },
    );
  }

  const a = 5 * Math.floor(acak() * 21);
  const b = 5 * Math.floor(acak() * (21 - a / 5));
  return { usulan, wilayah, bobot: { popularitas: a, urgensi: b, pemerataan: 100 - a - b } };
}
