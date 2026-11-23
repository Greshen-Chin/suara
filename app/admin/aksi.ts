"use server";

// Semua perubahan dari halaman admin lewat Server Action di sini, mengikuti pola app/forum/aksi.ts:
//   1. Sesi dan peran diperiksa DI DALAM aksi (sesiAdmin). Id admin selalu dari sesi, tidak pernah
//      dari formulir; peran dan warga_id juga tidak.
//   2. Masukan divalidasi ulang di server dengan skema yang sama dengan klien (lib/admin-skema.ts).
//   3. Aturan bisnis (siapa boleh, transisi, batas 16, versi) diputuskan fungsi SQL yang atomik, yang
//      memeriksa lagi bahwa pemanggilnya admin aktif.
//   4. Berhasil -> updateTag untuk yang menampilkan angka publik, supaya admin langsung melihat
//      hasilnya di halaman utama dan forum.
// Sesi yang habis dikembalikan sebagai galat "belum_masuk", bukan redirect: isian tidak boleh hilang.
//
// Kata sandi: dibuat atau diketik di server, di-hash di server dengan hashKataSandi, dan hanya hash
// yang dikirim ke database. Bentuk aslinya hanya ada di variabel lokal fungsi ini dan di respons aksi
// yang menampilkannya sekali; tidak pernah dicatat, disimpan, atau dimasukkan ke URL.
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { hasilBerhasil, hasilGalat, galatSederhana } from "@/lib/admin-aksi";
import { sesiAdmin } from "@/lib/admin-akses";
import { bacaAkun, namaPenggunaTersedia } from "@/lib/admin-data";
import { urlBerhasil, type KodeBerhasil } from "@/lib/admin-pesan";
import {
  periksaAlasanUrgensi,
  periksaBobot,
  periksaNamaSingkat,
  periksaPagu,
  periksaUrgensi,
} from "@/lib/admin-skema";
import type {
  HasilCariWarga,
  HasilCekNama,
  StatusAksi,
  WargaBebas,
} from "@/lib/admin-status";
import { panggilFungsi } from "@/lib/forum-aksi";
import { adalahHasil, bacaDibaca, bacaKeadaanSekarang, BATAS, jelaskanPerubahan, type ButirServer } from "@/lib/keputusan";
import { bacaTahun, urlBerhasilKeputusan } from "@/lib/keputusan-pesan";
import { parseRupiah } from "@/lib/rupiah";
import type { Json } from "@/lib/database.types";
import { hashKataSandi, periksaKataSandiBaru } from "@/lib/kata-sandi";
import { alternatifNama, periksaNamaPengguna } from "@/lib/nama-pengguna";
import { buatSandiAcak } from "@/lib/sandi-acak";
import { supabaseServer as db } from "@/lib/supabase-server";
import { TAG } from "@/lib/tag-cache";
import { adalahStatusTujuan } from "@/lib/transisi-status";
import { adalahUuid, periksaAlasan } from "@/lib/usulan-skema";

const teks = (form: FormData, nama: string): string => String(form.get(nama) ?? "");

/** Segarkan yang menampilkan angka publik. Beranda ikut: pagu, bobot, dan status usulan mengubah Garis Pagu. */
function segarkan(o: { idUsulan?: string | null; pengaturan?: boolean }) {
  updateTag(TAG.beranda);
  updateTag(TAG.forum);
  if (o.pengaturan) updateTag(TAG.pengaturan);
  if (o.idUsulan) updateTag(TAG.usulan(o.idUsulan));
}

const galatSesi = (nomor: number, kode: "belum_masuk" | "bukan_admin" | "gangguan", konteks: Parameters<typeof galatSederhana>[2]) =>
  galatSederhana(nomor, kode, konteks);

// ---------------------------------------------------------------------------
// Status usulan
// ---------------------------------------------------------------------------

const KODE_PINDAH: Record<"voting" | "rejected" | "forum", KodeBerhasil> = {
  voting: "voting",
  rejected: "tidak-dilanjutkan",
  forum: "kembali",
};

