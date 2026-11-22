// Kalimat galat dan penyusun hasil untuk Server Action admin (app/admin/aksi.ts). Hanya untuk server.
// Mesin panggilan (panggilFungsi, penguraian jawaban SQL, batas waktu) ada di lib/forum-aksi.ts dan
// dipakai bersama; di sini hanya apa yang khusus admin: kode galat baru dan kalimatnya.
import "server-only";
import { pesanGalat, type HasilRpc, type KodeGalat } from "./forum-aksi";
import { STATUS_AKSI_AWAL, type StatusAksi } from "./admin-status";
import { rupiahRinci } from "./format";
import { tanggalDanJam, lamaTunggu } from "./waktu";

/** Apa yang sedang dikerjakan; menentukan kalimat untuk kode galat yang sama. */
export type KonteksAdmin =
  | "status"
  | "pagu"
  | "bobot"
  | "tampilkan"
  | "buat-akun"
  | "atur-sandi"
  | "atur-aktif"
  | "ganti-sandi";

type Gagal = Extract<HasilRpc, { ok: false }>;

const angka = (v: unknown): number | null => (typeof v === "number" ? v : null);
const teks = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** "Pagu sudah diubah admin lain pada 14:05 WIB." Jam dari rincian jawaban SQL. */
function jamUbah(h: Gagal): string {
  const iso = teks(h.rincian?.diubah_pada);
  return iso ? tanggalDanJam(iso) : "baru saja";
}

export function pesanGalatAdmin(kode: KodeGalat, konteks: KonteksAdmin, h: Gagal): string {
  switch (kode) {
    case "bukan_admin":
      return "Hanya admin desa yang bisa melakukan ini.";
    case "tidak_ditemukan":
      if (konteks === "buat-akun") return "Data warga ini tidak ditemukan. Cari lagi dan pilih ulang.";
      if (konteks === "atur-sandi" || konteks === "atur-aktif") return "Akun ini tidak ditemukan. Mungkin sudah dihapus.";
      return "Usulan atau konten ini sudah tidak ada. Muat ulang halaman.";
    case "disembunyikan":
      return "Usulan ini disembunyikan, jadi statusnya tidak bisa diubah. Tampilkan kembali dulu di Moderasi.";
    case "bentrok":
      if (konteks === "pagu") return `Pagu sudah diubah admin lain pada ${jamUbah(h)}. Muat ulang untuk melihat nilai terbaru.`;
      if (konteks === "bobot") return `Bobot sudah diubah admin lain pada ${jamUbah(h)}. Muat ulang untuk melihat nilai terbaru.`;
      return `Status usulan ini sudah diubah admin lain${teks(h.rincian?.status_sekarang) ? ` menjadi “${teks(h.rincian?.status_sekarang)}”` : ""}. Muat ulang halaman untuk melihat keadaan terbaru.`;
    case "transisi_tidak_diizinkan":
      return "Perpindahan status ini tidak tersedia di halaman admin. Penetapan hasil musyawarah dilakukan di halaman Keputusan.";
    case "batas_voting": {
      const batas = angka(h.rincian?.batas) ?? 16;
      return konteks === "tampilkan"
        ? `Hitungan anggaran sudah berisi ${batas} usulan, batas yang bisa dihitung SUARA sekaligus. Kembalikan satu usulan ke pembahasan dulu, lalu tampilkan lagi usulan ini.`
        : `Hitungan anggaran sudah berisi ${batas} usulan, batas yang bisa dihitung SUARA sekaligus. Kembalikan satu usulan ke pembahasan dulu, lalu coba lagi.`;
    }
    case "tanpa_rw":
      return "Usulan ini belum punya RW, jadi belum bisa dihitung dalam anggaran.";
    case "tidak_berubah":
      if (konteks === "pagu") return "Pagu masih sama dengan yang berlaku. Ubah angkanya dulu.";
      if (konteks === "bobot") return "Bobot masih sama dengan yang berlaku. Ubah angkanya dulu.";
      return "Akun ini sudah dalam keadaan itu. Muat ulang halaman.";
    case "tidak_disembunyikan":
      return "Konten ini sudah tampil kembali. Muat ulang halaman.";
    case "diri_sendiri":
      return konteks === "atur-sandi"
        ? "Untuk mengganti kata sandi Anda sendiri, buka halaman Akun."
        : "Anda tidak bisa menonaktifkan akun Anda sendiri.";
    case "admin_terakhir":
      return "Ini admin aktif terakhir. Desa harus punya setidaknya satu admin aktif.";
    case "nama_dipakai":
      return "Nama pengguna ini sudah dipakai. Coba yang lain.";
    case "warga_sudah_punya_akun":
      return "Warga ini sudah punya akun. Cari warga lain.";
    case "batas_laju":
      return `Anda sudah membuat 30 akun dalam satu jam terakhir. Akun berikutnya bisa dibuat ${lamaTunggu(h.ulangDetik ?? 3600)} lagi.`;
    case "tidak_valid":
      return "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.";
    default:
      // belum_masuk, akun_tidak_aktif, gangguan, dan kode forum lainnya: kalimat bersama.
      return pesanGalat(kode, "sembunyikan", h.ulangDetik);
  }
}

