"use server";

// Semua perubahan data forum lewat Server Action di sini. Aturan yang berlaku di setiap aksi:
//   1. Sesi dan peran diperiksa DI DALAM aksi (proxy.ts hanya pemeriksaan awal). Id akun dan
//      id warga selalu dari sesi, tidak pernah dari formulir.
//   2. Masukan divalidasi ulang di server dengan skema yang sama dengan klien.
//   3. Aturan bisnis (siapa boleh, batas laju, status usulan) diputuskan fungsi SQL yang atomik.
//   4. Berhasil -> updateTag, supaya yang menekan langsung melihat hasilnya (read-your-writes).
// Next.js menolak Server Action yang dipanggil dari origin lain, jadi tidak perlu token CSRF.
//
// Berbeda dari wajibMasuk()/wajibPeran() yang memanggil redirect(), di sini sesi yang habis
// DIKEMBALIKAN sebagai galat "belum_masuk". Tombol yang ditekan tidak boleh melempar warga ke
// halaman lain tanpa penjelasan; klien yang memutuskan (menyimpan draf lalu ke /masuk).
import { updateTag } from "next/cache";
import { ambilPengguna, type Pengguna } from "@/lib/auth";
import { dukunganSaya } from "@/lib/forum-data";
import {
  buatGalat,
  panggilFungsi,
  type Galat,
  type Konteks,
} from "@/lib/forum-aksi";
import { cariUsulanMirip, embeddingUntukUsulan } from "@/lib/forum-mirip";
import type { StatusKomentar, StatusSembunyikan } from "@/lib/forum-status";
import { supabaseServer as db } from "@/lib/supabase-server";
import { TAG } from "@/lib/tag-cache";
import {
  adalahUuid,
  periksaAlasan,
  periksaKomentar,
  periksaUsulan,
  type GalatUsulan,
  type MasukanUsulan,
} from "@/lib/usulan-skema";
import type { UsulanMirip } from "@/lib/kemiripan";

export type { Galat } from "@/lib/forum-aksi";

type Sesi = { pengguna: Pengguna } | { galat: Galat };

async function ambilSesi(konteks: Konteks): Promise<Sesi> {
  let pengguna: Pengguna | null;
  try {
    pengguna = await ambilPengguna();
  } catch (err) {
    console.error("Gagal membaca sesi:", err instanceof Error ? err.message : err);
    return { galat: buatGalat("gangguan", konteks) };
  }
  return pengguna ? { pengguna } : { galat: buatGalat("belum_masuk", konteks) };
}

/** Segarkan semua yang menampilkan angka usulan ini. Beranda ikut: peringkatnya bergantung pada dukungan. */
function segarkan(idUsulan: string | null) {
  updateTag(TAG.forum);
  updateTag(TAG.beranda);
  if (idUsulan) updateTag(TAG.usulan(idUsulan));
}

// ---------------------------------------------------------------------------
// Dukungan
// ---------------------------------------------------------------------------

export type HasilDukung = { ok: true; didukung: boolean; jumlah: number } | Galat;

async function ubahDukungan(idUsulan: string, fungsi: "dukung_usulan" | "batal_dukung"): Promise<HasilDukung> {
  if (!adalahUuid(idUsulan)) return buatGalat("tidak_ditemukan", "dukung");
  const sesi = await ambilSesi("dukung");
  if ("galat" in sesi) return sesi.galat;

  const argumen = { p_akun: sesi.pengguna.id, p_proposal: idUsulan };
  const h = await panggilFungsi(fungsi, (sinyal) =>
    (fungsi === "dukung_usulan" ? db.rpc("dukung_usulan", argumen) : db.rpc("batal_dukung", argumen)).abortSignal(sinyal),
  );
  if (!h.ok) return buatGalat(h.kode, "dukung", { ulangDetik: h.ulangDetik });

  segarkan(idUsulan);
  return {
    ok: true,
    didukung: h.data.didukung === true,
    jumlah: typeof h.data.jumlah === "number" ? h.data.jumlah : 0,
  };
}

export async function dukungUsulan(idUsulan: string): Promise<HasilDukung> {
  return ubahDukungan(idUsulan, "dukung_usulan");
}