export async function pindahkanStatus(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const id = teks(form, "id");
  const ke = teks(form, "ke");
  const statusDibaca = teks(form, "statusDibaca").slice(0, 20);
  if (!adalahUuid(id) || !adalahStatusTujuan(ke)) return galatSederhana(nomor, "tidak_ditemukan", "status");

  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "status");

  const galatKolom: Record<string, string> = {};
  let galatAlasan: string | null = null;
  let urgensi: number | null = null;
  let alasanUrgensi: string | null = null;
  let namaSingkat: string | null = null;
  let alasan: string | null = null;
  // Saran AI yang sedang terbuka di layar (kosong bila tidak pernah dibuka). Hanya id: nilainya dibaca SQL dari tabel.
  const saranId = ke === "voting" && adalahUuid(teks(form, "saranId")) ? teks(form, "saranId") : null;

  if (ke === "voting") {
    const u = periksaUrgensi(teks(form, "urgensi"));
    if (u.ok) urgensi = u.nilai;
    else galatKolom.urgensi = u.pesan;
    const a = periksaAlasanUrgensi(teks(form, "alasanUrgensi"));
    if (a.ok) alasanUrgensi = a.nilai;
    else galatKolom.alasanUrgensi = a.pesan;
    const n = periksaNamaSingkat(teks(form, "namaSingkat"));
    if (n.ok) namaSingkat = n.nilai;
    else galatKolom.namaSingkat = n.pesan;
  } else {
    const a = periksaAlasan(teks(form, "alasan"));
    if (a.ok) alasan = a.isi;
    else galatAlasan = a.pesan;
  }
  if (Object.keys(galatKolom).length > 0 || galatAlasan) {
    return {
      ...galatSederhana(nomor, "gangguan", "status"),
      pesan: "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.",
      galatKolom,
      galatAlasan,
    };
  }

  const h = await panggilFungsi("pindahkan_status", (sinyal) =>
    db
      .rpc("pindahkan_status", {
        p_akun: sesi.pengguna.id,
        p_proposal: id,
        p_ke: ke,
        p_status_dibaca: statusDibaca,
        p_urgensi: urgensi,
        p_alasan_urgensi: alasanUrgensi,
        p_nama_singkat: namaSingkat,
        p_alasan: alasan,
        ...(saranId && { p_saran: saranId }),
      })
      .abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "status", h);

  segarkan({ idUsulan: id, pengaturan: true });
  // Kembali ke daftar dengan pesan yang diumumkan; redirect() bekerja dengan melempar.
  redirect(urlBerhasil("/admin/usulan", KODE_PINDAH[ke], id));
}

// ---------------------------------------------------------------------------
// Pagu dan bobot
// ---------------------------------------------------------------------------

function bacaVersi(form: FormData): number | null {
  const v = Number(teks(form, "versi"));
  return Number.isInteger(v) && v >= 1 && v < 2_000_000_000 ? v : null;
}

export async function ubahPagu(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "pagu");

  const pagu = periksaPagu(teks(form, "pagu"));
  const alasan = periksaAlasan(teks(form, "alasan"));
  const versi = bacaVersi(form);
  if (!pagu.ok || !alasan.ok || versi === null) {
    return {
      ...galatSederhana(nomor, "gangguan", "pagu"),
      pesan: versi === null && pagu.ok && alasan.ok ? "Halaman ini sudah kedaluwarsa. Muat ulang, lalu coba lagi." : "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.",
      galatKolom: pagu.ok ? {} : { pagu: pagu.pesan },
      galatAlasan: alasan.ok ? null : alasan.pesan,
    };
  }

  const h = await panggilFungsi("ubah_pagu", (sinyal) =>
    db
      .rpc("ubah_pagu", { p_akun: sesi.pengguna.id, p_pagu: pagu.nilai, p_versi_dibaca: versi, p_alasan: alasan.isi })
      .abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "pagu", h);

  segarkan({ pengaturan: true });
  refresh();
  return hasilBerhasil(nomor, "Pagu disimpan.");
}

export async function ubahBobot(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "bobot");

  const bobot = periksaBobot({
    popularitas: teks(form, "popularitas"),
    urgensi: teks(form, "urgensi"),
    pemerataan: teks(form, "pemerataan"),
  });
  const alasan = periksaAlasan(teks(form, "alasan"));
  const versi = bacaVersi(form);
  if (!bobot.ok || !alasan.ok || versi === null) {
    return {
      ...galatSederhana(nomor, "gangguan", "bobot"),
      pesan: versi === null && bobot.ok && alasan.ok ? "Halaman ini sudah kedaluwarsa. Muat ulang, lalu coba lagi." : "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.",
      galatKolom: bobot.ok ? {} : (bobot.galat as Record<string, string>),
      galatAlasan: alasan.ok ? null : alasan.pesan,
    };
  }

  const h = await panggilFungsi("ubah_bobot", (sinyal) =>
    db
      .rpc("ubah_bobot", {
        p_akun: sesi.pengguna.id,
        p_popularitas: bobot.nilai.popularitas,
        p_urgensi: bobot.nilai.urgensi,
        p_pemerataan: bobot.nilai.pemerataan,
        p_versi_dibaca: versi,
        p_alasan: alasan.isi,
      })
      .abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "bobot", h);

  segarkan({ pengaturan: true });
  refresh();
  return hasilBerhasil(nomor, "Bobot disimpan.");
}

