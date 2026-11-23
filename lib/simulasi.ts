// Inti halaman /simulasi: keadaan yang bisa diubah warga (pagu, bobot, usulan forum andaian), cara
// menyusunnya menjadi DasarHitung, dan hasil yang dibandingkan dengan rekomendasi resmi.
//
// Murni dan tanpa "server-only": dijalankan di peramban. TIDAK ada rumus baru; semuanya lewat pilihOptimal
// (hitungRekomendasi) dan bandingkan dari lib/pratinjau.ts, yang sudah dibuktikan sama dengan
// rekomendasi_resmi di SQL. supabase/tests/simulasi.test.ts membuktikannya lagi untuk keadaan simulasi.
import {
  bandingkan,
  hitungRekomendasi,
  modePaguDari,
  petaPosisi,
  terapkanPerubahan,
  type DasarHitung,
  type HasilBanding,
  type PosisiHitung,
  type UsulanHitung,
} from "./pratinjau.ts";
import type { ModePagu } from "./pagu-model.ts";
import { BATAS_USULAN_OPTIMAL, type Bobot, type HasilPilih, type Wilayah } from "./seleksi.ts";
import { BATAS_ADMIN } from "./admin-skema.ts";
import { samaBobot } from "./bobot-simulasi.ts";
import { hasilPada, ujungSumbu, type Tangga } from "./peta-pagu.ts";

/** Usulan berstatus forum yang boleh ditambahkan warga ke simulasi. */
export interface UsulanForum {
  id: string;
  title: string;
  /** Nama singkat untuk label; bila usulan belum punya, judul yang dipotong. */
  namaSingkat: string;
  category: string;
  rw: number;
  estimatedBudget: number;
  voteCount: number;
  /** created_at (ISO), untuk urutan seri yang sama dengan SQL. */
  dibuat: string;
}

const PANJANG_NAMA_SINGKAT = 24;

/** Nama singkat usulan; bila belum ada, judul dipotong di batas kata dengan elipsis. */
export function namaSingkatDari(namaSingkat: string | null, judul: string): string {
  const nama = namaSingkat?.trim();
  if (nama) return nama;
  const rapi = judul.replace(/\s+/g, " ").trim();
  if (rapi.length <= PANJANG_NAMA_SINGKAT) return rapi;
  const potong = rapi.slice(0, PANJANG_NAMA_SINGKAT);
  // Bila potongan tepat berakhir di batas kata, kata terakhirnya utuh; bila tidak, buang kata yang terpotong.
  const akhirKata = rapi[PANJANG_NAMA_SINGKAT] === " " ? potong.length : potong.lastIndexOf(" ");
  return `${(akhirKata > 8 ? potong.slice(0, akhirKata) : potong).trimEnd()}…`;
}

export interface DataSimulasi {
  /** Keadaan resmi: usulan voting, wilayah, pagu dan bobot dari database. */
  dasar: DasarHitung;
  forum: readonly UsulanForum[];
  /** true bila ada data yang diambil dari cadangan karena database tidak terjangkau. */
  dataCadangan: boolean;
}

/** Usulan forum yang ditambahkan, dengan urgensi yang diandaikan warga (1-10). */
export interface Tambahan {
  id: string;
  urgensi: number;
}

export interface KeadaanSimulasi {
  pagu: number;
  bobot: Bobot;
  tambah: readonly Tambahan[];
}

export const keadaanResmi = (data: DataSimulasi): KeadaanSimulasi => ({
  pagu: data.dasar.pagu,
  bobot: data.dasar.bobot,
  tambah: [],
});

export function samaKeadaan(a: KeadaanSimulasi, b: KeadaanSimulasi): boolean {
  return (
    a.pagu === b.pagu &&
    samaBobot(a.bobot, b.bobot) &&
    a.tambah.length === b.tambah.length &&
    a.tambah.every((t, i) => t.id === b.tambah[i].id && t.urgensi === b.tambah[i].urgensi)
  );
}

/** Langkah geseran pagu dan kisi Peta Pagu: Rp 5 juta. */
export const LANGKAH_PAGU = 5_000_000;

export interface RentangPagu {
  langkah: number;
  min: number;
  maks: number;
}

/**
 * Rentang geseran pagu dan sumbu Peta Pagu: dari Rp 10 juta sampai yang lebih besar dari total biaya semua usulan
 * yang disimulasikan atau dua kali pagu resmi, dibulatkan ke atas ke kelipatan Rp 50 juta.
 */
