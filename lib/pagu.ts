// Perhitungan murni untuk Garis Pagu: lebar tiap blok sebanding dengan biayanya.
// Tanpa dependensi, supaya mudah diuji (lib/pagu.test.ts).

export interface ItemBiaya {
  id: string;
  biaya: number; // rupiah
}

export interface BlokPagu {
  id: string;
  /** Posisi kiri (atau atas pada tampilan vertikal), persen dari pagu. */
  mulai: number;
  /** Lebar (atau tinggi), persen dari pagu. */
  lebar: number;
}

export interface TataPagu {
  blok: BlokPagu[];
  /** Ruang kosong di ujung. lebar = 0 bila pagu terpakai penuh. */
  sisa: { mulai: number; lebar: number; rupiah: number };
}

export interface TitikSkala {
  rupiah: number;
  /** Persen dari pagu. */
  posisi: number;
}

/**
 * Susun blok berurutan dari kiri. Total lebar blok + sisa selalu tepat 100.
 * Melempar RangeError bila pagu tidak positif atau total biaya melebihi pagu.
 */
export function hitungTataPagu(
  item: readonly ItemBiaya[],
  pagu: number,
): TataPagu {
  if (!(pagu > 0)) throw new RangeError("Pagu harus lebih besar dari nol.");
  const total = item.reduce((n, i) => n + i.biaya, 0);
  if (total > pagu) {
    throw new RangeError("Total biaya melebihi pagu.");
  }

  let terpakai = 0;
  const blok = item.map(({ id, biaya }) => {
    const mulai = (terpakai / pagu) * 100;
    terpakai += biaya;
    return { id, mulai, lebar: (biaya / pagu) * 100 };
  });

  // Sisa dihitung dari selisih 100 supaya jumlah akhirnya tepat 100.
  const lebarBlok = blok.reduce((n, b) => n + b.lebar, 0);
  return {
    blok,
    sisa: { mulai: lebarBlok, lebar: 100 - lebarBlok, rupiah: pagu - total },
  };
}

/** Titik skala dari Rp 0 sampai pagu, dibagi rata menjadi `segmen` bagian. */
export function titikSkala(pagu: number, segmen = 3): TitikSkala[] {
  if (!(pagu > 0)) throw new RangeError("Pagu harus lebih besar dari nol.");
  return Array.from({ length: segmen + 1 }, (_, i) => ({
    rupiah: (pagu * i) / segmen,
    posisi: (i / segmen) * 100,
  }));
}
