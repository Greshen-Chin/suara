// Bentuk hasil permintaan saran urgensi yang dipakai komponen klien. Dipisah dari app/admin/saran-aksi.ts
// karena file "use server" hanya boleh mengekspor fungsi async.
import type { AlasanSaran, Keyakinan } from "./saran-urgensi.ts";

export interface SaranUi {
  id: string;
  nilai: number;
  tingkat: number;
  keyakinan: Keyakinan;
  alasan: AlasanSaran[];
  pertanyaan: string[];
  model: string;
  /** true bila memakai saran yang sudah tersimpan (isi usulan sama), tanpa memanggil AI lagi. */
  dariSimpanan: boolean;
}

export type KodeSaranGagal =
  | "nonaktif"
  | "belum_masuk"
  | "bukan_admin"
  | "urgensi_kosong"
  | "tidak_berlaku"
  | "batas_laju"
  | "batas_harian"
  | "sedang_diproses"
  | "kuota"
  | "batas_waktu"
  | "jaringan"
  | "layanan"
  | "diblokir"
  | "jawaban_buruk"
  | "gangguan";

export interface GagalSaranUi {
  ok: false;
  kode: KodeSaranGagal;
  /** Satu kalimat yang jujur untuk admin. */
  pesan: string;
  /** Tombol "Coba lagi" masuk akal. */
  bisaUlang: boolean;
  /** Untuk batas_laju dan batas_harian: berapa detik lagi boleh mencoba. */
  ulangDetik?: number;
  perluMasuk?: boolean;
}

export type HasilSaranUi = { ok: true; saran: SaranUi } | GagalSaranUi;

/** Kalimat galat ketika saran yang terbuka sudah basi. Komponen mengenalinya untuk menutup saran yang tidak berlaku. */
export const PESAN_SARAN_BASI =
  "Saran AI yang terbuka sudah tidak berlaku, karena isi usulan berubah. Minta saran lagi, atau lanjutkan tanpa saran.";
