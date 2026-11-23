// Bentuk hasil Server Action admin yang dipakai komponen klien (useActionState), beserta keadaan
// awalnya. Dipisah dari app/admin/aksi.ts karena file "use server" hanya boleh mengekspor fungsi async.
import type { StatusAlasan } from "./forum-status.ts";

/**
 * Hasil satu aksi admin. Memperluas StatusAlasan (dipakai dialog alasan bersama forum dan admin):
 * `galatAlasan` tetap ada, ditambah galat per kolom dan keadaan khusus admin.
 */
export interface StatusAksi extends StatusAlasan {
  /** Galat yang melekat pada kolom formulir; kuncinya nama kolom (name). */
  galatKolom: Record<string, string>;
  /** True bila sesi habis: klien menawarkan masuk lagi dan isian tidak hilang. */
  perluMasuk: boolean;
  /** Admin lain mengubah lebih dulu. `ringkas` menyebut nilai terbaru, `jam` kapan diubah. */
  bentrok: { jam: string; ringkas: string } | null;
  /**
   * HANYA untuk layar kata sandi yang tampil sekali. Hidup di memori komponen; tidak pernah
   * masuk URL, sessionStorage, log server, atau cache.
   */
  rahasia: { namaPengguna: string; kataSandi: string } | null;
  /** Tautan yang menyertai pesan, mis. ke hasil yang sudah ditetapkan admin lain. */
  tautan: { href: string; teks: string } | null;
}

export const STATUS_AKSI_AWAL: StatusAksi = {
  nomor: 0,
  hasil: "belum",
  pesan: null,
  galatAlasan: null,
  galatKolom: {},
  perluMasuk: false,
  bentrok: null,
  rahasia: null,
  tautan: null,
};

/** Hasil pencarian warga yang belum punya akun (langkah pertama membuat akun). */
export interface WargaBebas {
  id: string;
  nomor: number;
  nama: string;
  rt: number;
  rw: number;
}

export type HasilCariWarga = { ok: true; warga: WargaBebas[] } | { ok: false; pesan: string; perluMasuk: boolean };

export type HasilCekNama =
  | { ok: true; tersedia: boolean; saran: string | null }
  | { ok: false; pesan: string };
