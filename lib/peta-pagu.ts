// Peta Pagu: untuk SEMUA usulan sekaligus, pada rentang pagu mana tiap usulan terbiayai.
//
// Kuncinya: skor tiap usulan tidak bergantung pada pagu. Jadi cukup sekali menghitung "tangga": daftar titik pagu
// tempat pilihan terbaik berubah, dan kombinasi yang berlaku sejak titik itu. Pilihan pada pagu P adalah titik
// terakhir dengan pagu <= P (pencarian biner), sehingga menggeser pagu tidak perlu menghitung ulang apa pun.
//
// Tangga dibangun dengan batas Pareto: tambahkan usulan satu per satu (menurut urutan pilihOptimal), pada tiap
// langkah gabungkan daftar titik yang ada dengan daftar yang sama ditambah usulan itu, lalu buang titik yang kalah
// (biaya tidak lebih kecil dan nilai tidak lebih besar). Subset yang kalah tidak mungkin menjadi pilihan terbaik di
// pagu mana pun, dan tidak mungkin pula melahirkan subset yang menang bila ditambah usulan lain, jadi hasilnya sama
// dengan menyisir semua 65.536 kombinasi, tetapi daftarnya jauh lebih pendek.
//
// Aturan serinya SAMA dengan pilihOptimal (lib/seleksi.ts): nilai lebih besar menang, lalu biaya lebih kecil, lalu
// kombinasi dengan mask lebih kecil (yang ditemui lebih dulu). Urutan usulan dan nilainya diambil dari
// urutanOptimal, fungsi yang sama dengan yang dipakai pilihOptimal, jadi tidak ada salinan rumus.
// lib/peta-pagu.test.ts membuktikan kesamaannya di setiap titik tangga, tepat sebelum dan sesudahnya.
import { rentangRupiah, rupiah } from "./format.ts";
import { urutanOptimal, type Bobot, type HasilPilih, type Usulan, type UsulanBernilai, type Wilayah } from "./seleksi.ts";

export interface TitikTangga {
  /** Pagu terkecil (rupiah) tempat kombinasi ini menjadi pilihan terbaik. */
  pagu: number;
  /** Kombinasi pilihan: bit ke-i menunjuk usulan ke-i pada `Tangga.urutan`. */
  mask: number;
  /** Jumlah skor (x 10.000). */
  nilai: number;
}

export interface Tangga {
  /** Usulan menurut urutan pilihOptimal (peringkat 1 = bit 0). */
  urutan: readonly UsulanBernilai[];
  /** Menaik menurut pagu. Titik pertama selalu pagu 0 dengan kombinasi kosong. */
  titik: readonly TitikTangga[];
}

export function bangunTangga(
  usulan: readonly Usulan[],
  wilayah: readonly Wilayah[],
  bobot: Bobot,
): Tangga {
  const urutan = urutanOptimal(usulan, wilayah, bobot);

  // Batas Pareto sejauh ini: biaya menaik ketat dan nilai menaik ketat. Awalnya hanya kombinasi kosong.
  let biaya = [0];
  let nilai = [0];
  let mask = [0];

  for (let i = 0; i < urutan.length; i++) {
    const tambahBiaya = urutan[i].biaya;
    const tambahNilai = urutan[i].nilai;
    const bit = 1 << i;
    const biayaBaru: number[] = [];
    const nilaiBaru: number[] = [];
    const maskBaru: number[] = [];

    // Gabungkan dua daftar terurut: A (tanpa usulan ini) dan B (dengan usulan ini). Urutan penggabungan:
    // biaya kecil dulu; biaya sama: nilai besar dulu; keduanya sama: mask kecil dulu. Hanya yang nilainya LEBIH
    // BESAR dari semua yang sebelumnya yang lolos, jadi seri dimenangkan oleh biaya lebih kecil, lalu mask lebih kecil.
    let a = 0;
    let b = 0;
    let terbaik = -1;
    while (a < biaya.length || b < biaya.length) {
      let dariA: boolean;
      if (a >= biaya.length) dariA = false;
      else if (b >= biaya.length) dariA = true;
      else {
        const biayaA = biaya[a];
        const biayaB = biaya[b] + tambahBiaya;
        if (biayaA !== biayaB) dariA = biayaA < biayaB;
        else {
          const nilaiA = nilai[a];
          const nilaiB = nilai[b] + tambahNilai;
          dariA = nilaiA !== nilaiB ? nilaiA > nilaiB : mask[a] < (mask[b] | bit);
        }
      }
      const c = dariA ? biaya[a] : biaya[b] + tambahBiaya;
      const v = dariA ? nilai[a] : nilai[b] + tambahNilai;
      const m = dariA ? mask[a] : mask[b] | bit;
      if (dariA) a++;
      else b++;
      if (v > terbaik) {
        terbaik = v;
        biayaBaru.push(c);
        nilaiBaru.push(v);
        maskBaru.push(m);
      }
    }
    biaya = biayaBaru;
    nilai = nilaiBaru;
    mask = maskBaru;
  }

  const titik: TitikTangga[] = biaya.map((pagu, k) => ({ pagu, mask: mask[k], nilai: nilai[k] }));
  return { urutan, titik };
}

