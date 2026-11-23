// Meminta saran urgensi dari AI: mengambil jatah di database, memanggil Gemini, memvalidasi jawaban, menyimpan.
// Hanya untuk server. Kunci tidak pernah keluar dari sini; yang kembali ke pemanggil hanya saran yang sudah
// divalidasi atau satu kalimat galat.
import "server-only";
import { supabaseServer as db } from "./supabase-server";
import { panggilFungsi } from "./forum-aksi";
import { bacaKonfigurasiGemini, panggilGemini, type KodeGalatGemini } from "./gemini";
import {
  bacaAlasanTersimpan,
  bacaPertanyaanTersimpan,
  KEYAKINAN,
  skemaSaran,
  susunMasukan,
  susunPrompt,
  validasiSaran,
  VERSI_PROMPT,
  type Keyakinan,
} from "./saran-urgensi";
import type { GagalSaranUi, HasilSaranUi, KodeSaranGagal, SaranUi } from "./saran-urgensi-tipe";
import { lamaTunggu } from "./waktu";
import { RUBRIK_URGENSI, rubrikUntuk } from "./urgensi";

/**
 * Apakah fitur aktif (kunci terpasang). Dipakai untuk memutuskan apakah label "AI" boleh tampil.
 * Halaman yang diprerender membaca ini saat build atau revalidasi: setelah memasang kunci, deploy ulang.
 */
export function saranAktif(): boolean {
  return bacaKonfigurasiGemini() !== null;
}

const PESAN: Record<KodeSaranGagal, string> = {
  nonaktif: "Saran AI tidak aktif.",
  belum_masuk: "Sesi Anda sudah berakhir. Masuk lagi untuk melanjutkan.",
  bukan_admin: "Hanya admin desa yang bisa meminta saran AI.",
  urgensi_kosong: "Pilih nilai Anda dulu, supaya penilaian Anda tidak terpengaruh.",
  tidak_berlaku: "Usulan ini tidak bisa diberi saran: sudah dipindah, disembunyikan, atau bukan usulan warga. Muat ulang halaman.",
  batas_laju: "Anda sudah meminta 10 saran dalam satu jam terakhir.",
  batas_harian: "Batas saran AI untuk seluruh desa dalam 24 jam sudah tercapai.",
  sedang_diproses: "Saran untuk usulan ini sedang dibuat. Tunggu beberapa detik, lalu coba lagi.",
  kuota: "Kuota AI sedang habis. Anda tetap bisa menilai seperti biasa.",
  batas_waktu: "AI terlalu lama menjawab. Coba lagi, atau lanjutkan tanpa saran.",
  jaringan: "AI tidak bisa dihubungi sekarang. Coba lagi nanti, atau lanjutkan tanpa saran.",
  layanan: "Layanan AI belum bisa dipakai karena pengaturan server. Anda tetap bisa menilai seperti biasa.",
  diblokir: "AI menolak membaca usulan ini. Nilai sendiri saja.",
  jawaban_buruk: "Jawaban AI tidak bisa dipakai. Coba lagi, atau lanjutkan tanpa saran.",
  gangguan: "Belum bisa meminta saran karena server sedang bermasalah. Coba lagi beberapa saat lagi.",
};

const BISA_ULANG = new Set<KodeSaranGagal>(["batas_waktu", "jaringan", "jawaban_buruk", "sedang_diproses", "gangguan"]);

function gagal(kode: KodeSaranGagal, ulangDetik?: number): GagalSaranUi {
  let pesan = PESAN[kode];
  if (ulangDetik !== undefined && (kode === "batas_laju" || kode === "batas_harian")) {
    pesan += ` Bisa lagi ${lamaTunggu(ulangDetik)} lagi.${kode === "batas_harian" ? " Anda tetap bisa menilai seperti biasa." : ""}`;
  }
  return { ok: false, kode, pesan, bisaUlang: BISA_ULANG.has(kode), ...(ulangDetik !== undefined && { ulangDetik }) };
}

/** Kode Gemini -> kode untuk admin, dan apakah panggilan dihitung ke jatah (AI sempat menjawab). */
const DARI_GEMINI: Record<KodeGalatGemini, { kode: KodeSaranGagal; hitung: boolean }> = {
  kuota: { kode: "kuota", hitung: false },
  kunci: { kode: "layanan", hitung: false },
  permintaan: { kode: "layanan", hitung: false },
  server: { kode: "jaringan", hitung: false },
  batas_waktu: { kode: "batas_waktu", hitung: false },
  jaringan: { kode: "jaringan", hitung: false },
  kosong: { kode: "jawaban_buruk", hitung: true },
  terpotong: { kode: "jawaban_buruk", hitung: true },
  diblokir: { kode: "diblokir", hitung: true },
};

interface DataSaran {
  id?: unknown;
  nilai?: unknown;
  keyakinan?: unknown;
  alasan?: unknown;
  pertanyaan?: unknown;
  model?: unknown;
}

