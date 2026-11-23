// Pesan konfirmasi sesudah penetapan, pembatalan, atau penandaan selesai di /admin/keputusan. Mengikuti pola
// lib/admin-pesan.ts: aksi mengarahkan kembali dengan `?berhasil=<kode>&tahun=<n>[&id=<uuid>]`, dan halaman
// menyusun kalimatnya SENDIRI. Yang datang dari URL hanya kode dari daftar tertutup, bilangan bulat, dan UUID,
// tidak pernah teks, jadi tautan yang dibagikan tidak bisa dipakai untuk memunculkan kalimat apa pun.
import { adalahUuid } from "./usulan-skema.ts";

export const KODE_BERHASIL_KEPUTUSAN = ["ditetapkan", "dibatalkan", "selesai"] as const;
export type KodeBerhasilKeputusan = (typeof KODE_BERHASIL_KEPUTUSAN)[number];

export interface BerhasilKeputusan {
  kode: KodeBerhasilKeputusan;
  tahun: number | null;
  id: string | null;
}

type Param = string | string[] | undefined;
const pertama = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);

export function bacaTahun(nilai: string | undefined): number | null {
  if (nilai === undefined || !/^\d{4}$/.test(nilai)) return null;
  const n = Number(nilai);
  return n >= 2000 && n <= 2200 ? n : null;
}

export function bacaBerhasilKeputusan(params: Record<string, Param>): BerhasilKeputusan | null {
  const kode = pertama(params.berhasil);
  if (!(KODE_BERHASIL_KEPUTUSAN as readonly string[]).includes(kode ?? "")) return null;
  const id = pertama(params.id);
  return { kode: kode as KodeBerhasilKeputusan, tahun: bacaTahun(pertama(params.tahun)), id: adalahUuid(id) ? id : null };
}

export function urlBerhasilKeputusan(kode: KodeBerhasilKeputusan, o: { tahun?: number; id?: string } = {}): string {
  const q = new URLSearchParams({ berhasil: kode });
  if (o.tahun !== undefined) q.set("tahun", String(o.tahun));
  if (o.id !== undefined) q.set("id", o.id);
  return `/admin/keputusan?${q.toString()}`;
}