/** Indeks titik tangga yang berlaku pada pagu ini. -1 bila pagu negatif (tidak ada yang muat). */
function indeksTitik(tangga: Tangga, pagu: number): number {
  let lo = 0;
  let hi = tangga.titik.length - 1;
  let hasil = -1;
  while (lo <= hi) {
    const tengah = (lo + hi) >> 1;
    if (tangga.titik[tengah].pagu <= pagu) {
      hasil = tengah;
      lo = tengah + 1;
    } else {
      hi = tengah - 1;
    }
  }
  return hasil;
}

/** Id usulan yang terbiayai pada pagu ini; sama dengan yang dipilih pilihOptimal. */
export function terpilihPada(tangga: Tangga, pagu: number): Set<string> {
  const i = indeksTitik(tangga, pagu);
  const ids = new Set<string>();
  if (i < 0) return ids;
  const { mask } = tangga.titik[i];
  tangga.urutan.forEach((b, bit) => {
    if ((mask >> bit) & 1) ids.add(b.usulan.id);
  });
  return ids;
}

/**
 * Hasil lengkap pada pagu ini, dengan bentuk yang sama dengan pilihOptimal (peringkat, skor, terpilih, total
 * berjalan), tetapi hanya satu pencarian biner. Menggeser pagu tidak perlu menjalankan pilihOptimal lagi.
 */
export function hasilPada(tangga: Tangga, pagu: number): HasilPilih[] {
  const i = indeksTitik(tangga, pagu);
  const mask = i < 0 ? 0 : tangga.titik[i].mask;
  let total = 0;
  return tangga.urutan.map((b, bit) => {
    const selected = ((mask >> bit) & 1) === 1;
    if (selected) total += b.biaya;
    return { ...b.usulan, peringkat: bit + 1, skor: b.skor, selected, totalBerjalan: total };
  });
}

// ---------------------------------------------------------------------------
// Ruas: dari tangga ke rentang pagu per usulan, pada kisi kelipatan `langkah`
// ---------------------------------------------------------------------------

/** Rentang pagu (kelipatan langkah) tempat usulan terbiayai. `sampai` null = terus sampai ujung peta. */
export interface Ruas {
  dari: number;
  sampai: number | null;
}

export interface OpsiKisi {
  /** Rp 5 juta: sama dengan langkah geseran pagu. */
  langkah: number;
  /** Ujung sumbu (pagu terbesar yang digeser). */
  maks: number;
}

/**
 * Ruas tiap usulan. Sebuah titik tangga yang jatuh di antara dua titik kisi baru terlihat di titik kisi
 * berikutnya ("dari Rp 505 juta"); sebuah pilihan yang hanya berlaku di antara dua titik kisi tidak
 * muncul. Konsisten dengan geseran pagu yang melangkah per Rp 5 juta.
 */
