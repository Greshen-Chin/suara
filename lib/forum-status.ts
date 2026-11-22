// Bentuk hasil Server Action forum yang dipakai komponen klien (useActionState), beserta
// keadaan awalnya. Dipisah dari app/forum/aksi.ts karena file "use server" hanya boleh
// mengekspor fungsi async.

export interface StatusKomentar {
  /** Naik setiap ada hasil baru, supaya klien tahu kapan harus mengumumkan dan mengosongkan kolom. */
  nomor: number;
  hasil: "belum" | "terkirim" | "galat";
  pesan: string | null;
  /** Galat yang melekat pada kolom isi. */
  galatIsi: string | null;
  /** True bila sesi habis: klien menyimpan isian dan mengarahkan ke halaman masuk. */
  perluMasuk: boolean;
}

export const STATUS_KOMENTAR_AWAL: StatusKomentar = {
  nomor: 0,
  hasil: "belum",
  pesan: null,
  galatIsi: null,
  perluMasuk: false,
};

export interface StatusSembunyikan {
  nomor: number;
  hasil: "belum" | "berhasil" | "galat";
  pesan: string | null;
  galatAlasan: string | null;
}

export const STATUS_SEMBUNYIKAN_AWAL: StatusSembunyikan = {
  nomor: 0,
  hasil: "belum",
  pesan: null,
  galatAlasan: null,
};