/** Nama bidang dari fungsi SQL -> nama kolom di formulir (name). */
const BIDANG_KE_KOLOM: Record<string, string> = {
  alasan_urgensi: "alasanUrgensi",
  nama_singkat: "namaSingkat",
  nama_pengguna: "namaPengguna",
  kata_sandi: "kataSandi",
};

const PESAN_BIDANG: Record<string, string> = {
  urgensi: "Pilih nilai urgensi, 1 sampai 10.",
  alasan_urgensi: "Tulis alasan urgensinya, 20 sampai 500 karakter.",
  alasan: "Tulis alasannya, 10 sampai 500 karakter.",
  nama_singkat: "Nama singkat harus 2 sampai 24 karakter.",
  pagu: "Pagu harus antara Rp 10 juta dan Rp 10 miliar.",
  jumlah: "Jumlah bobot harus tepat 100.",
  popularitas: "Isi bilangan bulat 0 sampai 100.",
  pemerataan: "Isi bilangan bulat 0 sampai 100.",
  nama_pengguna: "Nama pengguna harus 3 sampai 32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.",
  kata_sandi: "Kata sandi tidak sah. Buat ulang kata sandinya.",
};

/** Nama bidang yang dikeluhkan SQL, sebagai nama kolom formulir. */
export const kolomDariBidang = (bidang: string): string => BIDANG_KE_KOLOM[bidang] ?? bidang;

/** Nilai yang kini berlaku bila admin lain mengubah lebih dulu, untuk ditampilkan di samping isian. */
function ringkasBentrok(konteks: KonteksAdmin, h: Gagal): string | null {
  if (konteks === "pagu") {
    const pagu = angka(h.rincian?.pagu);
    return pagu === null ? null : rupiahRinci(pagu);
  }
  if (konteks === "bobot") {
    const p = angka(h.rincian?.popularitas);
    const u = angka(h.rincian?.urgensi);
    const m = angka(h.rincian?.pemerataan);
    return p === null || u === null || m === null ? null : `popularitas ${p}, urgensi ${u}, pemerataan ${m}`;
  }
  return null;
}

/** Hasil galat untuk useActionState: pesan, galat per kolom, bentrok, dan penanda sesi habis. */
export function hasilGalat(nomor: number, konteks: KonteksAdmin, h: Gagal): StatusAksi {
  const pesan = pesanGalatAdmin(h.kode, konteks, h);
  const galatKolom: Record<string, string> = {};
  let galatAlasan: string | null = null;

  if (h.kode === "tidak_valid" && h.bidang) {
    const kalimat = PESAN_BIDANG[h.bidang] ?? pesan;
    if (h.bidang === "alasan") galatAlasan = kalimat;
    else galatKolom[kolomDariBidang(h.bidang)] = kalimat;
  }
  if (h.kode === "nama_dipakai") galatKolom.namaPengguna = pesan;

  const ringkas = h.kode === "bentrok" ? ringkasBentrok(konteks, h) : null;
  return {
    ...STATUS_AKSI_AWAL,
    nomor,
    hasil: "galat",
    pesan,
    galatAlasan,
    galatKolom,
    perluMasuk: h.kode === "belum_masuk",
    bentrok: h.kode === "bentrok" ? { jam: jamUbah(h), ringkas: ringkas ?? "" } : null,
  };
}

/** Galat sebelum sampai ke database (sesi, peran, validasi), dengan kalimat yang sama. */
export function galatSederhana(
  nomor: number,
  kode: "belum_masuk" | "bukan_admin" | "gangguan" | "akun_tidak_aktif" | "tidak_ditemukan",
  konteks: KonteksAdmin,
  tambahan: Partial<Pick<StatusAksi, "galatKolom" | "galatAlasan">> = {},
): StatusAksi {
  const pesan = pesanGalatAdmin(kode, konteks, { ok: false, kode });
  return {
    ...STATUS_AKSI_AWAL,
    nomor,
    hasil: "galat",
    pesan,
    perluMasuk: kode === "belum_masuk",
    ...tambahan,
  };
}

export function hasilBerhasil(nomor: number, pesan: string): StatusAksi {
  return { ...STATUS_AKSI_AWAL, nomor, hasil: "berhasil", pesan };
}
