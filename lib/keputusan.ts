// Aturan keputusan musyawarah yang dipakai layar admin dan halaman publik. Murni, tanpa akses database dan
// tanpa "server-only", supaya bisa diuji dan dipakai komponen klien.
//
// Penentu sebenarnya adalah fungsi SQL tetapkan_keputusan (supabase/migrations/0006_keputusan.sql): angka
// batasnya sama dengan di sana, dan supabase/tests/keputusan.test.ts menguji tiap aturan di database. Di sini
// aturan itu dipakai untuk umpan balik cepat di lembar kerja dan untuk menolak lebih awal di server.
import { rupiah } from "./format.ts";
import type { StatusUsulan } from "./seleksi.ts";

// ---------------------------------------------------------------------------
// Hasil
// ---------------------------------------------------------------------------

export const HASIL = ["disetujui", "dana_lain", "dilanjutkan", "ditolak"] as const;
export type Hasil = (typeof HASIL)[number];

export const adalahHasil = (nilai: unknown): nilai is Hasil =>
  typeof nilai === "string" && (HASIL as readonly string[]).includes(nilai);

export const LABEL_HASIL: Record<Hasil, string> = {
  disetujui: "Disetujui",
  dana_lain: "Diajukan ke dana lain",
  dilanjutkan: "Dibawa ke periode berikutnya",
  ditolak: "Ditolak",
};

/** Status usulan sesudah hasil ini ditetapkan. 'dilanjutkan' tidak mengubah status: tetap dalam hitungan. */
export const STATUS_SESUDAH: Record<Hasil, "approved" | "referred" | "voting" | "rejected"> = {
  disetujui: "approved",
  dana_lain: "referred",
  dilanjutkan: "voting",
  ditolak: "rejected",
};

/** Batas panjang isian. Angka yang sama ada di SQL. */
export const BATAS = {
  alasan: { min: 20, max: 500 },
  sumberDana: { min: 3, max: 80 },
  catatanRapat: { min: 20, max: 1000 },
  alasanBatal: { min: 10, max: 500 },
  catatanSelesai: { min: 10, max: 500 },
} as const;

/** Berapa jam sebuah penetapan masih bisa dibatalkan. */
export const JAM_BISA_DIBATALKAN = 24;

export const TEKS_STATUS_REKOMENDASI: Record<StatusUsulan, string> = {
  terpilih: "Terpilih",
  ditunda: "Ditunda",
  "tidak-terpilih": "Tidak terpilih",
};

export const adalahStatusUsulan = (nilai: unknown): nilai is StatusUsulan =>
  nilai === "terpilih" || nilai === "ditunda" || nilai === "tidak-terpilih";

/**
 * "Berbeda dari rekomendasi": disetujui padahal tidak terpilih, atau tidak disetujui padahal terpilih.
 * Dibawa ke periode berikutnya, diajukan ke dana lain, dan ditolak semuanya "tidak disetujui".
 */
export const berbedaDariRekomendasi = (hasil: Hasil, terpilih: boolean): boolean => (hasil === "disetujui") !== terpilih;

/** Alasan tertulis wajib untuk hasil ini? Selalu untuk ditolak dan dana lain; selain itu bila berbeda dari rekomendasi. */
export function alasanWajib(hasil: Hasil, terpilih: boolean): boolean {
  return hasil === "ditolak" || hasil === "dana_lain" || berbedaDariRekomendasi(hasil, terpilih);
}

/** Mengapa alasan wajib, dalam kalimat yang dibaca admin. null bila alasan hanya boleh diisi. */
export function penjelasanAlasan(hasil: Hasil, terpilih: boolean): string | null {
  if (hasil === "ditolak") return "Penolakan selalu butuh alasan tertulis, supaya warga tahu mengapa.";
  if (hasil === "dana_lain") return "Tulis alasan dan nama sumber dananya, supaya warga tahu usulan ini dibawa ke mana.";
  if (berbedaDariRekomendasi(hasil, terpilih)) return "Berbeda dari rekomendasi, jadi warga perlu tahu alasannya.";
  return null;
}