export function rentangPagu(usulan: readonly UsulanHitung[], paguResmi: number): RentangPagu {
  const total = usulan.reduce((n, u) => n + u.estimatedBudget, 0);
  return { langkah: LANGKAH_PAGU, min: BATAS_ADMIN.pagu.min, maks: ujungSumbu(total, paguResmi, LANGKAH_PAGU) };
}

/** Berapa usulan forum yang masih boleh ditambahkan: total usulan maksimal 16. */
export const sisaTempat = (data: DataSimulasi): number => Math.max(0, BATAS_USULAN_OPTIMAL - data.dasar.usulan.length);

/** Usulan forum yang belum ditambahkan, menurut urutan di data. */
export function bisaDitambah(data: DataSimulasi, keadaan: KeadaanSimulasi): UsulanForum[] {
  const sudah = new Set(keadaan.tambah.map((t) => t.id));
  return data.forum.filter((f) => !sudah.has(f.id));
}

/**
 * Tambahkan satu usulan forum dengan urgensi andaian. Keadaan yang sama dikembalikan bila usulannya tidak
 * dikenal, sudah ditambahkan, urgensinya di luar 1-10, atau total usulan sudah 16.
 */
export function tambahkan(data: DataSimulasi, keadaan: KeadaanSimulasi, id: string, urgensi: number): KeadaanSimulasi {
  if (!Number.isInteger(urgensi) || urgensi < 1 || urgensi > 10) return keadaan;
  if (!data.forum.some((f) => f.id === id) || keadaan.tambah.some((t) => t.id === id)) return keadaan;
  if (keadaan.tambah.length >= sisaTempat(data)) return keadaan;
  return { ...keadaan, tambah: [...keadaan.tambah, { id, urgensi }] };
}

export function ubahUrgensi(keadaan: KeadaanSimulasi, id: string, urgensi: number): KeadaanSimulasi {
  if (!Number.isInteger(urgensi) || urgensi < 1 || urgensi > 10) return keadaan;
  return { ...keadaan, tambah: keadaan.tambah.map((t) => (t.id === id ? { ...t, urgensi } : t)) };
}

export const lepaskan = (keadaan: KeadaanSimulasi, id: string): KeadaanSimulasi => ({
  ...keadaan,
  tambah: keadaan.tambah.filter((t) => t.id !== id),
});

// ---------------------------------------------------------------------------
// Menyusun dan menghitung
// ---------------------------------------------------------------------------

const keUsulanHitung = (f: UsulanForum, urgensi: number): UsulanHitung => ({
  id: f.id,
  title: f.title,
  namaSingkat: f.namaSingkat,
  category: f.category,
  rw: f.rw,
  estimatedBudget: f.estimatedBudget,
  voteCount: f.voteCount,
  urgencyScore: urgensi,
  dibuat: f.dibuat,
});

/**
 * Daftar usulan yang dihitung: usulan voting ditambah usulan forum andaian, ditambahkan satu per satu dengan
 * terapkanPerubahan("masuk") sehingga urutan seri (created_at, id) sama dengan SQL. Tambahan yang tidak lagi
 * dikenal dilewati. Tidak bergantung pada pagu dan bobot, jadi layar bisa menyimpannya selama keduanya
 * digeser (Peta Pagu hanya dihitung ulang bila daftar atau bobot berubah).
 */
export function susunUsulan(data: DataSimulasi, tambah: readonly Tambahan[]): readonly UsulanHitung[] {
  let dasar: DasarHitung = data.dasar;
  const forum = new Map(data.forum.map((f) => [f.id, f]));
  for (const t of tambah) {
    const f = forum.get(t.id);
    if (f) dasar = terapkanPerubahan(dasar, { jenis: "masuk", usulan: keUsulanHitung(f, t.urgensi) });
  }
  return dasar.usulan;
}

/** DasarHitung untuk keadaan ini: pagu dan bobot diganti, usulan dari susunUsulan. */
export function susunDasar(data: DataSimulasi, keadaan: KeadaanSimulasi): DasarHitung {
  return { ...data.dasar, usulan: susunUsulan(data, keadaan.tambah), pagu: keadaan.pagu, bobot: keadaan.bobot };
}

export interface HasilResmi {
  hasil: HasilPilih[];
  mode: ModePagu;
}