// ---------------------------------------------------------------------------
// Moderasi: menampilkan kembali konten yang disembunyikan
// ---------------------------------------------------------------------------

export async function tampilkanKembali(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const jenis = teks(form, "jenis");
  const id = teks(form, "id");
  const usulan = teks(form, "usulan");
  if ((jenis !== "usulan" && jenis !== "komentar") || !adalahUuid(id) || !adalahUuid(usulan)) {
    return galatSederhana(nomor, "tidak_ditemukan", "tampilkan");
  }

  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "tampilkan");

  const alasan = periksaAlasan(teks(form, "alasan"));
  if (!alasan.ok) {
    return { ...galatSederhana(nomor, "gangguan", "tampilkan"), pesan: alasan.pesan, galatAlasan: alasan.pesan };
  }

  const h = await panggilFungsi("tampilkan_kembali", (sinyal) =>
    db
      .rpc("tampilkan_kembali", { p_akun: sesi.pengguna.id, p_jenis: jenis, p_id: id, p_alasan: alasan.isi })
      .abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "tampilkan", h);

  segarkan({ idUsulan: usulan });
  redirect(urlBerhasil("/admin/moderasi", "tampil", id));
}

// ---------------------------------------------------------------------------
// Akun warga
// ---------------------------------------------------------------------------

/**
 * Membuat akun warga. Hasilnya membawa kata sandi awal SEKALI (state.rahasia). Akun admin tidak
 * bisa dibuat dari sini: fungsi SQL hanya membuat peran 'warga', dan tidak ada masukan peran.
 */
export async function buatAkunWarga(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "buat-akun");

  const warga = teks(form, "warga");
  const nama = teks(form, "namaPengguna").trim();
  const manual = teks(form, "mode") === "manual";
  const sandiManual = teks(form, "kataSandi");

  const galatKolom: Record<string, string> = {};
  if (!adalahUuid(warga)) galatKolom.warga = "Pilih warga yang akan dibuatkan akun.";
  const galatNama = periksaNamaPengguna(nama);
  if (galatNama) galatKolom.namaPengguna = galatNama;
  if (manual) {
    const galatSandi = periksaKataSandiBaru(sandiManual, nama);
    if (galatSandi) galatKolom.kataSandi = galatSandi;
  }
  if (Object.keys(galatKolom).length > 0) {
    return {
      ...galatSederhana(nomor, "gangguan", "buat-akun"),
      pesan: "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.",
      galatKolom,
    };
  }

  const sandi = manual ? sandiManual : buatSandiAcak(nama);
  let hash: string;
  try {
    hash = await hashKataSandi(sandi);
  } catch (err) {
    console.error("Gagal membuat hash kata sandi:", err instanceof Error ? err.name : "tidak diketahui");
    return galatSederhana(nomor, "gangguan", "buat-akun");
  }

  const h = await panggilFungsi("buat_akun_warga", (sinyal) =>
    db
      .rpc("buat_akun_warga", { p_akun: sesi.pengguna.id, p_nama_pengguna: nama, p_hash: hash, p_warga: warga })
      .abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "buat-akun", h);

  return {
    ...hasilBerhasil(nomor, "Akun dibuat."),
    rahasia: { namaPengguna: nama, kataSandi: sandi },
  };
}

