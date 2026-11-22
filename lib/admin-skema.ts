// Aturan isian halaman admin: pagu, bobot, urgensi, alasan. SATU sumber untuk klien (umpan balik
// cepat, pratinjau) dan server (penentu). Angka batasnya sama dengan yang diperiksa fungsi SQL di
// supabase/migrations/0005_admin.sql; kalau satu diubah, ubah keduanya.
import { parseRupiah } from "./rupiah.ts";
import { BATAS_USULAN_OPTIMAL } from "./seleksi.ts";
import { BATAS, panjang, rapikanTeks } from "./usulan-skema.ts";

export const BATAS_ADMIN = {
  // Rp 10 juta: di bawah ini tidak ada usulan yang masuk akal terbiayai. Rp 10 miliar: jauh di atas
  // desa mana pun yang memakai SUARA, dan menangkap salah nol. Biaya usulan maksimal Rp 5 miliar
  // (BATAS.biaya.maks), jadi satu usulan selalu masih bisa muat.
  pagu: { min: 10_000_000, maks: 10_000_000_000 },
  urgensi: { min: 1, maks: 10 },
  // Alasan urgensi lebih panjang dari alasan biasa: ini satu-satunya pembenaran nilai yang
  // menentukan peringkat, dan dibaca semua warga.
  alasanUrgensi: { min: 20, maks: 500 },
  bobotJumlah: 100,
  /** Sama dengan BATAS_USULAN_OPTIMAL di lib/seleksi.ts dan batas di pilih_optimal (SQL). */
  usulanVoting: BATAS_USULAN_OPTIMAL,
} as const;

export type HasilPeriksa<T> = { ok: true; nilai: T } | { ok: false; pesan: string };

// ---------------------------------------------------------------------------
// Pagu
// ---------------------------------------------------------------------------

/** Pagu dari teks yang diketik admin ("300 juta", "Rp 300.000.000", "300000000"). */
export function periksaPagu(teks: string): HasilPeriksa<number> {
  if (teks.trim() === "") return { ok: false, pesan: "Isi jumlah pagu." };
  const hasil = parseRupiah(teks);
  if (!hasil.ok) return { ok: false, pesan: "Tulis pagu dalam angka, misalnya 300.000.000 atau 300 juta." };
  if (hasil.nilai < BATAS_ADMIN.pagu.min) return { ok: false, pesan: "Pagu minimal Rp 10 juta. Periksa jumlah nolnya." };
  if (hasil.nilai > BATAS_ADMIN.pagu.maks) return { ok: false, pesan: "Pagu maksimal Rp 10 miliar. Periksa jumlah nolnya." };
  return { ok: true, nilai: hasil.nilai };
}

// ---------------------------------------------------------------------------
// Urgensi
// ---------------------------------------------------------------------------

export function periksaUrgensi(nilai: unknown): HasilPeriksa<number> {
  const n = typeof nilai === "string" && nilai.trim() !== "" ? Number(nilai) : typeof nilai === "number" ? nilai : NaN;
  if (!Number.isInteger(n) || n < BATAS_ADMIN.urgensi.min || n > BATAS_ADMIN.urgensi.maks) {
    return { ok: false, pesan: "Pilih nilai urgensi, 1 sampai 10." };
  }
  return { ok: true, nilai: n };
}

export function periksaAlasanUrgensi(teks: string): HasilPeriksa<string> {
  const rapi = rapikanTeks(teks, true);
  const { min, maks } = BATAS_ADMIN.alasanUrgensi;
  if (panjang(rapi) < min) {
    return { ok: false, pesan: `Tulis alasan urgensinya, minimal ${min} karakter. Alasan ini bisa dibaca semua warga.` };
  }
  if (panjang(rapi) > maks) return { ok: false, pesan: `Alasan terlalu panjang. Maksimal ${maks} karakter.` };
  return { ok: true, nilai: rapi };
}

