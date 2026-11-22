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
