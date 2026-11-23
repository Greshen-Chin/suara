// Uji ketahanan: seberapa bergantung hasil pada bobot yang dipilih?
//
// Untuk pagu tertentu, hitung kombinasi terbiayai pada SEMUA 231 kombinasi bobot kelipatan 5 yang berjumlah
// 100, lalu hitung berapa kombinasi bobot yang menghasilkan tiap pilihan. Bila semuanya menghasilkan pilihan
// yang sama, bobot tidak menentukan apa-apa pada pagu itu.
//
// Ini BUKAN bukti bahwa keputusannya benar. Hanya jawaban atas pertanyaan sempit: "kalau bobotnya diganti,
// apakah yang terbiayai ikut berganti?"
//
// Kecepatan: memanggil pilihOptimal 231 kali memakan ±1 detik untuk 16 usulan. Di sini tiap kombinasi dicari
// dengan penjumlahan bertahap atas himpunan bagian (satu penjumlahan per kombinasi, bukan satu per usulan),
// dengan aturan seri yang SAMA dengan pilihOptimal (nilai lebih besar, lalu biaya lebih kecil, lalu mask
// yang lebih dulu menurut urutan urutanOptimal). lib/ketahanan.test.ts membuktikan kesamaannya dengan
// memanggil pilihOptimal langsung pada kasus acak berbenih tetap, termasuk seri.
//
// Hitungan berupa generator: pemanggil boleh menyerahkan giliran ke peramban di antara kombinasi (lihat
// components/simulasi/useKetahanan.ts) dan membatalkannya cukup dengan berhenti memanggil next().
import { rupiah } from "./format.ts";
import { semuaKombinasiBobot, tulisBobot } from "./bobot-simulasi.ts";
import { bangunTangga, type Tangga } from "./peta-pagu.ts";
import type { UsulanHitung } from "./pratinjau.ts";
import { BATAS_USULAN_OPTIMAL, urutanOptimal, type Bobot, type Usulan, type Wilayah } from "./seleksi.ts";

export interface PilihanKetahanan {
  /** Id usulan yang terbiayai, menurut urutan usulan pada masukan. */
  ids: readonly string[];
  /** Berapa kombinasi bobot yang menghasilkan pilihan ini. */
  jumlah: number;
}

export interface HasilKetahanan {
  pagu: number;
  /** Jumlah kombinasi bobot yang diuji (231). */
  total: number;
  /** Menurun menurut jumlah; seri: yang lebih dulu ditemui. */
  pilihan: readonly PilihanKetahanan[];
  /** Id usulan -> berapa kombinasi bobot yang membiayainya. */
  perUsulan: Readonly<Record<string, number>>;
}

export const bergantungPadaBobot = (h: HasilKetahanan): boolean => h.pilihan.length > 1;

interface Penghitung {
  /** Kunci pilihan (bitmask atas urutan usulan pada masukan) untuk satu bobot dan pagu. */
  kunci(bobot: Bobot, pagu: number): number;
  idsDari(kunci: number): string[];
}

function siapkan(usulan: readonly Usulan[], wilayah: readonly Wilayah[]): Penghitung {
  const n = usulan.length;
  // Sebelum mengalokasikan 2^n elemen: lebih dari batas berarti galat yang sama dengan pilihOptimal.
  if (n > BATAS_USULAN_OPTIMAL) {
    throw new RangeError(`Terlalu banyak usulan (${n}); batas pencarian kombinasi ${BATAS_USULAN_OPTIMAL}.`);
  }
  const total = 1 << n;
  const biaya = new Float64Array(total);
  const nilai = new Float64Array(total);
  const asli = new Map(usulan.map((u, i) => [u.id, i]));

  return {
    kunci(bobot, pagu) {
      const urut = urutanOptimal(usulan, wilayah, bobot);
      const m = urut.length;
      const banyak = 1 << m;
      let terbaikMask = 0;
      let terbaikNilai = 0;
      let terbaikBiaya = 0;
      // mask 0 (kosong) sudah menjadi pilihan awal: nilai 0, biaya 0.
      for (let mask = 1; mask < banyak; mask++) {
        const rendah = mask & -mask;
        const i = 31 - Math.clz32(rendah);
        const sisa = mask ^ rendah;
        const b = biaya[sisa] + urut[i].biaya;
        const v = nilai[sisa] + urut[i].nilai;
        biaya[mask] = b;
        nilai[mask] = v;
        if (b <= pagu && (v > terbaikNilai || (v === terbaikNilai && b < terbaikBiaya))) {
          terbaikMask = mask;
          terbaikNilai = v;
          terbaikBiaya = b;
        }
      }
      // Peta dari urutan peringkat ke urutan masukan.
      let kunci = 0;
      for (let bit = 0; bit < m; bit++) {
        if ((terbaikMask >> bit) & 1) kunci |= 1 << (asli.get(urut[bit].usulan.id) ?? 0);
      }
      return kunci;
    },
    idsDari(kunci) {
      return usulan.filter((_, i) => (kunci >> i) & 1).map((u) => u.id);
    },
  };
}