/** Rekomendasi resmi (nilai dari database). Dihitung sekali per data, bukan tiap geseran. */
export function hitungResmi(data: DataSimulasi): HasilResmi {
  const hasil = hitungRekomendasi(data.dasar);
  return { hasil, mode: modePaguDari(hasil, data.dasar.wilayah, data.dasar.pagu) };
}

export interface HasilSimulasi {
  dasar: DasarHitung;
  hasil: HasilPilih[];
  mode: ModePagu;
  posisi: Map<string, PosisiHitung>;
  /** Simulasi dibanding resmi. */
  banding: HasilBanding;
  jumlah: number;
  terbiayai: number;
  sisa: number;
  /** Keadaan persis sama dengan resmi. */
  samaDenganResmi: boolean;
  /** Ada usulan (yang dihitung di kedua keadaan) yang skornya berbeda dari rekomendasi resmi. */
  skorBeda: boolean;
}

/**
 * `tangga` (lib/peta-pagu.ts), bila diberikan, HARUS dibangun dari usulan dan bobot keadaan ini. Hasilnya lalu
 * dibaca dari tangga (satu pencarian biner) dan terbukti sama dengan pilihOptimal; tanpa tangga, pilihOptimal dipanggil.
 */
export function hitungSimulasi(data: DataSimulasi, keadaan: KeadaanSimulasi, resmi: HasilResmi, tangga?: Tangga): HasilSimulasi {
  const dasar = susunDasar(data, keadaan);
  const hasil = tangga ? hasilPada(tangga, dasar.pagu) : hitungRekomendasi(dasar);
  const banding = bandingkan(data.dasar, dasar, resmi.hasil, hasil);
  const skorResmi = new Map(resmi.hasil.map((h) => [h.id, h.skor]));
  return {
    dasar,
    hasil,
    mode: modePaguDari(hasil, dasar.wilayah, dasar.pagu),
    posisi: petaPosisi(hasil),
    banding,
    jumlah: hasil.length,
    terbiayai: banding.terbiayaiSesudah,
    sisa: banding.sisaSesudah,
    samaDenganResmi: samaKeadaan(keadaan, keadaanResmi(data)),
    skorBeda: hasil.some((h) => skorResmi.has(h.id) && skorResmi.get(h.id) !== h.skor),
  };
}

/**
 * Apa yang berubah KARENA BOBOT saja: simulasi dibanding keadaan yang sama (pagu dan usulan andaian yang sama)
 * dengan bobot resmi. Untuk kalimat di dekat geseran bobot; perbandingan menyeluruh dengan resmi ada di hasil.
 */
export function bandingkanBobot(
  data: DataSimulasi,
  dasar: DasarHitung,
  hasil: readonly HasilPilih[],
  /** Tangga untuk usulan yang sama dengan bobot resmi, bila sudah ada (menggantikan satu pilihOptimal). */
  tanggaPatokan?: Tangga,
): { banding: HasilBanding; skorBeda: boolean } {
  const patokan: DasarHitung = { ...dasar, bobot: data.dasar.bobot };
  const hasilPatokan = tanggaPatokan ? hasilPada(tanggaPatokan, dasar.pagu) : hitungRekomendasi(patokan);
  const skor = new Map(hasilPatokan.map((h) => [h.id, h.skor]));
  return {
    banding: bandingkan(patokan, dasar, hasilPatokan, hasil),
    skorBeda: hasil.some((h) => skor.has(h.id) && skor.get(h.id) !== h.skor),
  };
}

// ---------------------------------------------------------------------------
// Siapa yang kebagian: per RW
// ---------------------------------------------------------------------------

export interface BarisRw {
  rw: number;
  nama: string;
  penduduk: number;
  /** Jumlah biaya usulan yang terbiayai di RW ini. */
  rupiah: number;
  jumlah: number;
  /** Rupiah per penduduk (0 bila penduduk 0). */
  perPenduduk: number;
}

export function ringkasPerRw(wilayah: readonly Wilayah[], hasil: readonly HasilPilih[]): BarisRw[] {
  return wilayah.map((w) => {
    const terbiayai = hasil.filter((h) => h.selected && h.rw === w.rw);
    const rupiah = terbiayai.reduce((n, h) => n + h.estimatedBudget, 0);
    return {
      rw: w.rw,
      nama: w.nama,
      penduduk: w.penduduk,
      rupiah,
      jumlah: terbiayai.length,
      perPenduduk: w.penduduk > 0 ? rupiah / w.penduduk : 0,
    };
  });
}
