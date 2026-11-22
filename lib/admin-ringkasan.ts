// Ringkasan halaman /admin: daftar pekerjaan yang menunggu, bukan dasbor metrik. Fungsi murni:
// hanya menghitung dari data yang sudah dibaca, dan tidak mengarang angka yang tidak ada datanya.
import { BATAS_USULAN_OPTIMAL, statusUsulan, type HasilPilih } from "./seleksi.ts";

export interface UsulanRingkas {
  id: string;
  title: string | null;
  status: string;
  rw: number | null;
  created_at: string;
  disembunyikan_pada: string | null;
}

export interface AkunRingkas {
  nama_pengguna: string;
  peran: string;
  aktif: boolean;
  harus_ganti_sandi: boolean;
}

export interface KomentarRingkas {
  created_at: string;
  disembunyikan_pada: string | null;
}

export interface MasukanRingkasan {
  usulan: readonly UsulanRingkas[];
  akun: readonly AkunRingkas[];
  komentar: readonly KomentarRingkas[];
  /** Rekomendasi resmi saat ini; null bila tidak bisa dihitung (mis. lebih dari 16 usulan). */
  hasil: readonly HasilPilih[] | null;
  pagu: number;
  sekarang: Date;
}

export interface Ringkasan {
  menunggu: {
    jumlah: number;
    /** Tiga yang paling lama menunggu. */
    tertua: { id: string; judul: string; rw: number | null; umurHari: number }[];
  };
  hitungan: { jumlah: number; batas: number; penuh: boolean };
  /** Status pagu saat ini; null bila rekomendasi tidak bisa dihitung. */
  anggaran: { pagu: number; terbiayai: number; ditunda: number; tidakTerpilih: number; sisa: number } | null;
  /** Akun warga aktif yang dibuat admin dan kata sandinya belum diganti pemiliknya. */
  belumGantiSandi: { jumlah: number; nama: string[] };
  komentar24Jam: number;
  tersembunyi: { usulan: number; komentar: number };
  /** Ada sesuatu yang perlu dikerjakan admin (usulan menunggu atau akun yang belum ganti kata sandi). */
  adaPekerjaan: boolean;
}

const HARI = 86_400_000;

export function susunRingkasan(m: MasukanRingkasan): Ringkasan {
  const sekarang = m.sekarang.getTime();
  const terlihat = m.usulan.filter((u) => u.disembunyikan_pada === null);

  const menunggu = terlihat
    .filter((u) => u.status === "forum")
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

  const voting = terlihat.filter((u) => u.status === "voting").length;

  let anggaran: Ringkasan["anggaran"] = null;
  if (m.hasil) {
    const bertanda = statusUsulan(m.hasil, "skor");
    const terbiayai = bertanda.filter((h) => h.status === "terpilih");
    anggaran = {
      pagu: m.pagu,
      terbiayai: terbiayai.length,
      ditunda: bertanda.filter((h) => h.status === "ditunda").length,
      tidakTerpilih: bertanda.filter((h) => h.status === "tidak-terpilih").length,
      sisa: m.pagu - terbiayai.reduce((n, h) => n + h.estimatedBudget, 0),
    };
  }

  const belumGanti = m.akun.filter((a) => a.peran === "warga" && a.aktif && a.harus_ganti_sandi);

  return {
    menunggu: {
      jumlah: menunggu.length,
      tertua: menunggu.slice(0, 3).map((u) => ({
        id: u.id,
        judul: u.title ?? "Tanpa judul",
        rw: u.rw,
        umurHari: Math.max(0, Math.floor((sekarang - new Date(u.created_at).getTime()) / HARI)),
      })),
    },
    hitungan: { jumlah: voting, batas: BATAS_USULAN_OPTIMAL, penuh: voting >= BATAS_USULAN_OPTIMAL },
    anggaran,
    belumGantiSandi: { jumlah: belumGanti.length, nama: belumGanti.slice(0, 3).map((a) => a.nama_pengguna) },
    komentar24Jam: m.komentar.filter(
      (k) => k.disembunyikan_pada === null && sekarang - new Date(k.created_at).getTime() <= HARI,
    ).length,
    tersembunyi: {
      usulan: m.usulan.filter((u) => u.disembunyikan_pada !== null).length,
      komentar: m.komentar.filter((k) => k.disembunyikan_pada !== null).length,
    },
    adaPekerjaan: menunggu.length > 0 || belumGanti.length > 0,
  };
}

/** "menunggu 12 hari", "menunggu sejak hari ini". Umur dalam hari penuh. */
export function teksMenunggu(umurHari: number): string {
  if (umurHari <= 0) return "menunggu sejak hari ini";
  return `menunggu ${umurHari} hari`;
}
