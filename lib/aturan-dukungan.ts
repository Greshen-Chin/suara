// Aturan dukungan: siapa boleh mendukung apa, dan apa yang dikatakan tombolnya.
//
// ATURAN INI SEMENTARA. Sekarang: satu dukungan per usulan per warga, boleh mendukung
// banyak usulan, boleh dibatalkan. Pemilik produk masih menimbang jatah terbatas
// (mis. 3 dukungan per warga per periode).
//
// Kalau aturannya berubah, hanya dua tempat yang perlu disentuh:
//   1. fungsi SQL dukung_usulan dan batal_dukung (supabase/migrations/0004_forum.sql)
//      -- penentu yang sebenarnya, tidak bisa dilewati;
//   2. file ini -- hanya untuk menjelaskan keadaannya di layar (tombol aktif, nonaktif, atau teks).
// Tidak ada tempat lain yang boleh mengulang aturannya.

/** Hanya usulan berstatus ini yang bisa didukung. Sesudah diputuskan, dukungan dikunci. */
export const STATUS_BISA_DIDUKUNG = ["forum", "voting"] as const;

export type KeadaanDukungan =
  /** Tombol aktif. */
  | { jenis: "bisa" }
  /** Pengunjung tanpa sesi: tombol menjadi tautan ke halaman masuk. */
  | { jenis: "perlu-masuk" }
  /** Admin tidak memberi dukungan, supaya tidak memengaruhi hasil. */
  | { jenis: "admin" }
  /** Akun warga yang belum tertaut ke data warga. */
  | { jenis: "tanpa-warga" }
  /** Usulan sudah diputuskan atau tidak lagi terbuka. */
  | { jenis: "ditutup" }
  /** Database tidak terjangkau; aksi tulis dimatikan. */
  | { jenis: "data-cadangan" };

export interface MasukanKeadaan {
  pengguna: { peran: "warga" | "admin"; punyaWarga: boolean } | null;
  status: string;
  dataCadangan: boolean;
}

export function bisaDidukung(status: string): boolean {
  return (STATUS_BISA_DIDUKUNG as readonly string[]).includes(status);
}

export function tentukanKeadaanDukungan({
  pengguna,
  status,
  dataCadangan,
}: MasukanKeadaan): KeadaanDukungan {
  if (!bisaDidukung(status)) return { jenis: "ditutup" };
  if (dataCadangan) return { jenis: "data-cadangan" };
  if (!pengguna) return { jenis: "perlu-masuk" };
  if (pengguna.peran === "admin") return { jenis: "admin" };
  if (!pengguna.punyaWarga) return { jenis: "tanpa-warga" };
  return { jenis: "bisa" };
}

/** Kalimat penjelasan untuk keadaan yang tidak memperbolehkan mendukung. */
export function penjelasanDukungan(keadaan: KeadaanDukungan): string | null {
  switch (keadaan.jenis) {
    case "admin":
      return "Admin desa tidak memberi dukungan, supaya hasilnya tidak terpengaruh.";
    case "tanpa-warga":
      return "Akun Anda belum tertaut ke data warga, jadi belum bisa memberi dukungan. Hubungi admin desa.";
    case "ditutup":
      return "Dukungan ditutup karena usulan ini sudah diputuskan.";
    case "data-cadangan":
      return "Dukungan dimatikan sementara karena data tidak bisa dimuat. Coba lagi nanti.";
    default:
      return null;
  }
}
