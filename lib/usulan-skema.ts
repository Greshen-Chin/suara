// Aturan isian usulan, komentar, dan alasan moderasi. SATU sumber untuk klien (umpan balik
// cepat) dan server (penentu). Angka batasnya sama dengan yang diperiksa fungsi SQL di
// supabase/migrations/0004_forum.sql; kalau satu diubah, ubah keduanya.
import { parseRupiah } from "./rupiah.ts";

export const BATAS = {
  judul: { min: 8, maks: 80 },
  namaSingkat: { min: 2, maks: 24 },
  deskripsi: { min: 20, maks: 1500 },
  // Rp 100 ribu menangkap salah ketik "85" untuk "85 juta"; Rp 5 miliar jauh di atas pagu
  // desa tetapi masih memuat proyek besar. Alasan lengkap di docs/forum.md.
  biaya: { min: 100_000, maks: 5_000_000_000 },
  komentar: { maks: 1000 },
  alasan: { min: 10, maks: 500 },
} as const;

export const KATEGORI = [
  "infrastruktur",
  "kesehatan",
  "pendidikan",
  "lingkungan",
  "ekonomi",
  "sosial",
  "fasilitas",
] as const;
export type Kategori = (typeof KATEGORI)[number];

export const LABEL_KATEGORI: Record<Kategori, string> = {
  infrastruktur: "Infrastruktur",
  kesehatan: "Kesehatan",
  pendidikan: "Pendidikan",
  lingkungan: "Lingkungan",
  ekonomi: "Ekonomi",
  sosial: "Sosial",
  fasilitas: "Fasilitas",
};

export function adalahKategori(nilai: unknown): nilai is Kategori {
  return typeof nilai === "string" && (KATEGORI as readonly string[]).includes(nilai);
}

export type Bidang = "judul" | "namaSingkat" | "deskripsi" | "kategori" | "rw" | "biaya";

export interface MasukanUsulan {
  judul: string;
  namaSingkat: string;
  deskripsi: string;
  kategori: string;
  rw: string;
  biaya: string;
}

export interface UsulanValid {
  judul: string;
  namaSingkat: string | null;
  deskripsi: string;
  kategori: Kategori;
  rw: number;
  biaya: number;
}

export type GalatUsulan = Partial<Record<Bidang, string>>;
export type HasilPeriksaUsulan =
  | { ok: true; data: UsulanValid }
  | { ok: false; galat: GalatUsulan };

/** Panjang dalam titik kode, sama dengan char_length() di Postgres (emoji dihitung satu). */
export const panjang = (teks: string): number => Array.from(teks).length;

/**
 * Membuang karakter kontrol (NUL membuat Postgres menolak teks) dan menyeragamkan
 * baris baru. `baris` = true mempertahankan baris baru (deskripsi, komentar);
 * false menjadikan semuanya satu baris (judul).
 */
export function rapikanTeks(teks: string, baris: boolean): string {
  const bersih = teks
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return (baris ? bersih.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n") : bersih.replace(/\s+/g, " ")).trim();
}

const antara = (n: number, { min, maks }: { min: number; maks: number }) => n >= min && n <= maks;

function rentang(nama: string, { min, maks }: { min: number; maks: number }): string {
  return `${nama} harus ${min} sampai ${maks} karakter.`;
}

export function periksaUsulan(
  masukan: MasukanUsulan,
  rwTersedia?: readonly number[],
): HasilPeriksaUsulan {
  const galat: GalatUsulan = {};

  const judul = rapikanTeks(masukan.judul, false);
  if (!antara(panjang(judul), BATAS.judul)) {
    galat.judul =
      judul === ""
        ? "Tulis judul usulan."
        : panjang(judul) < BATAS.judul.min
          ? `Judul terlalu pendek. Tulis minimal ${BATAS.judul.min} karakter.`
          : `Judul terlalu panjang. Ringkas sampai ${BATAS.judul.maks} karakter.`;
  }

  const singkatMentah = rapikanTeks(masukan.namaSingkat, false);
  const namaSingkat = singkatMentah === "" ? null : singkatMentah;
  if (namaSingkat !== null && !antara(panjang(namaSingkat), BATAS.namaSingkat)) {
    galat.namaSingkat = rentang("Nama singkat", BATAS.namaSingkat);
  }

  const deskripsi = rapikanTeks(masukan.deskripsi, true);
  if (!antara(panjang(deskripsi), BATAS.deskripsi)) {
    galat.deskripsi =
      panjang(deskripsi) < BATAS.deskripsi.min
        ? `Ceritakan lebih lengkap: apa masalahnya, siapa yang terdampak, dan di mana. Minimal ${BATAS.deskripsi.min} karakter.`
        : `Deskripsi terlalu panjang. Ringkas sampai ${BATAS.deskripsi.maks} karakter.`;
  }

  if (!adalahKategori(masukan.kategori)) galat.kategori = "Pilih kategori.";

  const rw = Number(masukan.rw);
  if (!Number.isInteger(rw) || rw < 1 || (rwTersedia && !rwTersedia.includes(rw))) {
    galat.rw = "Pilih RW lokasi usulan.";
  }

  const biaya = parseRupiah(masukan.biaya);
  if (!biaya.ok) galat.biaya = biaya.pesan;
  else if (biaya.nilai < BATAS.biaya.min) {
    galat.biaya = "Biaya minimal Rp 100.000. Kalau maksudnya jutaan, tulis misalnya 85 juta.";
  } else if (biaya.nilai > BATAS.biaya.maks) {
    galat.biaya = "Biaya maksimal Rp 5 miliar. Periksa jumlah nolnya.";
  }

  if (Object.keys(galat).length > 0) return { ok: false, galat };
  return {
    ok: true,
    data: {
      judul,
      namaSingkat,
      deskripsi,
      kategori: masukan.kategori as Kategori,
      rw,
      biaya: (biaya as { nilai: number }).nilai,
    },
  };
}

export type HasilPeriksaTeks = { ok: true; isi: string } | { ok: false; pesan: string };

export function periksaKomentar(isi: string): HasilPeriksaTeks {
  const rapi = rapikanTeks(isi, true);
  if (rapi === "") return { ok: false, pesan: "Tulis komentar dulu." };
  if (panjang(rapi) > BATAS.komentar.maks) {
    return { ok: false, pesan: `Komentar terlalu panjang. Maksimal ${BATAS.komentar.maks} karakter.` };
  }
  return { ok: true, isi: rapi };
}

export function periksaAlasan(isi: string): HasilPeriksaTeks {
  const rapi = rapikanTeks(isi, true);
  if (panjang(rapi) < BATAS.alasan.min) {
    return { ok: false, pesan: `Tulis alasannya, minimal ${BATAS.alasan.min} karakter. Alasan ini bisa dibaca semua warga.` };
  }
  if (panjang(rapi) > BATAS.alasan.maks) {
    return { ok: false, pesan: `Alasan terlalu panjang. Maksimal ${BATAS.alasan.maks} karakter.` };
  }
  return { ok: true, isi: rapi };
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const adalahUuid = (nilai: unknown): nilai is string =>
  typeof nilai === "string" && POLA_UUID.test(nilai);
