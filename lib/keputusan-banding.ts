// Menyusun dua Garis Pagu untuk halaman keputusan: "Rekomendasi SUARA" dan "Keputusan musyawarah", dengan skala yang
// sama, dari POTRET yang disimpan saat penetapan (bukan hitungan ulang). Murni, supaya bisa diuji.
import type { KeputusanPublik, Periode, WilayahPeriode } from "./keputusan-tipe.ts";
import type { ItemPagu, ModePagu } from "./pagu-model.ts";
import { hitungTataPagu } from "./pagu.ts";

export interface DuaBatang {
  pagu: number;
  /** null bila periode ini diputuskan sebelum SUARA dipakai (tidak ada rekomendasi untuk dibandingkan). */
  rekomendasi: ModePagu | null;
  keputusan: ModePagu;
  /** Id usulan yang berbeda antara kedua batang: terpilih tetapi tidak disetujui, atau disetujui tetapi tidak terpilih. */
  beda: ReadonlySet<string>;
}

export const namaRw = (rw: number | null, wilayah: readonly WilayahPeriode[]): string =>
  rw === null ? "Tanpa RW" : (wilayah.find((w) => w.rw === rw)?.nama ?? `RW ${String(rw).padStart(2, "0")}`);

const urutPeringkat = (a: KeputusanPublik, b: KeputusanPublik): number =>
  (a.peringkat ?? Number.MAX_SAFE_INTEGER) - (b.peringkat ?? Number.MAX_SAFE_INTEGER) || b.biaya - a.biaya;

function itemDari(k: KeputusanPublik, wilayah: readonly WilayahPeriode[]): ItemPagu {
  return {
    id: k.proposalId,
    nama: k.namaSingkat ?? k.judul ?? "Usulan",
    judul: k.judul ?? "",
    rw: namaRw(k.rw, wilayah),
    biaya: k.biaya,
    suara: k.dukungan,
    urgensi: k.urgensi ?? 0,
    status: "terpilih",
  };
}

/** null bila datanya tidak konsisten (total melebihi pagu): halaman lalu tidak menggambar batang, bukan galat. */
function susunBatang(kunci: ModePagu["kunci"], item: ItemPagu[], pagu: number): ModePagu | null {
  try {
    return { kunci, ringkasan: "", terpilih: item, tata: hitungTataPagu(item.map((i) => ({ id: i.id, biaya: i.biaya })), pagu), tidakTerbiayai: [], ditunda: [] };
  } catch {
    return null;
  }
}

/**
 * Dua batang untuk periode yang sudah diputuskan. Mengembalikan null bila periode belum diputuskan, tidak punya pagu,
 * atau datanya tidak konsisten.
 */
export function susunDuaBatang(
  periode: Periode,
  keputusan: readonly KeputusanPublik[],
  wilayah: readonly WilayahPeriode[],
): DuaBatang | null {
  if (periode.status !== "diputuskan" || periode.pagu === null || !(periode.pagu > 0)) return null;
  const pagu = periode.pagu;

  const disetujui = keputusan.filter((k) => k.hasil === "disetujui").sort(urutPeringkat);
  const batangKeputusan = susunBatang("rekomendasi", disetujui.map((k) => itemDari(k, wilayah)), pagu);
  if (!batangKeputusan) return null;

  if (!periode.adaRekomendasi) return { pagu, rekomendasi: null, keputusan: batangKeputusan, beda: new Set() };

  const terpilih = keputusan.filter((k) => k.statusRekomendasi === "terpilih").sort(urutPeringkat);
  const batangRekomendasi = susunBatang("rekomendasi", terpilih.map((k) => itemDari(k, wilayah)), pagu);
  if (!batangRekomendasi) return null;

  return {
    pagu,
    rekomendasi: batangRekomendasi,
    keputusan: batangKeputusan,
    beda: new Set(keputusan.filter((k) => k.beda).map((k) => k.proposalId)),
  };
}

export interface BarisAnggaranRw {
  rw: number;
  nama: string;
  penduduk: number;
  /** Jumlah biaya yang disetujui di RW ini pada periode ini. */
  diterima: number;
  /** Rupiah per penduduk, dibulatkan. */
  perPenduduk: number;
  /** Anggaran periode lalu menurut potret sebelum penetapan ini; null bila tidak diketahui. */
  periodeLalu: number | null;
}

export function anggaranTiapRw(
  periode: Pick<Periode, "wilayahSebelum">,
  keputusan: readonly KeputusanPublik[],
  wilayah: readonly WilayahPeriode[],
): BarisAnggaranRw[] {
  return wilayah.map((w) => {
    const diterima = keputusan.filter((k) => k.hasil === "disetujui" && k.rw === w.rw).reduce((n, k) => n + k.biaya, 0);
    return {
      rw: w.rw,
      nama: w.nama,
      penduduk: w.penduduk,
      diterima,
      perPenduduk: w.penduduk > 0 ? Math.round(diterima / w.penduduk) : 0,
      periodeLalu: periode.wilayahSebelum?.[String(w.rw)] ?? null,
    };
  });
}
