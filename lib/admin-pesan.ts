// Pesan konfirmasi setelah aksi admin berhasil. Aksi yang mengubah status, moderasi, atau akun
// mengarahkan kembali ke daftar dengan `?berhasil=<kode>&id=<uuid>`; daftar membacanya di sini dan
// menyusun kalimatnya SENDIRI. Yang datang dari URL hanya kode dari daftar tertutup dan sebuah UUID,
// tidak pernah teks, jadi tautan yang dibagikan tidak bisa dipakai untuk memunculkan kalimat apa pun.
import { adalahUuid } from "./usulan-skema.ts";

export const KODE_BERHASIL = [
  "voting",
  "tidak-dilanjutkan",
  "kembali",
  "sembunyi",
  "tampil",
  "nonaktif",
  "aktif",
] as const;
export type KodeBerhasil = (typeof KODE_BERHASIL)[number];

export interface Berhasil {
  kode: KodeBerhasil;
  id: string;
}

type Param = string | string[] | undefined;
const pertama = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);

export function bacaBerhasil(params: Record<string, Param>): Berhasil | null {
  const kode = pertama(params.berhasil);
  const id = pertama(params.id);
  if (!(KODE_BERHASIL as readonly string[]).includes(kode ?? "") || !adalahUuid(id)) return null;
  return { kode: kode as KodeBerhasil, id };
}

export function urlBerhasil(dasar: string, kode: KodeBerhasil, id: string): string {
  return `${dasar}?berhasil=${kode}&id=${id}`;
}

export interface PesanBerhasil {
  /** Kalimat utama, mis. "“Lampu gang” masuk hitungan anggaran." */
  ringkas: string;
  /** Di mana jejak keputusan bisa dilihat. null untuk perubahan akun (jejaknya tertutup). */
  jejak: { halamanUtama: boolean; riwayatUsulan: boolean } | null;
}

const kutip = (nama: string | null): string => (nama ? `“${nama}”` : "Usulan ini");

/** `nama`: judul usulan (atau nama pengguna untuk aksi akun) bila ditemukan di daftar. */
export function susunPesanBerhasil(b: Berhasil, nama: string | null): PesanBerhasil {
  switch (b.kode) {
    case "voting":
      return { ringkas: `${kutip(nama)} masuk hitungan anggaran.`, jejak: { halamanUtama: true, riwayatUsulan: true } };
    case "tidak-dilanjutkan":
      return { ringkas: `${kutip(nama)} tidak dilanjutkan. Usulan tetap bisa dibaca warga.`, jejak: { halamanUtama: true, riwayatUsulan: true } };
    case "kembali":
      return {
        ringkas: `${kutip(nama)} kembali ke pembahasan dan tidak lagi dihitung dalam anggaran.`,
        jejak: { halamanUtama: true, riwayatUsulan: true },
      };
    case "sembunyi":
      return { ringkas: "Konten disembunyikan dari publik.", jejak: { halamanUtama: true, riwayatUsulan: true } };
    case "tampil":
      return { ringkas: "Konten tampil kembali untuk publik.", jejak: { halamanUtama: true, riwayatUsulan: true } };
    case "nonaktif":
      return { ringkas: `Akun ${nama ?? "ini"} dinonaktifkan dan keluar dari semua perangkat.`, jejak: null };
    case "aktif":
      return { ringkas: `Akun ${nama ?? "ini"} aktif kembali. Pemiliknya bisa masuk lagi.`, jejak: null };
  }
}

/** Kalimat jejak: "Tersimpan. Jejaknya tampil di halaman utama dan di riwayat usulan." Bagian tautan dipisah. */
export function bagianJejak(j: NonNullable<PesanBerhasil["jejak"]>): string[] {
  const tempat: string[] = [];
  if (j.halamanUtama) tempat.push("halaman utama");
  if (j.riwayatUsulan) tempat.push("riwayat usulan");
  return tempat;
}