export async function batalDukungUsulan(idUsulan: string): Promise<HasilDukung> {
  return ubahDukungan(idUsulan, "batal_dukung");
}

// ---------------------------------------------------------------------------
// Komentar
// ---------------------------------------------------------------------------

export async function kirimKomentar(sebelum: StatusKomentar, form: FormData): Promise<StatusKomentar> {
  const nomor = sebelum.nomor + 1;
  const galat = (g: Galat, galatIsi: string | null = null): StatusKomentar => ({
    nomor,
    hasil: "galat",
    pesan: g.pesan,
    galatIsi,
    perluMasuk: g.kode === "belum_masuk",
  });

  const idUsulan = String(form.get("usulan") ?? "");
  if (!adalahUuid(idUsulan)) return galat(buatGalat("tidak_ditemukan", "komentar"));

  const sesi = await ambilSesi("komentar");
  if ("galat" in sesi) return galat(sesi.galat);

  const isi = periksaKomentar(String(form.get("isi") ?? ""));
  if (!isi.ok) return galat(buatGalat("tidak_valid", "komentar"), isi.pesan);

  const h = await panggilFungsi("tambah_komentar", (sinyal) =>
    db
      .rpc("tambah_komentar", { p_akun: sesi.pengguna.id, p_proposal: idUsulan, p_isi: isi.isi })
      .abortSignal(sinyal),
  );
  if (!h.ok) {
    const g = buatGalat(h.kode, "komentar", { ulangDetik: h.ulangDetik, bidang: h.bidang });
    return galat(g, h.kode === "tidak_valid" ? g.pesan : null);
  }

  segarkan(idUsulan);
  return { nomor, hasil: "terkirim", pesan: "Komentar terkirim.", galatIsi: null, perluMasuk: false };
}

// ---------------------------------------------------------------------------
// Moderasi (admin)
// ---------------------------------------------------------------------------

export async function sembunyikanKonten(
  sebelum: StatusSembunyikan,
  form: FormData,
): Promise<StatusSembunyikan> {
  const nomor = sebelum.nomor + 1;
  const galat = (g: Galat, galatAlasan: string | null = null): StatusSembunyikan => ({
    nomor,
    hasil: "galat",
    pesan: g.pesan,
    galatAlasan,
  });

  const jenis = String(form.get("jenis") ?? "");
  const id = String(form.get("id") ?? "");
  const idUsulan = String(form.get("usulan") ?? "");
  if ((jenis !== "usulan" && jenis !== "komentar") || !adalahUuid(id) || !adalahUuid(idUsulan)) {
    return galat(buatGalat("tidak_ditemukan", "sembunyikan"));
  }

  const sesi = await ambilSesi("sembunyikan");
  if ("galat" in sesi) return galat(sesi.galat);
  // Pemeriksaan peran juga ada di fungsi SQL; ini hanya memberi jawaban lebih cepat.
  if (sesi.pengguna.peran !== "admin") return galat(buatGalat("bukan_admin", "sembunyikan"));

  const alasan = periksaAlasan(String(form.get("alasan") ?? ""));
  if (!alasan.ok) return galat(buatGalat("tidak_valid", "sembunyikan"), alasan.pesan);

  const h = await panggilFungsi("sembunyikan", (sinyal) =>
    db
      .rpc("sembunyikan", { p_akun: sesi.pengguna.id, p_jenis: jenis, p_id: id, p_alasan: alasan.isi })
      .abortSignal(sinyal),
  );
  if (!h.ok) return galat(buatGalat(h.kode, "sembunyikan", { bidang: h.bidang }));

  segarkan(idUsulan);
  return {
    nomor,
    hasil: "berhasil",
    pesan: jenis === "usulan" ? "Usulan disembunyikan." : "Komentar disembunyikan.",
    galatAlasan: null,
  };
}

// ---------------------------------------------------------------------------
// Usulan baru
// ---------------------------------------------------------------------------