/** Atur ulang kata sandi: selalu acak (dibacakan ke warga), tampil sekali. Sesi akun itu dicabut. */
export async function aturUlangSandi(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const id = teks(form, "id");
  if (!adalahUuid(id)) return galatSederhana(nomor, "tidak_ditemukan", "atur-sandi");

  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "atur-sandi");

  // Nama pengguna dibutuhkan supaya kata sandi acak tidak kebetulan memuatnya.
  let sasaran;
  try {
    sasaran = await bacaAkun(sesi.pengguna, id);
  } catch (err) {
    console.error("Gagal membaca akun:", err instanceof Error ? err.message : err);
    return galatSederhana(nomor, "gangguan", "atur-sandi");
  }
  if (!sasaran) return galatSederhana(nomor, "tidak_ditemukan", "atur-sandi");

  const sandi = buatSandiAcak(sasaran.nama_pengguna);
  let hash: string;
  try {
    hash = await hashKataSandi(sandi);
  } catch (err) {
    console.error("Gagal membuat hash kata sandi:", err instanceof Error ? err.name : "tidak diketahui");
    return galatSederhana(nomor, "gangguan", "atur-sandi");
  }

  const h = await panggilFungsi("atur_ulang_sandi", (sinyal) =>
    db.rpc("atur_ulang_sandi", { p_akun: sesi.pengguna.id, p_sasaran: id, p_hash: hash }).abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "atur-sandi", h);

  return {
    ...hasilBerhasil(nomor, "Kata sandi diatur ulang."),
    rahasia: { namaPengguna: sasaran.nama_pengguna, kataSandi: sandi },
  };
}

export async function aturAktif(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const id = teks(form, "id");
  const aktif = teks(form, "aktif") === "true";
  if (!adalahUuid(id)) return galatSederhana(nomor, "tidak_ditemukan", "atur-aktif");

  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "atur-aktif");

  const h = await panggilFungsi("atur_aktif", (sinyal) =>
    db.rpc("atur_aktif", { p_akun: sesi.pengguna.id, p_sasaran: id, p_aktif: aktif }).abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "atur-aktif", h);

  redirect(urlBerhasil(`/admin/akun/${id}`, aktif ? "aktif" : "nonaktif", id));
}

// ---------------------------------------------------------------------------
// Pencarian untuk membuat akun
// ---------------------------------------------------------------------------