// ---------------------------------------------------------------------------
// Hitungan yang dilihat admin (jawaban sidik_hitungan)
// ---------------------------------------------------------------------------

export interface BarisHitungan {
  peringkat: number;
  id: string;
  judul: string;
  namaSingkat: string;
  rw: number;
  biaya: number;
  dukungan: number;
  urgensi: number;
  skor: number;
  status: StatusUsulan;
  terpilih: boolean;
}

export interface HitunganResmi {
  sidik: string;
  pagu: number;
  versiBobot: number;
  bobot: { popularitas: number; urgensi: number; pemerataan: number };
  usulan: BarisHitungan[];
}

type Objek = Record<string, unknown>;
const adalahObjek = (v: unknown): v is Objek => typeof v === "object" && v !== null && !Array.isArray(v);
const angka = (v: unknown, nama: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`sidik_hitungan: ${nama} bukan angka`);
  return v;
};
const teks = (v: unknown, nama: string): string => {
  if (typeof v !== "string") throw new Error(`sidik_hitungan: ${nama} bukan teks`);
  return v;
};

/** Mengurai jawaban jsonb sidik_hitungan. Melempar bila bentuknya tidak cocok (skema database tidak sama dengan kode). */
export function uraiHitungan(mentah: unknown): HitunganResmi {
  if (!adalahObjek(mentah) || !Array.isArray(mentah.usulan) || !adalahObjek(mentah.bobot)) {
    throw new Error("sidik_hitungan: bentuk jawaban tidak dikenal");
  }
  return {
    sidik: teks(mentah.sidik, "sidik"),
    pagu: angka(mentah.pagu, "pagu"),
    versiBobot: angka(mentah.versi_bobot, "versi_bobot"),
    bobot: {
      popularitas: angka(mentah.bobot.popularitas, "bobot.popularitas"),
      urgensi: angka(mentah.bobot.urgensi, "bobot.urgensi"),
      pemerataan: angka(mentah.bobot.pemerataan, "bobot.pemerataan"),
    },
    usulan: mentah.usulan.map((u): BarisHitungan => {
      if (!adalahObjek(u)) throw new Error("sidik_hitungan: baris usulan bukan objek");
      if (!adalahStatusUsulan(u.status)) throw new Error("sidik_hitungan: status tidak dikenal");
      return {
        peringkat: angka(u.peringkat, "peringkat"),
        id: teks(u.id, "id"),
        judul: teks(u.judul, "judul"),
        namaSingkat: teks(u.nama_singkat, "nama_singkat"),
        rw: angka(u.rw, "rw"),
        biaya: angka(u.biaya, "biaya"),
        dukungan: angka(u.dukungan, "dukungan"),
        urgensi: angka(u.urgensi, "urgensi"),
        skor: angka(u.skor, "skor"),
        status: u.status,
        terpilih: u.terpilih === true,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Lembar kerja
// ---------------------------------------------------------------------------

export interface Pilihan {
  hasil: Hasil | null;
  alasan: string;
  sumberDana: string;
}

/** Isian lembar kerja menurut id usulan. */
export type Isian = Record<string, Pilihan>;

export const PILIHAN_KOSONG: Pilihan = { hasil: null, alasan: "", sumberDana: "" };

export const pilihanDari = (isian: Isian, id: string): Pilihan => isian[id] ?? PILIHAN_KOSONG;

export interface GalatPilihan {
  hasil?: string;
  alasan?: string;
  sumberDana?: string;
}

const panjang = (s: string): number => [...s.trim()].length;

/** Galat tiap kolom satu baris. Objek kosong = sah. Baris yang belum dipilih hasilnya dianggap "belum diisi", bukan galat. */
export function periksaPilihan(b: Pick<BarisHitungan, "terpilih">, p: Pilihan): GalatPilihan {
  if (p.hasil === null) return {};
  const galat: GalatPilihan = {};
  const n = panjang(p.alasan);
  const { min, max } = BATAS.alasan;
  if (n === 0 && alasanWajib(p.hasil, b.terpilih)) {
    galat.alasan = "Alasan wajib diisi, 20 sampai 500 karakter.";
  } else if (n > 0 && (n < min || n > max)) {
    galat.alasan = n < min ? `Alasan terlalu pendek, minimal ${min} karakter.` : `Alasan terlalu panjang, maksimal ${max} karakter.`;
  }
  if (p.hasil === "dana_lain") {
    const s = panjang(p.sumberDana);
    if (s < BATAS.sumberDana.min || s > BATAS.sumberDana.max) galat.sumberDana = "Tulis sumber dananya, 3 sampai 80 karakter.";
  }
  return galat;
}

export interface RingkasLembar {
  jumlah: number;
  belumDiisi: number;
  berbeda: number;
  disetujui: number;
  danaLain: number;
  dilanjutkan: number;
  ditolak: number;
  terpakai: number;
  /** pagu - terpakai; negatif bila melebihi. */
  sisa: number;
  /** Berapa rupiah di atas pagu; 0 bila tidak melebihi. */
  melebihi: number;
  /** Jumlah baris yang isiannya belum sah (alasan atau sumber dana). */
  galat: number;
}

export function ringkasLembar(baris: readonly BarisHitungan[], isian: Isian, pagu: number): RingkasLembar {
  const r: RingkasLembar = {
    jumlah: baris.length, belumDiisi: 0, berbeda: 0, disetujui: 0, danaLain: 0, dilanjutkan: 0, ditolak: 0,
    terpakai: 0, sisa: pagu, melebihi: 0, galat: 0,
  };
  for (const b of baris) {
    const p = pilihanDari(isian, b.id);
    if (p.hasil === null) {
      r.belumDiisi++;
      continue;
    }
    if (berbedaDariRekomendasi(p.hasil, b.terpilih)) r.berbeda++;
    if (Object.keys(periksaPilihan(b, p)).length > 0) r.galat++;
    if (p.hasil === "disetujui") {
      r.disetujui++;
      r.terpakai += b.biaya;
    } else if (p.hasil === "dana_lain") r.danaLain++;
    else if (p.hasil === "dilanjutkan") r.dilanjutkan++;
    else r.ditolak++;
  }
  r.sisa = pagu - r.terpakai;
  r.melebihi = Math.max(0, r.terpakai - pagu);
  return r;
}

/** Tombol "Isi sisanya sesuai rekomendasi": hanya yang belum dipilih. Terpilih jadi Disetujui, lainnya Dibawa ke periode berikutnya. */
export function isiSesuaiRekomendasi(baris: readonly BarisHitungan[], isian: Isian): Isian {
  const baru: Isian = { ...isian };
  for (const b of baris) {
    if (pilihanDari(isian, b.id).hasil === null) {
      baru[b.id] = { ...pilihanDari(isian, b.id), hasil: b.terpilih ? "disetujui" : "dilanjutkan" };
    }
  }
  return baru;
}

/** Kalimat yang dicatat sistem untuk keputusan yang sejalan dan tanpa alasan tertulis. Sama dengan yang ditulis SQL. */
export function kalimatSejalan(b: Pick<BarisHitungan, "peringkat" | "skor" | "terpilih">, jumlahUsulan: number): string {
  const skor = (Math.round(b.skor * 10) / 10).toFixed(1).replace(".", ",");
  return `Mengikuti rekomendasi: ${b.terpilih ? "" : "belum terbiayai, "}peringkat ${b.peringkat} dari ${jumlahUsulan}, skor ${skor}.`;
}

export interface ButirServer {
  id: string;
  hasil: Hasil;
  alasan: string | null;
  sumber_dana: string | null;
}

/** Bentuk yang dikirim ke tetapkan_keputusan. Mengembalikan null bila masih ada baris yang belum dipilih hasilnya. */
export function butirUntukServer(baris: readonly BarisHitungan[], isian: Isian): ButirServer[] | null {
  const butir: ButirServer[] = [];
  for (const b of baris) {
    const p = pilihanDari(isian, b.id);
    if (p.hasil === null) return null;
    butir.push({
      id: b.id,
      hasil: p.hasil,
      alasan: p.alasan.trim() === "" ? null : p.alasan.trim(),
      sumber_dana: p.hasil === "dana_lain" ? p.sumberDana.trim() : null,
    });
  }
  return butir;
}

/** Apakah penetapan boleh dilanjutkan, dan bila tidak, apa yang menahannya (kalimat untuk admin). */
export function penahanPenetapan(r: RingkasLembar): string | null {
  if (r.jumlah === 0) return "Tidak ada usulan dalam hitungan, jadi belum ada yang bisa ditetapkan.";
  if (r.melebihi > 0) return `Yang disetujui melebihi pagu sebesar ${rupiah(r.melebihi)}. Kurangi yang disetujui.`;
  if (r.belumDiisi > 0) return `${r.belumDiisi} usulan belum dipilih hasilnya.`;
  if (r.galat > 0) return `${r.galat} usulan masih punya isian yang belum sah.`;
  return null;
}

// ---------------------------------------------------------------------------
// Akibat untuk periode berikutnya
// ---------------------------------------------------------------------------

export interface WilayahAkibat {
  rw: number;
  nama: string;
  /** Anggaran periode lalu yang berlaku sekarang. */
  sekarang: number;
  /** Anggaran periode lalu sesudah penetapan: jumlah biaya yang disetujui di RW ini (0 bila tidak ada). */
  sesudah: number;
}

/** Tabel "sekarang -> sesudah". Usulan yang diajukan ke dana lain tidak dihitung. */
export function akibatWilayah(
  wilayah: readonly { rw: number; nama: string; anggaranLalu: number }[],
  baris: readonly BarisHitungan[],
  isian: Isian,
): WilayahAkibat[] {
  return wilayah.map((w) => ({
    rw: w.rw,
    nama: w.nama,
    sekarang: w.anggaranLalu,
    sesudah: baris
      .filter((b) => b.rw === w.rw && pilihanDari(isian, b.id).hasil === "disetujui")
      .reduce((n, b) => n + b.biaya, 0),
  }));
}

// ---------------------------------------------------------------------------
// Bentrok: apa yang berubah sejak halaman dibuka
// ---------------------------------------------------------------------------

/** Yang dilihat admin saat halaman dibuka, dikirim bersama formulir untuk menjelaskan bentrok. */
export interface Dibaca {
  pagu: number;
  versiBobot: number;
  usulan: { id: string; nama: string; status: StatusUsulan }[];
}

export const dibacaDari = (h: HitunganResmi): Dibaca => ({
  pagu: h.pagu,
  versiBobot: h.versiBobot,
  usulan: h.usulan.map((u) => ({ id: u.id, nama: u.namaSingkat, status: u.status })),
});

/** Membaca Dibaca dari masukan formulir yang tidak dipercaya. null bila bentuknya salah. */
export function bacaDibaca(mentah: unknown): Dibaca | null {
  if (typeof mentah !== "string" || mentah.length > 20_000) return null;
  let j: unknown;
  try {
    j = JSON.parse(mentah);
  } catch {
    return null;
  }
  if (!adalahObjek(j) || typeof j.pagu !== "number" || typeof j.versiBobot !== "number" || !Array.isArray(j.usulan)) return null;
  const usulan: Dibaca["usulan"] = [];
  for (const u of j.usulan.slice(0, 64)) {
    if (!adalahObjek(u) || typeof u.id !== "string" || typeof u.nama !== "string" || !adalahStatusUsulan(u.status)) return null;
    usulan.push({ id: u.id, nama: u.nama.slice(0, 80), status: u.status });
  }
  return { pagu: j.pagu, versiBobot: j.versiBobot, usulan };
}

/** Keadaan sekarang yang cukup untuk menjelaskan bentrok (jawaban galat hitungan_berubah dari SQL). */
export interface KeadaanSekarang {
  pagu: number;
  versiBobot: number;
  usulan: { id: string; namaSingkat: string; status: StatusUsulan }[];
}

/** Membaca keadaan sekarang dari jawaban galat SQL (tidak dipercaya bentuknya). null bila tidak cocok. */
export function bacaKeadaanSekarang(rincian: unknown): KeadaanSekarang | null {
  if (!adalahObjek(rincian) || typeof rincian.pagu !== "number" || typeof rincian.versi_bobot !== "number" || !Array.isArray(rincian.usulan)) {
    return null;
  }
  const usulan: KeadaanSekarang["usulan"] = [];
  for (const u of rincian.usulan) {
    if (!adalahObjek(u) || typeof u.id !== "string" || typeof u.nama_singkat !== "string" || !adalahStatusUsulan(u.status)) return null;
    usulan.push({ id: u.id, namaSingkat: u.nama_singkat, status: u.status });
  }
  return { pagu: rincian.pagu, versiBobot: rincian.versi_bobot, usulan };
}

/** Kalimat tentang apa yang berubah antara yang dibaca admin dan keadaan sekarang. Kosong bila tidak ada yang terlihat berubah. */
export function jelaskanPerubahan(dibaca: Dibaca, sekarang: KeadaanSekarang): string[] {
  const kalimat: string[] = [];
  if (dibaca.pagu !== sekarang.pagu) kalimat.push(`Pagu berubah dari ${rupiah(dibaca.pagu)} menjadi ${rupiah(sekarang.pagu)}.`);
  if (dibaca.versiBobot !== sekarang.versiBobot) kalimat.push("Bobot penilaian diubah.");

  const lama = new Map(dibaca.usulan.map((u) => [u.id, u]));
  const baru = new Set(sekarang.usulan.map((u) => u.id));
  for (const u of sekarang.usulan) {
    const l = lama.get(u.id);
    if (!l) kalimat.push(`${u.namaSingkat} kini ikut dihitung.`);
    else if (l.status !== u.status) {
      kalimat.push(`${u.namaSingkat} sekarang ${TEKS_STATUS_REKOMENDASI[u.status].toLowerCase()} (tadinya ${TEKS_STATUS_REKOMENDASI[l.status].toLowerCase()}).`);
    }
  }
  for (const l of dibaca.usulan) if (!baru.has(l.id)) kalimat.push(`${l.nama} tidak lagi dihitung.`);
  return kalimat;
}

// ---------------------------------------------------------------------------
// Sisa waktu pembatalan
// ---------------------------------------------------------------------------

/** Milidetik tersisa untuk membatalkan; 0 atau kurang berarti sudah lewat. */
export function sisaWaktuBatal(diputuskanPada: string, sekarang: Date): number {
  return new Date(diputuskanPada).getTime() + JAM_BISA_DIBATALKAN * 3_600_000 - sekarang.getTime();
}

/** "tersisa 23 jam 10 menit", "tersisa 12 menit", atau "tersisa kurang dari 1 menit". Bulat ke bawah menurut menit. */
export function teksSisaWaktu(ms: number): string {
  if (ms <= 0) return "sudah lewat";
  const menit = Math.floor(ms / 60_000);
  if (menit < 1) return "tersisa kurang dari 1 menit";
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam === 0) return `tersisa ${menit} menit`;
  return sisaMenit === 0 ? `tersisa ${jam} jam` : `tersisa ${jam} jam ${sisaMenit} menit`;
}
