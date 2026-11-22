"use server";

// Server Action untuk masuk dan keluar. Next.js menolak Server Action yang dipanggil
// dari origin lain (pemeriksaan header Origin), dan cookie sesi memakai SameSite=Lax,
// jadi permintaan dari situs lain tidak bisa memicu login atau logout atas nama pengguna.
import { redirect } from "next/navigation";
import { periksaKredensial, type HasilKredensial } from "@/lib/auth";
import { PANJANG_MAKS } from "@/lib/kata-sandi";
import { hapusSesi, simpanSesi } from "@/lib/sesi";
import { RUTE } from "@/lib/tautan";
import { amankanTujuan } from "@/lib/tujuan";

export interface StatusMasuk {
  pesan: string | null;
  /** Diisi ulang ke kolom nama pengguna setelah gagal. Kata sandi tidak pernah dikembalikan. */
  nama: string;
}

const POLA_NAMA = /^[a-z0-9._-]{3,32}$/;

// Satu pesan untuk nama yang tidak ada, kata sandi salah, dan akun nonaktif.
const PESAN_SALAH = "Nama pengguna atau kata sandi salah.";
const PESAN_KOSONG = "Isi nama pengguna dan kata sandi.";
const PESAN_GANGGUAN =
  "Tidak bisa masuk sekarang karena server sedang bermasalah. Coba lagi beberapa menit lagi.";

function pesanTerkunci(sampai: Date): string {
  const menit = Math.max(1, Math.ceil((sampai.getTime() - Date.now()) / 60_000));
  return `Terlalu banyak percobaan yang gagal. Coba lagi dalam ${menit} menit.`;
}

export async function masuk(_sebelum: StatusMasuk, form: FormData): Promise<StatusMasuk> {
  const nama = String(form.get("nama_pengguna") ?? "").trim().toLowerCase();
  const kataSandi = String(form.get("kata_sandi") ?? "");
  const tujuan = amankanTujuan(form.get("lanjut"));

  if (!nama || !kataSandi) return { pesan: PESAN_KOSONG, nama };
  // Format yang mustahil terdaftar ditolak tanpa menyentuh database.
  if (!POLA_NAMA.test(nama) || kataSandi.length > PANJANG_MAKS) {
    return { pesan: PESAN_SALAH, nama };
  }

  let hasil: HasilKredensial;
  try {
    hasil = await periksaKredensial(nama, kataSandi);
  } catch (err) {
    console.error("Gagal memeriksa login:", err instanceof Error ? err.message : err);
    return { pesan: PESAN_GANGGUAN, nama };
  }

  if (hasil.status === "terkunci") return { pesan: pesanTerkunci(hasil.sampai), nama };
  if (hasil.status === "gagal") return { pesan: PESAN_SALAH, nama };

  await simpanSesi(hasil.sesi);
  // Akun yang kata sandinya dibuat atau diatur ulang admin langsung diarahkan ke formulir ganti
  // kata sandi; tujuan semula tetap ikut supaya mereka bisa melanjutkannya sesudahnya.
  // (Bawaan amankanTujuan sudah /akun; tujuan lain diteruskan lewat ?lanjut=.)
  const ke =
    hasil.harusGantiSandi && tujuan !== RUTE.akun ? `${RUTE.akun}?lanjut=${encodeURIComponent(tujuan)}` : hasil.harusGantiSandi ? RUTE.akun : tujuan;
  redirect(ke); // di luar try: redirect() bekerja dengan melempar
}

export async function keluar(): Promise<void> {
  await hapusSesi();
  redirect(RUTE.beranda);
}