/** Warga yang belum punya akun, dicari lewat nama atau nomor. Maksimal 8 hasil. */
export async function cariWargaBebas(kata: string): Promise<HasilCariWarga> {
  const sesi = await sesiAdmin();
  if (!sesi.ok) {
    return {
      ok: false,
      perluMasuk: sesi.kode === "belum_masuk",
      pesan: galatSederhana(0, sesi.kode, "buat-akun").pesan ?? "Pencarian belum bisa dijalankan.",
    };
  }
  const q = String(kata ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

  const h = await panggilFungsi("cari_warga_bebas", (sinyal) =>
    db.rpc("cari_warga_bebas", { p_akun: sesi.pengguna.id, p_cari: q, p_batas: 8 }).abortSignal(sinyal),
  );
  if (!h.ok) return { ok: false, perluMasuk: h.kode === "belum_masuk", pesan: hasilGalat(0, "buat-akun", h).pesan ?? "Pencarian belum bisa dijalankan." };

  const mentah = h.data.warga;
  const warga: WargaBebas[] = Array.isArray(mentah)
    ? mentah.flatMap((w) =>
        typeof w === "object" && w !== null && !Array.isArray(w) && typeof w.id === "string" && typeof w.nomor === "number" && typeof w.nama === "string" && typeof w.rt === "number" && typeof w.rw === "number"
          ? [{ id: w.id, nomor: w.nomor, nama: w.nama, rt: w.rt, rw: w.rw }]
          : [],
      )
    : [];
  return { ok: true, warga };
}

/** Apakah nama pengguna masih bebas; bila sudah dipakai, satu saran yang bebas. */
export async function cekNamaPengguna(nama: string): Promise<HasilCekNama> {
  const sesi = await sesiAdmin();
  if (!sesi.ok) return { ok: false, pesan: galatSederhana(0, sesi.kode, "buat-akun").pesan ?? "Pemeriksaan belum bisa dijalankan." };
  const n = String(nama ?? "").trim();
  if (periksaNamaPengguna(n) !== null) return { ok: false, pesan: periksaNamaPengguna(n) ?? "Nama pengguna belum sesuai." };

  try {
    if (await namaPenggunaTersedia(sesi.pengguna, n)) return { ok: true, tersedia: true, saran: null };
    for (let i = 2; i <= 6; i++) {
      const alternatif = alternatifNama(n, i);
      if (await namaPenggunaTersedia(sesi.pengguna, alternatif)) return { ok: true, tersedia: false, saran: alternatif };
    }
    return { ok: true, tersedia: false, saran: null };
  } catch (err) {
    console.error("Gagal memeriksa nama pengguna:", err instanceof Error ? err.message : err);
    return { ok: false, pesan: "Pemeriksaan nama pengguna belum bisa dijalankan. Coba lagi." };
  }
}

// ---------------------------------------------------------------------------
// Keputusan musyawarah
// ---------------------------------------------------------------------------

/** Penetapan, pembatalan, dan penandaan selesai mengubah angka beranda, forum, halaman /keputusan, dan tiap usulan terkait. */
function segarkanKeputusan(idUsulan: readonly string[]) {
  updateTag(TAG.beranda);
  updateTag(TAG.forum);
  updateTag(TAG.pengaturan);
  updateTag(TAG.keputusan);
  for (const id of idUsulan) updateTag(TAG.usulan(id));
}

const panjangTeks = (s: string): number => [...s.trim()].length;

/** Tanggal hari ini menurut WIB, YYYY-MM-DD. */
function hariIniWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function tanggalSah(t: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/** Butir dari lembar kerja, dibaca dari teks JSON yang tidak dipercaya. null bila bentuknya salah. */
function bacaButir(mentah: string): ButirServer[] | null {
  if (mentah.length > 100_000) return null;
  let j: unknown;
  try {
    j = JSON.parse(mentah);
  } catch {
    return null;
  }
  if (!Array.isArray(j) || j.length > 64) return null;
  const butir: ButirServer[] = [];
  for (const b of j) {
    if (typeof b !== "object" || b === null || Array.isArray(b)) return null;
    const { id, hasil, alasan, sumber_dana: sumber } = b as Record<string, unknown>;
    if (typeof id !== "string" || !adalahUuid(id) || !adalahHasil(hasil)) return null;
    if (alasan !== null && typeof alasan !== "string") return null;
    if (sumber !== null && typeof sumber !== "string") return null;
    butir.push({ id, hasil, alasan: alasan === null ? null : alasan.slice(0, 2000), sumber_dana: sumber === null ? null : sumber.slice(0, 200) });
  }
  return butir;
}

/**
 * Menetapkan hasil musyawarah untuk semua usulan dalam hitungan, utuh dalam satu transaksi. Formulir membawa versi
 * periode dan sidik hitungan yang dilihat admin; bila hitungannya sudah berubah, database menolak dan jawabannya
 * menjelaskan apa yang berubah (dibandingkan dengan `dibaca`). Pilihan admin tetap di perangkat (draf), bukan di sini.
 */
export async function tetapkanKeputusan(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "tetapkan");

  const tahun = bacaTahun(teks(form, "tahun"));
  const versi = bacaVersi(form);
  const sidik = teks(form, "sidik").slice(0, 64);
  const tanggal = teks(form, "tanggal").trim();
  const catatan = teks(form, "catatan").trim();
  const butir = bacaButir(teks(form, "butir"));
  const dibaca = bacaDibaca(teks(form, "dibaca"));
  if (tahun === null || versi === null || sidik === "" || butir === null) {
    return { ...galatSederhana(nomor, "gangguan", "tetapkan"), pesan: "Halaman ini sudah kedaluwarsa. Muat ulang, lalu coba lagi." };
  }

  const galatKolom: Record<string, string> = {};
  if (!tanggalSah(tanggal)) galatKolom.tanggal = "Isi tanggal musyawarah.";
  else if (tanggal > hariIniWib()) galatKolom.tanggal = "Tanggal musyawarah tidak boleh di masa depan.";
  const n = panjangTeks(catatan);
  if (n < BATAS.catatanRapat.min || n > BATAS.catatanRapat.max) galatKolom.catatan = "Tulis catatan musyawarah, 20 sampai 1.000 karakter.";
  if (teks(form, "konfirmasi") !== "ya") galatKolom.konfirmasi = "Centang dulu bahwa ini hasil musyawarah yang sebenarnya.";
  if (Object.keys(galatKolom).length > 0) {
    return { ...galatSederhana(nomor, "gangguan", "tetapkan"), pesan: "Ada isian yang belum sesuai. Periksa isian yang bertanda galat.", galatKolom };
  }

  const h = await panggilFungsi("tetapkan_keputusan", (sinyal) =>
    db
      .rpc("tetapkan_keputusan", {
        p_akun: sesi.pengguna.id,
        p_tahun: tahun,
        p_versi_dibaca: versi,
        p_sidik: sidik,
        p_tanggal: tanggal,
        p_catatan: catatan,
        p_butir: butir as unknown as Json,
      })
      .abortSignal(sinyal),
  );
  if (!h.ok) {
    const status = hasilGalat(nomor, "tetapkan", h);
    if (h.kode === "hitungan_berubah") {
      const sekarang = bacaKeadaanSekarang(h.rincian);
      const kalimat = dibaca && sekarang ? jelaskanPerubahan(dibaca, sekarang) : [];
      return {
        ...status,
        pesan: `Hitungan anggaran berubah sejak halaman ini dibuka. ${kalimat.length > 0 ? `${kalimat.join(" ")} ` : ""}Muat ulang untuk melihat yang terbaru. Pilihan Anda tetap tersimpan di perangkat ini.`,
        bentrok: { jam: "", ringkas: kalimat.join(" ") },
      };
    }
    return status;
  }

  segarkanKeputusan(butir.map((b) => b.id));
  // Kembali ke halaman keputusan dengan pesan yang diumumkan; redirect() bekerja dengan melempar.
  redirect(urlBerhasilKeputusan("ditetapkan", { tahun }));
}

/** Membatalkan penetapan terakhir (dalam 24 jam, belum ada yang selesai). Alasan wajib dan tercatat di jejak publik. */
export async function batalkanPenetapan(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const tahun = bacaTahun(teks(form, "tahun"));
  if (tahun === null) return galatSederhana(nomor, "tidak_ditemukan", "batal-penetapan");

  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "batal-penetapan");

  const alasan = periksaAlasan(teks(form, "alasan"));
  if (!alasan.ok) {
    return { ...galatSederhana(nomor, "gangguan", "batal-penetapan"), pesan: alasan.pesan, galatAlasan: alasan.pesan };
  }

  // Usulan yang terdampak, untuk menyegarkan halaman detailnya. Gagal membaca tidak menghalangi pembatalan.
  let terdampak: string[] = [];
  try {
    const { data } = await db.from("keputusan").select("proposal_id").eq("tahun", tahun).is("dibatalkan_pada", null).abortSignal(AbortSignal.timeout(5000));
    terdampak = (data ?? []).map((r) => r.proposal_id);
  } catch {
    terdampak = [];
  }

  const h = await panggilFungsi("batalkan_penetapan", (sinyal) =>
    db.rpc("batalkan_penetapan", { p_akun: sesi.pengguna.id, p_tahun: tahun, p_alasan: alasan.isi }).abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "batal-penetapan", h);

  segarkanKeputusan(terdampak);
  redirect(urlBerhasilKeputusan("dibatalkan", { tahun }));
}

