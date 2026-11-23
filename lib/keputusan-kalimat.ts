// Kalimat tentang keputusan musyawarah untuk layar publik dan admin. Murni, supaya bisa diuji dan dipakai
// komponen server maupun klien. Semua teks menyebut ini RINGKASAN keputusan, bukan pengesahan (PRODUCT.md).
import { rupiah } from "./format.ts";
import type { JumlahHasil, Periode } from "./keputusan-tipe.ts";
import { tanggalPanjang } from "./waktu.ts";

export const namaPeriode = (tahun: number): string => `Tahun Anggaran ${tahun}`;

/** "4 disetujui, 3 dibawa ke periode berikutnya"; yang nol tidak disebut. */
export function rincianHasil(j: JumlahHasil): string {
  const bagian = [
    j.disetujui > 0 ? `${j.disetujui} disetujui` : null,
    j.danaLain > 0 ? `${j.danaLain} diajukan ke dana lain` : null,
    j.dilanjutkan > 0 ? `${j.dilanjutkan} dibawa ke periode berikutnya` : null,
    j.ditolak > 0 ? `${j.ditolak} ditolak` : null,
  ].filter((b): b is string => b !== null);
  return bagian.length === 0 ? "Tidak ada keputusan" : bagian.join(", ");
}

/** "Rp 285 juta dari pagu Rp 300 juta, 4 usulan disetujui". Pagu tidak diketahui: hanya yang terpakai. */
export function ringkasTerpakai(p: Pick<Periode, "terpakai" | "pagu" | "jumlah">): string {
  const dari = p.pagu === null ? "" : ` dari pagu ${rupiah(p.pagu)}`;
  return `${rupiah(p.terpakai)}${dari}, ${p.jumlah.disetujui} usulan disetujui`;
}

/** "20 November 2026" dari tanggal YYYY-MM-DD; null bila tidak ada. */
export function tanggalMusyawarahTeks(tanggal: string | null): string | null {
  // Hanya YYYY-MM-DD yang dipakai: bila ada bagian waktu (data dari sumber lain), dibuang supaya tanggalnya tidak bergeser.
  return tanggal ? tanggalPanjang(`${tanggal.slice(0, 10)}T00:00:00+07:00`) : null;
}

/** Teks cap: "DIPUTUSKAN · 20 November 2026". */
export function teksCap(tanggal: string | null): string {
  const t = tanggalMusyawarahTeks(tanggal);
  return t ? `DIPUTUSKAN · ${t}` : "DIPUTUSKAN";
}

export const CATATAN_BUKAN_PENGESAHAN = "Ringkasan keputusan musyawarah, bukan pengesahan anggaran. Data purwarupa.";

export const TEKS_TANPA_REKOMENDASI = "Periode ini diputuskan sebelum SUARA dipakai, jadi tidak ada rekomendasi untuk dibandingkan.";

export const TEKS_SEJALAN_SEMUA = "Musyawarah mengikuti seluruh rekomendasi.";
