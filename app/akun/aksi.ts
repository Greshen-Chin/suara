"use server";

// Ganti kata sandi sendiri, untuk semua peran. Urutannya:
//   1. sesi diperiksa (bukan redirect: sesi habis dikembalikan sebagai galat, isian tidak hilang);
//   2. aturan kata sandi baru diperiksa (periksaKataSandiBaru) sebelum menyentuh database;
//   3. kata sandi LAMA diverifikasi lewat periksaKredensial, yang sama dengan login, sehingga
//      percobaan salah ikut dihitung dan dikunci: sesi yang dicuri tidak bisa dipakai menebak
//      kata sandi lama tanpa batas;
//   4. hash baru dibuat di server dan diteruskan ke ganti_sandi_sendiri (SQL), yang mematikan
//      harus_ganti_sandi dan menaikkan versi_sesi (sesi di perangkat lain tercabut);
//   5. sesi pengguna ini diterbitkan ulang dengan versi baru, supaya ia tidak ikut terlempar.
// Kata sandi tidak pernah dicatat atau dikembalikan dalam jawaban.
import { ambilPengguna, periksaKredensial } from "@/lib/auth";
import { panggilFungsi } from "@/lib/forum-aksi";
import { hashKataSandi, periksaKataSandiBaru } from "@/lib/kata-sandi";
import { PANJANG_MAKS } from "@/lib/aturan-sandi";
import { simpanSesi } from "@/lib/sesi";
import { supabaseServer as db } from "@/lib/supabase-server";
import type { StatusGantiSandi } from "@/lib/akun-status";

function galat(nomor: number, pesan: string, kolom: Record<string, string> = {}): StatusGantiSandi {
  return { nomor, hasil: "galat", pesan, galat: kolom, perluMasuk: false };
}

export async function gantiKataSandi(sebelum: StatusGantiSandi, form: FormData): Promise<StatusGantiSandi> {
  const nomor = sebelum.nomor + 1;
  const lama = String(form.get("lama") ?? "");
  const baru = String(form.get("baru") ?? "");
  const ulangi = String(form.get("ulangi") ?? "");

  let pengguna;
  try {
    pengguna = await ambilPengguna();
  } catch (err) {
    console.error("Gagal membaca sesi:", err instanceof Error ? err.message : err);
    return galat(nomor, "Belum bisa menyimpan karena server sedang bermasalah. Coba lagi beberapa menit lagi.");
  }
  if (!pengguna) return { ...galat(nomor, "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan."), perluMasuk: true };

  const kolom: Record<string, string> = {};
  if (lama === "") kolom.lama = "Isi kata sandi yang sekarang.";
  else if (lama.length > PANJANG_MAKS) kolom.lama = "Kata sandi yang sekarang tidak sesuai.";
  const aturan = periksaKataSandiBaru(baru, pengguna.nama);
  if (aturan) kolom.baru = aturan;
  else if (baru === lama) kolom.baru = "Kata sandi baru harus berbeda dari yang sekarang.";
  if (ulangi !== baru) kolom.ulangi = "Kedua kata sandi baru belum sama. Ketik ulang dengan teliti.";
  if (Object.keys(kolom).length > 0) {
    return galat(nomor, "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.", kolom);
  }

  // Verifikasi kata sandi lama dengan penghitungan percobaan dan penguncian yang sama dengan login.
  let cek;
  try {
    cek = await periksaKredensial(pengguna.nama, lama);
  } catch (err) {
    console.error("Gagal memeriksa kata sandi lama:", err instanceof Error ? err.message : err);
    return galat(nomor, "Belum bisa memeriksa kata sandi karena server sedang bermasalah. Coba lagi beberapa menit lagi.");
  }
  if (cek.status === "terkunci") {
    const menit = Math.max(1, Math.ceil((cek.sampai.getTime() - Date.now()) / 60_000));
    return galat(nomor, `Terlalu banyak percobaan yang gagal. Coba lagi dalam ${menit} menit.`);
  }
  if (cek.status === "gagal") {
    return galat(nomor, "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.", {
      lama: "Kata sandi yang sekarang tidak sesuai.",
    });
  }

  let hash: string;
  try {
    hash = await hashKataSandi(baru);
  } catch (err) {
    console.error("Gagal membuat hash kata sandi:", err instanceof Error ? err.name : "tidak diketahui");
    return galat(nomor, "Belum bisa menyimpan karena server sedang bermasalah. Coba lagi beberapa menit lagi.");
  }

  const h = await panggilFungsi("ganti_sandi_sendiri", (sinyal) =>
    db.rpc("ganti_sandi_sendiri", { p_akun: pengguna.id, p_hash: hash }).abortSignal(sinyal),
  );
  if (!h.ok) {
    return galat(
      nomor,
      h.kode === "akun_tidak_aktif"
        ? "Akun Anda sedang tidak aktif. Hubungi admin desa."
        : "Belum bisa menyimpan karena server sedang bermasalah. Coba lagi beberapa menit lagi.",
    );
  }

  const versi = h.data.versi_sesi;
  if (typeof versi !== "number") {
    return galat(nomor, "Kata sandi tersimpan, tetapi sesi Anda perlu dibuat ulang. Masuk lagi dengan kata sandi baru.");
  }
  // Sesi di perangkat lain sudah tercabut (versi naik); sesi di perangkat ini diterbitkan ulang.
  await simpanSesi({ id: pengguna.id, nama: pengguna.nama, peran: pengguna.peran, versi });

  return { nomor, hasil: "berhasil", pesan: "Kata sandi diganti.", galat: {}, perluMasuk: false };
}