export function ruasPerUsulan(tangga: Tangga, { langkah, maks }: OpsiKisi): Map<string, Ruas[]> {
  const hasil = new Map<string, Ruas[]>(tangga.urutan.map((b) => [b.usulan.id, []]));
  const naikKisi = (x: number) => Math.ceil(x / langkah) * langkah;

  tangga.titik.forEach((t, k) => {
    const awal = naikKisi(t.pagu);
    const berikut = tangga.titik[k + 1];
    // Titik kisi terakhir yang masih sebelum titik tangga berikutnya.
    const akhir = berikut ? naikKisi(berikut.pagu) - langkah : naikKisi(maks);
    const batas = Math.min(akhir, naikKisi(maks));
    if (awal > batas) return;

    tangga.urutan.forEach((b, bit) => {
      if (((t.mask >> bit) & 1) === 0) return;
      const daftar = hasil.get(b.usulan.id)!;
      const terakhir = daftar[daftar.length - 1];
      if (terakhir && terakhir.sampai !== null && terakhir.sampai + langkah === awal) {
        terakhir.sampai = batas;
      } else {
        daftar.push({ dari: awal, sampai: batas });
      }
    });
  });

  // Ruas yang sampai ujung peta berlaku "dari ... dan seterusnya".
  const ujung = naikKisi(maks);
  for (const daftar of hasil.values()) {
    const terakhir = daftar[daftar.length - 1];
    if (terakhir && terakhir.sampai === ujung) terakhir.sampai = null;
  }
  return hasil;
}

/** Apakah pagu ini berada di dalam salah satu ruas. */
export function dalamRuas(ruas: readonly Ruas[], pagu: number): boolean {
  return ruas.some((r) => pagu >= r.dari && (r.sampai === null || pagu <= r.sampai));
}

// ---------------------------------------------------------------------------
// Kalimat untuk warga
// ---------------------------------------------------------------------------

/** "Rp 395–460 juta", atau "Rp 195 juta" bila hanya satu titik kisi. */
function teksRuasTertutup(r: Ruas): string {
  return r.sampai === null || r.sampai === r.dari ? rupiah(r.dari) : rentangRupiah(r.dari, r.sampai);
}

/** Satu ruas sebagai teks, untuk tabel: "Rp 465–500 juta", "Rp 195 juta", atau "dari Rp 685 juta". */
export function teksRuas(r: Ruas): string {
  return r.sampai === null ? `dari ${rupiah(r.dari)}` : teksRuasTertutup(r);
}

/**
 * Kalimat satu usulan pada peta, mis.
 *   "Talud baru muat kalau pagunya Rp 505 juta, Rp 205 juta lebih banyak dari pagu sekarang."
 *   "Gapura muat pada Rp 465–500 juta, lalu lagi dari Rp 685 juta."
 * `nama` sudah berisi RW bila perlu. `terbiayai` adalah keadaan sebenarnya pada `pagu` (dari hitungan
 * yang tepat), supaya kalimat tidak bertentangan dengan penanda status bila pagu yang diketik tidak
 * jatuh tepat di kisi Rp 5 juta.
 */
export function kalimatRuas(
  nama: string,
  ruas: readonly Ruas[],
  pagu: number,
  maks: number,
  terbiayai: boolean,
): string {
  if (ruas.length === 0) {
    return `${nama} tidak terbiayai pada pagu berapa pun sampai ${rupiah(maks)}.`;
  }
  const terbuka = ruas[ruas.length - 1].sampai === null;
  if (ruas.length === 1 && terbuka) {
    const dari = ruas[0].dari;
    if (!terbiayai) {
      return `${nama} baru muat kalau pagunya ${rupiah(dari)}, ${rupiah(dari - pagu)} lebih banyak dari pagu sekarang.`;
    }
    return pagu >= dari
      ? `${nama} terbiayai mulai ${rupiah(dari)} dan seterusnya. Pagu Anda sudah sampai di sana.`
      : `${nama} terbiayai di pagu ini dan seterusnya.`;
  }
  if (ruas.length === 1) return `${nama} hanya muat pada ${teksRuasTertutup(ruas[0])}.`;

  const awal = ruas.slice(0, -1).map(teksRuasTertutup).join(", ");
  const akhir = ruas[ruas.length - 1];
  const penutup = terbuka ? `dari ${rupiah(akhir.dari)}` : `pada ${teksRuasTertutup(akhir)}`;
  return `${nama} muat pada ${awal}, lalu lagi ${penutup}.`;
}

/** Sumbu peta: pagu terbesar yang bisa digeser. */
export function ujungSumbu(totalBiaya: number, paguResmi: number, langkah: number): number {
  const lebih = Math.max(totalBiaya, 2 * paguResmi);
  const KELIPATAN = 50_000_000;
  const bulat = Math.ceil(lebih / KELIPATAN) * KELIPATAN;
  // Selalu kelipatan langkah, supaya geseran bisa berhenti tepat di ujung.
  return Math.ceil(bulat / langkah) * langkah;
}
