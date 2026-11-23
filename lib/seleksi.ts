// Versi TypeScript dari fungsi SQL skor_usulan / greedy_pilih / pilih_optimal
// (supabase/migrations/0002_wilayah_dan_skor_per_kapita.sql).
//
// Dipakai untuk (1) data cadangan bila database tidak terjangkau dan (2) menghitung
// ulang seketika di layar simulasi. Aturannya harus tetap sama dengan versi SQL;
// lib/seleksi.test.ts memeriksa hasilnya terhadap data demo.

export interface Usulan {
  id: string;
  title: string;
  namaSingkat: string;
  category: string;
  rw: number;
  estimatedBudget: number; // rupiah
  voteCount: number;
  /** Skala 1-10. */
  urgencyScore: number;
}

export interface Wilayah {
  rw: number;
  nama: string;
  penduduk: number;
  anggaranLalu: number; // rupiah
}

export interface Bobot {
  popularitas: number;
  urgensi: number;
  pemerataan: number;
}

export type ModeSeleksi = "suara" | "skor";

export type StatusUsulan = "terpilih" | "ditunda" | "tidak-terpilih";

export interface HasilPilih extends Usulan {
  peringkat: number;
  /** Mode 'suara': jumlah suara. Mode 'skor': skor gabungan skala 0-10. */
  skor: number;
  selected: boolean;
  totalBerjalan: number;
}

/** Batas jumlah usulan untuk pencarian kombinasi terbaik (sama dengan versi SQL). */
export const BATAS_USULAN_OPTIMAL = 16;

const PRESISI = 10_000;
const bulatkan = (n: number): number => Math.round(n * PRESISI) / PRESISI;

interface Bernilai {
  usulan: Usulan;
  urutan: number;
  skor: number;
}

/** Skor gabungan 0-10 tiap usulan. Usulan tanpa wilayah dilewati, seperti inner join di SQL. */
function nilaiGabungan(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  bobot: Bobot,
): Bernilai[] {
  const perRw = new Map(wilayah.map((w) => [w.rw, w]));
  const dinilai = usulan.flatMap((u, urutan) => {
    const w = perRw.get(u.rw);
    return w ? [{ u, urutan, w }] : [];
  });

  const suaraPer1000 = dinilai.map(({ u, w }) => (u.voteCount * 1000) / w.penduduk);
  const perKapita = dinilai.map(({ w }) => w.anggaranLalu / w.penduduk);
  const maksSuara = Math.max(0, ...suaraPer1000);
  const maksKapita = Math.max(0, ...perKapita);
  const jumlahBobot = bobot.popularitas + bobot.urgensi + bobot.pemerataan;

  return dinilai.map(({ u, urutan }, i) => {
    const popularitas = maksSuara === 0 ? 0 : (10 * suaraPer1000[i]) / maksSuara;
    const pemerataan =
      maksKapita === 0 ? 10 : 10 * (1 - perKapita[i] / maksKapita);
    const skor =
      jumlahBobot === 0
        ? 0
        : (bobot.popularitas * popularitas +
            bobot.urgensi * u.urgencyScore +
            bobot.pemerataan * pemerataan) /
          jumlahBobot;
    return { usulan: u, urutan, skor: bulatkan(skor) };
  });
}

/** Urutan tetap: skor, lalu suara terbanyak, lalu urutan masuk. */
function urutkan(a: Bernilai, b: Bernilai): number {
  return (
    b.skor - a.skor ||
    b.usulan.voteCount - a.usulan.voteCount ||
    a.urutan - b.urutan
  );
}

/**
 * Urutkan menurut kunci (suara atau skor), lalu ambil satu per satu selama masih
 * muat dalam pagu. Usulan yang tidak muat dilewati, bukan menghentikan proses.
 */
export function greedyPilih(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  pagu: number,
  mode: ModeSeleksi,
  bobot: Bobot,
): HasilPilih[] {
  const bernilai = nilaiGabungan(usulan, wilayah, bobot).map((b) =>
    mode === "suara" ? { ...b, skor: b.usulan.voteCount } : b,
  );
  bernilai.sort(urutkan);

  let total = 0;
  return bernilai.map(({ usulan: u, skor }, i) => {
    const selected = total + u.estimatedBudget <= pagu;
    if (selected) total += u.estimatedBudget;
    return { ...u, peringkat: i + 1, skor, selected, totalBerjalan: total };
  });
}