export type HasilPeriksaMirip =
  | {
      ok: true;
      mode: "ai" | "teks";
      tanpaEmbedding: number;
      usulan: (UsulanMirip & { didukung: boolean })[];
    }
  | (Galat & { galatBidang?: GalatUsulan });

export type HasilAjukan = { ok: true; id: string } | (Galat & { galatBidang?: GalatUsulan });

function bacaMasukan(m: MasukanUsulan): MasukanUsulan {
  // Argumen Server Action datang dari jaringan: jangan percaya tipenya.
  return {
    judul: String(m?.judul ?? ""),
    namaSingkat: String(m?.namaSingkat ?? ""),
    deskripsi: String(m?.deskripsi ?? ""),
    kategori: String(m?.kategori ?? ""),
    rw: String(m?.rw ?? ""),
    biaya: String(m?.biaya ?? ""),
  };
}

/** Langkah "Periksa usulan serupa". Tidak menyimpan apa pun. */
export async function periksaKemiripan(masukan: MasukanUsulan): Promise<HasilPeriksaMirip> {
  const sesi = await ambilSesi("periksa");
  if ("galat" in sesi) return sesi.galat;
  if (sesi.pengguna.peran !== "warga") return buatGalat("bukan_warga", "periksa");
  if (!sesi.pengguna.wargaId) return buatGalat("tanpa_warga", "periksa");

  const hasil = periksaUsulan(bacaMasukan(masukan));
  if (!hasil.ok) return { ...buatGalat("tidak_valid", "periksa"), galatBidang: hasil.galat };

  try {
    const mirip = await cariUsulanMirip({
      judul: hasil.data.judul,
      deskripsi: hasil.data.deskripsi,
      rw: hasil.data.rw,
      kategori: hasil.data.kategori,
    });
    const sudah = await dukunganSaya(sesi.pengguna.wargaId, mirip.usulan.map((u) => u.id));
    return {
      ok: true,
      mode: mirip.mode,
      tanpaEmbedding: mirip.tanpaEmbedding,
      usulan: mirip.usulan.map((u) => ({ ...u, didukung: sudah.has(u.id) })),
    };
  } catch (err) {
    console.error("Pemeriksaan usulan serupa gagal:", err instanceof Error ? err.message : err);
    return buatGalat("gangguan", "periksa");
  }
}

/** Menyimpan usulan baru. Pemeriksaan serupa sudah dilakukan klien; di sini hanya validasi dan simpan. */
export async function ajukanUsulan(masukan: MasukanUsulan): Promise<HasilAjukan> {
  const sesi = await ambilSesi("usul");
  if ("galat" in sesi) return sesi.galat;
  if (sesi.pengguna.peran !== "warga") return buatGalat("bukan_warga", "usul");
  if (!sesi.pengguna.wargaId) return buatGalat("tanpa_warga", "usul");

  const hasil = periksaUsulan(bacaMasukan(masukan));
  if (!hasil.ok) return { ...buatGalat("tidak_valid", "usul"), galatBidang: hasil.galat };
  const u = hasil.data;

  // Embedding menyusul bila gagal; usulan tetap tersimpan.
  const embedding = await embeddingUntukUsulan(u.judul, u.deskripsi);

  const h = await panggilFungsi("ajukan_usulan", (sinyal) =>
    db
      .rpc("ajukan_usulan", {
        p_akun: sesi.pengguna.id,
        p_judul: u.judul,
        p_nama_singkat: u.namaSingkat,
        p_deskripsi: u.deskripsi,
        p_kategori: u.kategori,
        p_rw: u.rw,
        p_biaya: u.biaya,
        p_embedding: embedding,
      })
      .abortSignal(sinyal),
  );
  if (!h.ok) {
    const g = buatGalat(h.kode, "usul", { ulangDetik: h.ulangDetik, bidang: h.bidang });
    return h.kode === "tidak_valid" && h.bidang ? { ...g, galatBidang: { [h.bidang === "nama_singkat" ? "namaSingkat" : h.bidang]: g.pesan } } : g;
  }

  const id = typeof h.data.id === "string" ? h.data.id : null;
  if (!id) return buatGalat("gangguan", "usul");
  updateTag(TAG.forum);
  return { ok: true, id };
}