/**
 * Hitung bertahap. Setiap next() menyelesaikan satu kombinasi bobot dan mengembalikan berapa yang sudah
 * selesai; hasil akhir ada di `value` saat `done`.
 */
export function* ketahananBertahap(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  pagu: number,
  daftarBobot: readonly Bobot[] = semuaKombinasiBobot(),
): Generator<number, HasilKetahanan, void> {
  const hitung = siapkan(usulan, wilayah);
  const jumlahPer = new Map<number, number>();
  for (let i = 0; i < daftarBobot.length; i++) {
    const k = hitung.kunci(daftarBobot[i], pagu);
    jumlahPer.set(k, (jumlahPer.get(k) ?? 0) + 1);
    yield i + 1;
  }

  const pilihan = [...jumlahPer]
    .map(([kunci, jumlah]) => ({ ids: hitung.idsDari(kunci), jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah); // sort stabil: seri tetap menurut urutan ditemui
  const perUsulan: Record<string, number> = Object.fromEntries(usulan.map((u) => [u.id, 0]));
  for (const p of pilihan) for (const id of p.ids) perUsulan[id] += p.jumlah;
  return { pagu, total: daftarBobot.length, pilihan, perUsulan };
}

/** Versi sekali jalan (tes, dan tempat yang tidak perlu menyerahkan giliran). */
export function hitungKetahanan(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  pagu: number,
  daftarBobot?: readonly Bobot[],
): HasilKetahanan {
  const g = ketahananBertahap(usulan, wilayah, pagu, daftarBobot);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

// ---------------------------------------------------------------------------
// Ajakan: pagu terdekat yang hasilnya bergantung pada bobot
// ---------------------------------------------------------------------------

export interface OpsiCari {
  /** Rp 5 juta. */
  langkah: number;
  min: number;
  maks: number;
  /** Berapa calon pagu yang paling banyak diperiksa. */
  batasCalon?: number;
}

/** Calon pagu: titik kisi di kedua sisi tiap titik tangga (di situ pilihan berganti), terdekat lebih dulu. */
export function calonPagu(tangga: Tangga, pagu: number, { langkah, min, maks, batasCalon = 40 }: OpsiCari): number[] {
  const calon = new Set<number>();
  for (const t of tangga.titik) {
    if (t.pagu <= 0) continue;
    const atas = Math.ceil(t.pagu / langkah) * langkah;
    for (const g of [atas - langkah, atas]) if (g >= min && g <= maks && g !== pagu) calon.add(g);
  }
  return [...calon]
    .sort((a, b) => Math.abs(a - pagu) - Math.abs(b - pagu) || b - a)
    .slice(0, batasCalon);
}

/**
 * Cari pagu terdekat (di antara calon dari tangga) yang hasilnya bergantung pada bobot. Diperiksa penuh:
 * sebuah calon dinyatakan bergantung hanya bila dua kombinasi bobot benar-benar menghasilkan pilihan
 * berbeda. Mengembalikan null bila tidak ada. Bertahap seperti ketahananBertahap.
 */
export function* cariPaguBergantung(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  tangga: Tangga,
  pagu: number,
  opsi: OpsiCari,
): Generator<number, number | null, void> {
  const hitung = siapkan(usulan, wilayah);
  const daftar = semuaKombinasiBobot();
  let selesai = 0;
  for (const calon of calonPagu(tangga, pagu, opsi)) {
    let pertama: number | null = null;
    for (const bobot of daftar) {
      const k = hitung.kunci(bobot, calon);
      selesai++;
      yield selesai;
      if (pertama === null) pertama = k;
      else if (k !== pertama) return calon;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Keadaan awal yang dihitung di server
// ---------------------------------------------------------------------------

/** Semua yang memengaruhi hasil uji ketahanan: pagu dan usulan beserta urgensinya (bukan bobot). */
export function kunciKetahanan(pagu: number, usulan: readonly Pick<UsulanHitung, "id" | "urgencyScore">[]): string {
  return `${pagu}|${usulan.map((u) => `${u.id}:${u.urgencyScore}`).join(",")}`;
}

/** Hasil untuk keadaan awal (resmi). Dihitung di server dan dikirim ke layar, supaya HTML pertama sudah memuatnya. */
export interface AwalKetahanan {
  /** Kunci masukan yang menghasilkan `ketahanan` (lihat kunciKetahanan). */
  kunci: string;
  ketahanan: HasilKetahanan;
  /** Pagu yang ditawarkan bila bobot tidak berpengaruh pada pagu awal; null bila tidak ada atau tidak perlu. */
  ajakan: number | null;
  kunciAjakan: string;
}

export function hitungAwalKetahanan(
  usulan: readonly UsulanHitung[],
  wilayah: readonly Wilayah[],
  pagu: number,
  bobot: Bobot,
  rentang: OpsiCari,
): AwalKetahanan {
  const ketahanan = hitungKetahanan(usulan, wilayah, pagu);
  const kunci = kunciKetahanan(pagu, usulan);
  let ajakan: number | null = null;
  if (!bergantungPadaBobot(ketahanan)) {
    const g = cariPaguBergantung(usulan, wilayah, bangunTangga(usulan, wilayah, bobot), pagu, rentang);
    for (;;) {
      const r = g.next();
      if (r.done) {
        ajakan = r.value;
        break;
      }
    }
  }
  return { kunci, ketahanan, ajakan, kunciAjakan: `${kunci}|${tulisBobot(bobot)}` };
}

// ---------------------------------------------------------------------------
// Kalimat
// ---------------------------------------------------------------------------

/** "A", "A dan B", "A, B dan C". */
export function gabungNama(nama: readonly string[]): string {
  if (nama.length <= 1) return nama.join("");
  return `${nama.slice(0, -1).join(", ")} dan ${nama[nama.length - 1]}`;
}

const BATAS_PILIHAN_DISEBUT = 3;

/**
 * Kalimat utama uji ketahanan. Hanya BEDANYA yang disebut: usulan yang terbiayai di semua pilihan tidak
 * ikut ditulis, supaya kalimatnya tetap pendek.
 *   sama:     "Pada pagu Rp 300 juta, hasilnya sama untuk 231 dari 231 kombinasi bobot. Rekomendasi ini tidak
 *              bergantung pada bobot yang dipilih."
 *   berbeda:  "Pada pagu Rp 450 juta, bobot menentukan. 133 dari 231 kombinasi membiayai Balai warga dan
 *              Jalan SDN 03; 98 lainnya membiayai Talud."
 */
export function kalimatKetahanan(h: HasilKetahanan, nama: (id: string) => string): string {
  const awal = `Pada pagu ${rupiah(h.pagu)}`;
  if (h.pilihan.length <= 1) {
    return `${awal}, hasilnya sama untuk ${h.total} dari ${h.total} kombinasi bobot. Rekomendasi ini tidak bergantung pada bobot yang dipilih.`;
  }

  const bersama = h.pilihan.map((p) => new Set(p.ids)).reduce((a, b) => new Set([...a].filter((id) => b.has(id))));
  const bagian = h.pilihan.slice(0, BATAS_PILIHAN_DISEBUT).map((p, i) => {
    // Menurut abjad: kalimatnya tidak boleh bergantung pada urutan usulan di database.
    const beda = p.ids
      .filter((id) => !bersama.has(id))
      .map(nama)
      .sort((a, b) => a.localeCompare(b, "id"));
    const isi = beda.length > 0 ? `membiayai ${gabungNama(beda)}` : "hanya membiayai yang sama pada semua pilihan";
    return i === 0 ? `${p.jumlah} dari ${h.total} kombinasi ${isi}` : `${p.jumlah} lainnya ${isi}`;
  });
  const sisa = h.pilihan.slice(BATAS_PILIHAN_DISEBUT);
  const lain =
    sisa.length > 0
      ? ` ${sisa.length} pilihan lain dihasilkan oleh ${sisa.reduce((n, p) => n + p.jumlah, 0)} kombinasi sisanya.`
      : "";
  return `${awal}, bobot menentukan. ${bagian.join("; ")}.${lain}`;
}