/** approved -> done atau referred -> done, dengan catatan wajib dan biaya realisasi (opsional). */
export async function tandaiSelesai(sebelum: StatusAksi, form: FormData): Promise<StatusAksi> {
  const nomor = sebelum.nomor + 1;
  const id = teks(form, "id");
  const statusDibaca = teks(form, "statusDibaca").slice(0, 20);
  if (!adalahUuid(id)) return galatSederhana(nomor, "tidak_ditemukan", "selesai");

  const sesi = await sesiAdmin();
  if (!sesi.ok) return galatSesi(nomor, sesi.kode, "selesai");

  // Dialog alasan bersama mengirim catatannya di kolom "alasan"; biaya realisasi ikut di dalam dialog.
  const catatan = teks(form, "alasan").trim();
  const n = panjangTeks(catatan);
  const galatCatatan = n < BATAS.catatanSelesai.min || n > BATAS.catatanSelesai.max ? "Tulis catatannya, 10 sampai 500 karakter." : null;

  let biaya: number | null = null;
  let galatBiaya: string | null = null;
  const biayaMentah = teks(form, "biayaRealisasi").trim();
  if (biayaMentah !== "") {
    const b = parseRupiah(biayaMentah);
    if (b.ok) biaya = b.nilai;
    else galatBiaya = b.pesan;
  }
  if (galatCatatan || galatBiaya) {
    return {
      ...galatSederhana(nomor, "gangguan", "selesai"),
      pesan: galatCatatan ?? `Biaya realisasi: ${galatBiaya}`,
      galatAlasan: galatCatatan,
      galatKolom: galatBiaya ? { biayaRealisasi: galatBiaya } : {},
    };
  }

  const h = await panggilFungsi("tandai_selesai", (sinyal) =>
    db
      .rpc("tandai_selesai", {
        p_akun: sesi.pengguna.id,
        p_proposal: id,
        p_status_dibaca: statusDibaca,
        p_catatan: catatan,
        p_biaya_realisasi: biaya,
      })
      .abortSignal(sinyal),
  );
  if (!h.ok) return hasilGalat(nomor, "selesai", h);

  segarkanKeputusan([id]);
  redirect(urlBerhasilKeputusan("selesai", { id }));
}