/** Nama singkat boleh kosong (dipakai nama yang sudah ada). null = kosong. */
export function periksaNamaSingkat(teks: string): HasilPeriksa<string | null> {
  const rapi = rapikanTeks(teks, false);
  if (rapi === "") return { ok: true, nilai: null };
  const { min, maks } = BATAS.namaSingkat;
  if (panjang(rapi) < min || panjang(rapi) > maks) {
    return { ok: false, pesan: `Nama singkat harus ${min} sampai ${maks} karakter.` };
  }
  return { ok: true, nilai: rapi };
}

// ---------------------------------------------------------------------------
// Bobot
// ---------------------------------------------------------------------------

export const KOLOM_BOBOT = ["popularitas", "urgensi", "pemerataan"] as const;
export type KolomBobot = (typeof KOLOM_BOBOT)[number];

export interface MasukanBobot {
  popularitas: string;
  urgensi: string;
  pemerataan: string;
}

export interface BobotAngka {
  popularitas: number;
  urgensi: number;
  pemerataan: number;
}

export const LABEL_BOBOT: Record<KolomBobot, string> = {
  popularitas: "Popularitas",
  urgensi: "Urgensi",
  pemerataan: "Pemerataan",
};

/** Satu kolom bobot: bilangan bulat 0 sampai 100. */
function bacaBobot(teks: string): number | null {
  const t = teks.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 100 ? n : null;
}

export type GalatBobot = Partial<Record<KolomBobot | "jumlah", string>>;

export function periksaBobot(m: MasukanBobot): { ok: true; nilai: BobotAngka } | { ok: false; galat: GalatBobot } {
  const galat: GalatBobot = {};
  const angka: Partial<BobotAngka> = {};
  for (const k of KOLOM_BOBOT) {
    const n = bacaBobot(m[k]);
    if (n === null) galat[k] = `${LABEL_BOBOT[k]}: isi bilangan bulat 0 sampai 100.`;
    else angka[k] = n;
  }
  if (Object.keys(galat).length > 0) return { ok: false, galat };

  const bobot = angka as BobotAngka;
  const jumlah = bobot.popularitas + bobot.urgensi + bobot.pemerataan;
  if (jumlah !== BATAS_ADMIN.bobotJumlah) {
    galat.jumlah = `Jumlah bobot harus tepat ${BATAS_ADMIN.bobotJumlah}, sekarang ${jumlah}.`;
    return { ok: false, galat };
  }
  return { ok: true, nilai: bobot };
}

export interface KeadaanJumlah {
  jumlah: number;
  /** Positif = kurang dari 100, negatif = lebih. */
  kurang: number;
  /** Semua kolom terisi dengan benar dan jumlahnya tepat 100. */
  siap: boolean;
  teks: string;
}

/** Penunjuk jumlah yang selalu terlihat: "Jumlah 100. Siap disimpan." atau "Jumlah 95. Kurang 5." */
export function keadaanJumlahBobot(m: MasukanBobot): KeadaanJumlah {
  let adaSalah = false;
  let jumlah = 0;
  for (const k of KOLOM_BOBOT) {
    const n = bacaBobot(m[k]);
    if (n === null) adaSalah = true;
    else jumlah += n;
  }
  const kurang = BATAS_ADMIN.bobotJumlah - jumlah;
  const siap = !adaSalah && kurang === 0;
  let teks: string;
  if (adaSalah) teks = `Jumlah ${jumlah}. Isi ketiga kolom dengan bilangan bulat 0 sampai 100.`;
  else if (kurang === 0) teks = `Jumlah ${jumlah}. Siap disimpan.`;
  else if (kurang > 0) teks = `Jumlah ${jumlah}. Kurang ${kurang}.`;
  else teks = `Jumlah ${jumlah}. Lebih ${-kurang}.`;
  return { jumlah, kurang, siap, teks };
}

/**
 * Sisa untuk urgensi bila popularitas dan pemerataan sudah diisi: 100 dikurangi keduanya.
 * null bila keduanya belum valid atau sudah melebihi 100.
 */
export function sisaUntukUrgensi(m: Pick<MasukanBobot, "popularitas" | "pemerataan">): number | null {
  const a = bacaBobot(m.popularitas);
  const b = bacaBobot(m.pemerataan);
  if (a === null || b === null || a + b > BATAS_ADMIN.bobotJumlah) return null;
  return BATAS_ADMIN.bobotJumlah - a - b;
}
