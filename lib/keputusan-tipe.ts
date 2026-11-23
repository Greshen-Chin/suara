// Bentuk data keputusan musyawarah untuk halaman publik dan admin. Murni (hanya tipe dan pembantu kecil),
// supaya komponen klien dan data cadangan bisa memakainya tanpa menarik "server-only".
import type { Hasil } from "./keputusan.ts";
import type { Bobot, StatusUsulan } from "./seleksi.ts";

export interface JumlahHasil {
  disetujui: number;
  danaLain: number;
  dilanjutkan: number;
  ditolak: number;
}

export interface Periode {
  tahun: number;
  status: "berjalan" | "diputuskan";
  diputuskanPada: string | null;
  /** YYYY-MM-DD. */
  tanggalMusyawarah: string | null;
  catatan: string | null;
  pagu: number | null;
  bobot: Bobot | null;
  /** false untuk periode yang diputuskan sebelum SUARA dipakai: tidak ada rekomendasi untuk dibandingkan. */
  adaRekomendasi: boolean;
  /** anggaran_lalu tiap RW (kunci: nomor RW) sebelum penetapan ini; null bila tidak diketahui. */
  wilayahSebelum: Record<string, number> | null;
  diputuskanOleh: string | null;
  jumlah: JumlahHasil;
  beda: number;
  terpakai: number;
}

export interface KeputusanPublik {
  proposalId: string;
  /** null bila usulannya kelak disembunyikan. */
  judul: string | null;
  namaSingkat: string | null;
  hasil: Hasil;
  alasan: string | null;
  sumberDana: string | null;
  peringkat: number | null;
  jumlahUsulan: number | null;
  skor: number | null;
  statusRekomendasi: StatusUsulan | null;
  biaya: number;
  dukungan: number;
  urgensi: number | null;
  rw: number | null;
  beda: boolean;
  statusSekarang: string;
  selesaiPada: string | null;
  catatanSelesai: string | null;
  biayaRealisasi: number | null;
}

export interface WilayahPeriode {
  rw: number;
  nama: string;
  penduduk: number;
}

export interface DataPeriode {
  /** null = tidak ada periode dengan tahun ini. */
  periode: Periode | null;
  keputusan: KeputusanPublik[];
  wilayah: WilayahPeriode[];
  dataCadangan: boolean;
}

/** Keputusan satu usulan, untuk blok "Diputuskan pada musyawarah" di halaman detail forum. */
export interface KeputusanUsulan {
  tahun: number;
  tanggalMusyawarah: string | null;
  hasil: Hasil;
  alasan: string | null;
  sumberDana: string | null;
  beda: boolean;
  adaRekomendasi: boolean;
  statusSekarang: string;
  selesaiPada: string | null;
  catatanSelesai: string | null;
  biayaRealisasi: number | null;
}

/** Periode sudah diputuskan dan punya potret untuk dibandingkan dengan rekomendasi. */
export const bisaDibandingkan = (p: Periode): boolean => p.status === "diputuskan" && p.adaRekomendasi;

/** Jumlah usulan yang diputuskan pada periode ini. */
export const jumlahKeputusan = (j: JumlahHasil): number => j.disetujui + j.danaLain + j.dilanjutkan + j.ditolak;
