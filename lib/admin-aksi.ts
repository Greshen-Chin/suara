// Kalimat galat dan penyusun hasil untuk Server Action admin (app/admin/aksi.ts). Hanya untuk server.
// Mesin panggilan (panggilFungsi, penguraian jawaban SQL, batas waktu) ada di lib/forum-aksi.ts dan
// dipakai bersama; di sini hanya apa yang khusus admin: kode galat baru dan kalimatnya.
import "server-only";
import { pesanGalat, type HasilRpc, type KodeGalat } from "./forum-aksi";
import { STATUS_AKSI_AWAL, type StatusAksi } from "./admin-status";
import { PESAN_SARAN_BASI } from "./saran-urgensi-tipe";
import { rupiah, rupiahRinci } from "./format";
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
  | "ganti-sandi"
  | "tetapkan"
  | "batal-penetapan"
  | "selesai";

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
      if (konteks === "tetapkan" || konteks === "batal-penetapan") {
        return "Periode ini sudah berubah sejak halaman dibuka (penetapannya dibatalkan atau dibuka lagi). Muat ulang untuk melihat keadaan terbaru.";
      }
      if (konteks === "pagu") return `Pagu sudah diubah admin lain pada ${jamUbah(h)}. Muat ulang untuk melihat nilai terbaru.`;
      if (konteks === "bobot") return `Bobot sudah diubah admin lain pada ${jamUbah(h)}. Muat ulang untuk melihat nilai terbaru.`;
      return `Status usulan ini sudah diubah admin lain${teks(h.rincian?.status_sekarang) ? ` menjadi “${teks(h.rincian?.status_sekarang)}”` : ""}. Muat ulang halaman untuk melihat keadaan terbaru.`;
    case "transisi_tidak_diizinkan":
      return konteks === "selesai"
        ? "Hanya usulan yang disetujui atau diajukan ke dana lain yang bisa ditandai selesai."
        : "Perpindahan status ini tidak tersedia di halaman Usulan. Hasil musyawarah ditetapkan di halaman Keputusan.";
    case "batas_voting": {
      const batas = angka(h.rincian?.batas) ?? 16;
      if (konteks === "batal-penetapan") {
        const jumlah = angka(h.rincian?.jumlah) ?? batas + 1;
        const pulih = angka(h.rincian?.dipulihkan) ?? 0;
        return `Membatalkan penetapan mengembalikan ${pulih} usulan ke hitungan, sehingga hitungan berisi ${jumlah} usulan, melebihi batas ${batas}. Kembalikan ${jumlah - batas} usulan dari periode berikutnya ke pembahasan (di halaman Usulan), lalu coba lagi.`;
      }
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
    case "sudah_ditetapkan": {
      const tahun = angka(h.rincian?.tahun);
      const oleh = teks(h.rincian?.oleh);
      const pada = teks(h.rincian?.pada);
      return `Keputusan${tahun ? ` Tahun Anggaran ${tahun}` : ""} sudah ditetapkan${oleh ? ` oleh ${oleh}` : ""}${pada ? ` pada ${tanggalDanJam(pada)}` : ""}. Isian di halaman ini tidak dipakai.`;
    }
    case "hitungan_berubah":
      return "Hitungan anggaran berubah sejak halaman ini dibuka. Muat ulang untuk melihat yang terbaru. Pilihan Anda tetap tersimpan di perangkat ini.";
    case "melebihi_pagu": {
      const pagu = angka(h.rincian?.pagu);
      const lebih = angka(h.rincian?.kelebihan);
      return pagu !== null && lebih !== null
        ? `Total yang disetujui melebihi pagu ${rupiah(pagu)} sebesar ${rupiah(lebih)}. Kurangi yang disetujui, lalu coba lagi.`
        : "Total yang disetujui melebihi pagu. Kurangi yang disetujui, lalu coba lagi.";
    }
    case "tidak_ada_usulan":
      return "Tidak ada usulan dalam hitungan anggaran, jadi belum ada yang bisa ditetapkan.";
    case "tahun_berikut_ada":
      return "Periode tahun berikutnya sudah ada di database, jadi penetapan tidak bisa dilanjutkan. Hubungi pemilik proyek.";
    case "tidak_bisa_dibatalkan":
      return "Periode ini tidak punya penetapan yang bisa dibatalkan.";
    case "bukan_terakhir":
      return "Hanya penetapan yang terakhir yang bisa dibatalkan. Batalkan dulu penetapan tahun yang lebih baru.";
    case "lewat_batas":
      return "Sudah lewat 24 jam sejak penetapan, jadi tidak bisa dibatalkan lagi. Keputusan tetap.";
    case "sudah_dikerjakan":
      return "Sudah ada usulan dari penetapan ini yang ditandai selesai dikerjakan, jadi penetapan tidak bisa dibatalkan.";
    case "saran_tidak_valid":
      return PESAN_SARAN_BASI;
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
  tanggal: "Isi tanggal musyawarah. Tanggalnya tidak boleh di masa depan.",
  biaya_realisasi: "Biaya realisasi harus berupa rupiah bulat yang positif, atau biarkan kosong.",
  tahun: "Periode ini tidak dikenal. Muat ulang halaman.",
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

  if (h.kode === "tidak_valid" && h.bidang === "butir") {
    // Satu baris di lembar kerja keputusan: kuncinya "<kolom>-<id usulan>", kolom: hasil, alasan, sumber.
    const id = teks(h.rincian?.id);
    const kolom = teks(h.rincian?.kolom);
    if (id && kolom) {
      galatKolom[`${kolom === "sumber_dana" ? "sumber" : kolom}-${id}`] =
        kolom === "alasan"
          ? "Alasan wajib diisi, 20 sampai 500 karakter."
          : kolom === "sumber_dana"
            ? "Tulis sumber dananya, 3 sampai 80 karakter."
            : "Pilih salah satu hasil.";
    }
  } else if (h.kode === "tidak_valid" && h.bidang) {
    const kalimat =
      h.bidang === "catatan"
        ? konteks === "selesai"
          ? "Tulis catatannya, 10 sampai 500 karakter."
          : "Tulis catatan musyawarah, 20 sampai 1.000 karakter."
        : (PESAN_BIDANG[h.bidang] ?? pesan);
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
    tautan:
      h.kode === "sudah_ditetapkan" && angka(h.rincian?.tahun) !== null
        ? { href: `/keputusan/${angka(h.rincian?.tahun)}`, teks: "Lihat hasilnya" }
        : null,
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
