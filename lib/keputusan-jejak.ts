// Filter dan "muat lebih banyak" untuk jejak keputusan lengkap di /keputusan. Keadaannya hidup di alamat
// (?jenis=moderation&batas=40), jadi bisa dibagikan dan tombol kembali bekerja. Murni.
import { JENIS_LOG, type JenisLog } from "./jenis-log.ts";

export const BATAS_JEJAK_AWAL = 20;
export const BATAS_JEJAK_TAMBAH = 20;
export const BATAS_JEJAK_MAKS = 200;

export interface FilterJejak {
  /** null = semua jenis. */
  jenis: JenisLog | null;
  /** Jumlah catatan yang ditampilkan; naik 20 setiap "Muat lebih banyak". */
  batas: number;
}

export const FILTER_JEJAK_AWAL: FilterJejak = { jenis: null, batas: BATAS_JEJAK_AWAL };

type Param = string | string[] | undefined;
const pertama = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);

/** Membaca searchParams apa adanya dari pengunjung; nilai yang tidak dikenal jatuh ke bawaan. */
export function bacaFilterJejak(params: Record<string, Param>): FilterJejak {
  const jenis = pertama(params.jenis);
  const batas = Number(pertama(params.batas));
  return {
    jenis: (JENIS_LOG as readonly string[]).includes(jenis ?? "") ? (jenis as JenisLog) : null,
    batas: Number.isInteger(batas) ? Math.min(Math.max(batas, BATAS_JEJAK_AWAL), BATAS_JEJAK_MAKS) : BATAS_JEJAK_AWAL,
  };
}

/** Query string tanpa nilai bawaan, mis. "?jenis=decision&batas=40". Kosong bila semua bawaan. */
export function bangunQueryJejak(filter: FilterJejak, ubah: Partial<FilterJejak> = {}): string {
  const f = { ...filter, ...ubah };
  const q = new URLSearchParams();
  if (f.jenis !== null) q.set("jenis", f.jenis);
  if (f.batas > BATAS_JEJAK_AWAL) q.set("batas", String(f.batas));
  const teks = q.toString();
  return teks ? `?${teks}` : "";
}
