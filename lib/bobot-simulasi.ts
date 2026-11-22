// Bobot pada halaman simulasi: tiga geseran 0-100, langkah 5, SELALU berjumlah 100.
//
// Sengaja berbeda dari halaman admin (yang membiarkan tiga kolom diketik bebas dan menolak simpan bila
// jumlahnya bukan 100): di simulasi setiap keadaan harus sah, jadi menggeser satu bobot membagi ulang dua
// lainnya. Pembagiannya proporsional terhadap nilai sekarang dengan metode sisa terbesar; bila keduanya nol,
// dibagi rata (yang lebih dulu menurut urutan popularitas, urgensi, pemerataan mendapat kelebihannya).
import { KOLOM_BOBOT, type KolomBobot } from "./admin-skema.ts";
import type { Bobot } from "./seleksi.ts";

export const LANGKAH_BOBOT = 5;
export const JUMLAH_BOBOT = 100;
export { KOLOM_BOBOT as KUNCI_BOBOT, type KolomBobot as KunciBobot };

export const jumlahBobot = (b: Bobot): number => b.popularitas + b.urgensi + b.pemerataan;

export const samaBobot = (a: Bobot, b: Bobot): boolean =>
  a.popularitas === b.popularitas && a.urgensi === b.urgensi && a.pemerataan === b.pemerataan;

/**
 * Geser satu bobot ke `nilai` (dibulatkan ke kelipatan 5 dan dijepit 0-100); dua lainnya dibagi ulang
 * supaya jumlahnya tetap 100. Nilai yang bukan angka tidak mengubah apa pun.
 */
export function geserBobot(bobot: Bobot, kunci: KolomBobot, nilai: number): Bobot {
  if (!Number.isFinite(nilai)) return bobot;
  const baru = Math.min(JUMLAH_BOBOT, Math.max(0, Math.round(nilai / LANGKAH_BOBOT) * LANGKAH_BOBOT));

  const [k1, k2] = KOLOM_BOBOT.filter((k) => k !== kunci);
  const a = bobot[k1];
  const b = bobot[k2];
  // Dihitung dalam satuan langkah (5), jadi hasilnya pasti kelipatan 5.
  const sisa = (JUMLAH_BOBOT - baru) / LANGKAH_BOBOT;

  let satuanA: number;
  if (a + b === 0) {
    satuanA = Math.ceil(sisa / 2);
  } else {
    const idealA = (sisa * a) / (a + b);
    const idealB = (sisa * b) / (a + b);
    satuanA = Math.floor(idealA);
    const satuanB = Math.floor(idealB);
    const lebih = sisa - satuanA - satuanB;
    // Sisa terbesar yang mendapat satuan tambahan; seri: yang lebih dulu menurut urutan kolom.
    if (lebih > 0 && idealA - satuanA >= idealB - satuanB) satuanA += lebih;
  }

  return {
    ...bobot,
    [kunci]: baru,
    [k1]: satuanA * LANGKAH_BOBOT,
    [k2]: (sisa - satuanA) * LANGKAH_BOBOT,
  };
}

export type KunciPreset = "resmi" | "dukungan" | "keselamatan" | "merata";

export interface Preset {
  kunci: KunciPreset;
  label: string;
  /** null = bobot resmi dari database. */
  bobot: Bobot | null;
}

/** Jalan pintas pengisi geseran; bukan mode tersendiri. */
export const PRESET_BOBOT: readonly Preset[] = [
  { kunci: "resmi", label: "Resmi", bobot: null },
  { kunci: "dukungan", label: "Dukungan saja", bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 } },
  { kunci: "keselamatan", label: "Keselamatan dulu", bobot: { popularitas: 10, urgensi: 80, pemerataan: 10 } },
  { kunci: "merata", label: "Merata dulu", bobot: { popularitas: 10, urgensi: 30, pemerataan: 60 } },
];

export const bobotPreset = (p: Preset, resmi: Bobot): Bobot => p.bobot ?? resmi;

/** Semua bobot kelipatan 5 yang berjumlah 100: 231 kombinasi. Sudut (100/0/0 dan sejenisnya) lebih dulu. */
export function semuaKombinasiBobot(): Bobot[] {
  const hasil: Bobot[] = [];
  for (let a = 0; a <= JUMLAH_BOBOT; a += LANGKAH_BOBOT) {
    for (let b = 0; a + b <= JUMLAH_BOBOT; b += LANGKAH_BOBOT) {
      hasil.push({ popularitas: a, urgensi: b, pemerataan: JUMLAH_BOBOT - a - b });
    }
  }
  const sudut = (x: Bobot) => Math.max(x.popularitas, x.urgensi, x.pemerataan) === JUMLAH_BOBOT;
  return [...hasil.filter(sudut), ...hasil.filter((x) => !sudut(x))];
}

// ---------------------------------------------------------------------------
// Penulisan di URL: "20-60-20"
// ---------------------------------------------------------------------------

export const tulisBobot = (b: Bobot): string => `${b.popularitas}-${b.urgensi}-${b.pemerataan}`;

/** null bila bukan tiga bilangan bulat 0-100 yang berjumlah tepat 100. */
export function bacaBobotUrl(teks: string): Bobot | null {
  const m = /^(\d{1,3})-(\d{1,3})-(\d{1,3})$/.exec(teks);
  if (!m) return null;
  const [popularitas, urgensi, pemerataan] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const bobot = { popularitas, urgensi, pemerataan };
  return jumlahBobot(bobot) === JUMLAH_BOBOT ? bobot : null;
}
