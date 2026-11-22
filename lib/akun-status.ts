// Bentuk hasil Server Action ganti kata sandi (app/akun/aksi.ts) untuk komponen klien (useActionState).
// Dipisah dari file "use server" karena file itu hanya boleh mengekspor fungsi async.

export interface StatusGantiSandi {
  /** Naik setiap ada hasil baru. */
  nomor: number;
  hasil: "belum" | "berhasil" | "galat";
  pesan: string | null;
  /** Galat per kolom: lama, baru, ulangi. */
  galat: Record<string, string>;
  /** True bila sesi habis: klien menawarkan masuk lagi. */
  perluMasuk: boolean;
}

export const STATUS_GANTI_SANDI_AWAL: StatusGantiSandi = {
  nomor: 0,
  hasil: "belum",
  pesan: null,
  galat: {},
  perluMasuk: false,
};