/** Satu usulan pada urutan pencarian kombinasi: bit ke-i sebuah kombinasi menunjuk usulan ke-i. */
export interface UsulanBernilai {
  usulan: Usulan;
  /** Skor gabungan 0-10, dibulatkan 4 desimal. */
  skor: number;
  biaya: number;
  /** Skor x 10.000, bilangan bulat, supaya perbandingan seri tepat. */
  nilai: number;
}

/**
 * Urutan usulan yang dipakai pilihOptimal untuk menomori kombinasi (skor, lalu suara terbanyak,
 * lalu urutan masuk), lengkap dengan biaya dan nilai bulatnya. Dipakai bersama oleh peta pagu dan uji
 * ketahanan (lib/peta-pagu.ts, lib/ketahanan.ts) supaya aturan serinya tidak bisa menyimpang dari
 * pilihOptimal: kombinasi yang ditemui lebih dulu menurut urutan ini menang.
 * Melempar RangeError bila lebih dari BATAS_USULAN_OPTIMAL.
 */
export function urutanOptimal(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  bobot: Bobot,
): UsulanBernilai[] {
  const urut = nilaiGabungan(usulan, wilayah, bobot).sort(urutkan);
  if (urut.length > BATAS_USULAN_OPTIMAL) {
    throw new RangeError(
      `Terlalu banyak usulan (${urut.length}); batas pencarian kombinasi ${BATAS_USULAN_OPTIMAL}.`,
    );
  }
  return urut.map((b) => ({
    usulan: b.usulan,
    skor: b.skor,
    biaya: b.usulan.estimatedBudget,
    nilai: Math.round(b.skor * PRESISI),
  }));
}

/**
 * Cari kombinasi usulan dengan jumlah skor tertinggi yang muat dalam pagu.
 * Semua kombinasi dicoba. Skor sama: pilih total biaya yang lebih kecil.
 */
export function pilihOptimal(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  pagu: number,
  bobot: Bobot,
): HasilPilih[] {
  const urut = urutanOptimal(usulan, wilayah, bobot);
  const n = urut.length;

  const biaya = urut.map((b) => b.biaya);
  const nilai = urut.map((b) => b.nilai);

  let terbaikMask = 0;
  let terbaikNilai = -1;
  let terbaikBiaya = 0;
  for (let mask = 0; mask < 1 << n; mask++) {
    let jumlahBiaya = 0;
    let jumlahNilai = 0;
    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) {
        jumlahBiaya += biaya[i];
        jumlahNilai += nilai[i];
      }
    }
    if (
      jumlahBiaya <= pagu &&
      (jumlahNilai > terbaikNilai ||
        (jumlahNilai === terbaikNilai && jumlahBiaya < terbaikBiaya))
    ) {
      terbaikMask = mask;
      terbaikNilai = jumlahNilai;
      terbaikBiaya = jumlahBiaya;
    }
  }

  let total = 0;
  return urut.map(({ usulan: u, skor }, i) => {
    const selected = ((terbaikMask >> i) & 1) === 1;
    if (selected) total += u.estimatedBudget;
    return { ...u, peringkat: i + 1, skor, selected, totalBerjalan: total };
  });
}

/**
 * Status tampilan tiap baris hasil.
 *  - terpilih       : masuk pilihan.
 *  - ditunda        : tidak masuk, padahal skornya setidaknya setinggi usulan terpilih
 *                     termurah. Layak, tetapi tidak muat bersama kombinasi terbaik.
 *  - tidak-terpilih : selain itu. Pada mode 'suara' semua yang tidak masuk berstatus ini.
 */
export function statusUsulan<T extends { selected: boolean; skor: number }>(
  hasil: readonly T[],
  mode: ModeSeleksi,
): (T & { status: StatusUsulan })[] {
  const skorTerendahTerpilih = Math.min(
    ...hasil.filter((h) => h.selected).map((h) => h.skor),
  );
  return hasil.map((h) => {
    let status: StatusUsulan = "tidak-terpilih";
    if (h.selected) status = "terpilih";
    else if (mode === "skor" && h.skor >= skorTerendahTerpilih) status = "ditunda";
    return { ...h, status };
  });
}