/** Saran dari jsonb database ke bentuk layar; null bila bentuknya tidak dikenal. */
function keSaranUi(d: DataSaran | undefined, dariSimpanan: boolean): SaranUi | null {
  if (!d || typeof d.id !== "string" || typeof d.nilai !== "number" || typeof d.model !== "string") return null;
  if (typeof d.keyakinan !== "string" || !(KEYAKINAN as readonly string[]).includes(d.keyakinan)) return null;
  const alasan = bacaAlasanTersimpan(d.alasan);
  const tingkat = rubrikUntuk(d.nilai);
  if (!alasan || !tingkat) return null;
  return {
    id: d.id,
    nilai: d.nilai,
    tingkat: RUBRIK_URGENSI.indexOf(tingkat) + 1,
    keyakinan: d.keyakinan as Keyakinan,
    alasan,
    pertanyaan: bacaPertanyaanTersimpan(d.pertanyaan),
    model: d.model,
    dariSimpanan,
  };
}

/**
 * Satu permintaan saran. `akun` dan `idUsulan` sudah diperiksa pemanggil (sesi admin, uuid sah); fungsi SQL
 * memeriksa lagi. Nilai pilihan admin tidak diperlukan di sini: aturan "pilih dulu" ditegakkan di Server Action
 * dan di antarmuka, bukan oleh database (database tidak tahu apa yang dipilih admin di layarnya).
 */
export async function mintaSaran(akun: string, idUsulan: string): Promise<HasilSaranUi> {
  const konf = bacaKonfigurasiGemini();
  if (!konf) return gagal("nonaktif");

  const jatah = await panggilFungsi("ambil_jatah_saran", (sinyal) =>
    db
      .rpc("ambil_jatah_saran", { p_akun: akun, p_proposal: idUsulan, p_model: konf.model, p_versi: VERSI_PROMPT })
      .abortSignal(sinyal),
  );
  if (!jatah.ok) {
    switch (jatah.kode) {
      case "belum_masuk":
      case "akun_tidak_aktif":
        return { ...gagal("belum_masuk"), perluMasuk: true };
      case "bukan_admin":
        return gagal("bukan_admin");
      case "batas_laju":
        return gagal("batas_laju", jatah.ulangDetik);
      case "batas_harian":
        return gagal("batas_harian", jatah.ulangDetik);
      case "sedang_diproses":
        return gagal("sedang_diproses");
      case "tidak_ditemukan":
      case "disembunyikan":
      case "transisi_tidak_diizinkan":
        return gagal("tidak_berlaku");
      default:
        return gagal("gangguan");
    }
  }

  const d = jatah.data;
  if (d.tersimpan === true) {
    const saran = keSaranUi(d.saran as DataSaran | undefined, true);
    return saran ? { ok: true, saran } : gagal("gangguan");
  }

  const panggilan = typeof d.panggilan_id === "string" ? d.panggilan_id : null;
  const sidik = typeof d.sidik === "string" ? d.sidik : null;
  if (!panggilan || !sidik || typeof d.judul !== "string" || typeof d.kategori !== "string") return gagal("gangguan");

  const catatGagal = (kode: string, hitung: boolean, durasiMs: number) =>
    panggilFungsi("catat_gagal_saran", (sinyal) =>
      db
        .rpc("catat_gagal_saran", { p_akun: akun, p_panggilan: panggilan, p_kode: kode, p_hitung: hitung, p_durasi_ms: durasiMs })
        .abortSignal(sinyal),
    );

  // Hanya judul, deskripsi, dan kategori yang ikut, semuanya disamarkan. Tidak ada nama, RW, dukungan, biaya, atau id.
  const masukan = susunMasukan({ judul: d.judul, deskripsi: typeof d.deskripsi === "string" ? d.deskripsi : "", kategori: d.kategori });
  const prompt = susunPrompt(masukan);
  const hasil = await panggilGemini(konf, { sistem: prompt.sistem, pengguna: prompt.pengguna, skema: skemaSaran() });

  if (!hasil.ok) {
    const peta = DARI_GEMINI[hasil.kode];
    await catatGagal(hasil.kode, peta.hitung, hasil.durasiMs);
    return gagal(peta.kode);
  }

  const sah = validasiSaran(hasil.teks, masukan.teksSumber);
  if (!sah.ok) {
    // AI sudah menjawab (kuotanya terpakai), tetapi jawabannya tidak bisa dipercaya: dihitung ke jatah.
    console.error(`saran AI ditolak validator: ${sah.kode} model=${konf.model}`);
    await catatGagal(sah.kode, true, hasil.durasiMs);
    return gagal("jawaban_buruk");
  }

  const simpan = await panggilFungsi("simpan_saran", (sinyal) =>
    db
      .rpc("simpan_saran", {
        p_akun: akun,
        p_panggilan: panggilan,
        p_proposal: idUsulan,
        p_sidik: sidik,
        p_nilai: sah.saran.nilai,
        p_keyakinan: sah.saran.keyakinan,
        p_alasan: sah.saran.alasan.map((a) => ({ teks: a.teks, kutipan: a.kutipan })),
        p_pertanyaan: sah.saran.pertanyaan,
        p_model: konf.model,
        p_versi: VERSI_PROMPT,
        p_durasi_ms: hasil.durasiMs,
      })
      .abortSignal(sinyal),
  );
  if (!simpan.ok) return gagal(simpan.kode === "saran_tidak_valid" ? "tidak_berlaku" : "gangguan");
  const saran = keSaranUi(simpan.data.saran as DataSaran | undefined, false);
  return saran ? { ok: true, saran } : gagal("gangguan");
}

/** Kalimat galat umum untuk pemanggil yang tidak sampai ke mintaSaran (sesi, validasi masukan). */
export const galatSaran = (kode: KodeSaranGagal): GagalSaranUi => gagal(kode);
