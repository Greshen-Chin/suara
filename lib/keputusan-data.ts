// Membaca keputusan musyawarah untuk halaman publik. Hanya untuk server.
//
// Pola sama dengan lib/forum-data.ts: bila database tidak menjawab dalam 3 detik, atau skemanya belum cocok (mis.
// migrasi 0006 belum dijalankan), datanya diambil dari lib/keputusan-cadangan.ts dan dataCadangan = true; halaman
// menampilkan penandanya. View baru (v_periode, v_keputusan) tidak ada di skema lama, jadi membacanya menghasilkan
// galat (lalu cadangan), bukan nol baris tanpa galat.
//
// Halaman publik membaca POTRET yang disimpan saat penetapan (v_periode, v_keputusan), tidak menghitung ulang.
// Yang di-cache ('use cache') hanya data yang sama untuk semua pengunjung. Penetapan, pembatalan, dan penandaan
// selesai memanggil updateTag(TAG.keputusan) (dan beranda, forum, usulan), jadi hasilnya langsung terlihat.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { denganFallback, getWilayah, logDariDb, wajib, type BarisLog } from "./data";
import type { Database, Json } from "./database.types";
import { adalahHasil, adalahStatusUsulan } from "./keputusan";
import { keputusanUsulanCadangan, PERIODE_2026, periodeCadangan } from "./keputusan-cadangan";
import { BATAS_JEJAK_MAKS, type FilterJejak } from "./keputusan-jejak";
import type { DataPeriode, KeputusanPublik, KeputusanUsulan, Periode } from "./keputusan-tipe";
import { supabaseServer } from "./supabase-server";
import type { Bobot } from "./seleksi";
import { TAG } from "./tag-cache";

type Baca<T extends "v_periode" | "v_keputusan"> = Database["public"]["Views"][T]["Row"];

const adalahObjek = (v: Json | null | undefined): v is { [k: string]: Json | undefined } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bobotDariJson(j: Json | null): Bobot | null {
  if (!adalahObjek(j)) return null;
  const { popularitas, urgensi, pemerataan } = j;
  return typeof popularitas === "number" && typeof urgensi === "number" && typeof pemerataan === "number"
    ? { popularitas, urgensi, pemerataan }
    : null;
}

function wilayahSebelumDariJson(j: Json | null): Record<string, number> | null {
  if (!adalahObjek(j)) return null;
  const hasil: Record<string, number> = {};
  for (const [k, v] of Object.entries(j)) if (typeof v === "number") hasil[k] = v;
  return hasil;
}

export function periodeDariDb(r: Baca<"v_periode">): Periode {
  const status = wajib(r.status, "status");
  if (status !== "berjalan" && status !== "diputuskan") throw new Error(`status periode tidak dikenal: ${status}`);
  return {
    tahun: wajib(r.tahun, "tahun"),
    status,
    diputuskanPada: r.diputuskan_pada,
    tanggalMusyawarah: r.tanggal_musyawarah,
    catatan: r.catatan,
    pagu: r.pagu,
    bobot: bobotDariJson(r.bobot),
    adaRekomendasi: wajib(r.ada_rekomendasi, "ada_rekomendasi"),
    wilayahSebelum: wilayahSebelumDariJson(r.wilayah_sebelum),
    diputuskanOleh: r.diputuskan_oleh,
    jumlah: {
      disetujui: wajib(r.jumlah_disetujui, "jumlah_disetujui"),
      danaLain: wajib(r.jumlah_dana_lain, "jumlah_dana_lain"),
      dilanjutkan: wajib(r.jumlah_dilanjutkan, "jumlah_dilanjutkan"),
      ditolak: wajib(r.jumlah_ditolak, "jumlah_ditolak"),
    },
    beda: wajib(r.jumlah_beda, "jumlah_beda"),
    terpakai: wajib(r.terpakai, "terpakai"),
  };
}

export function keputusanDariDb(r: Baca<"v_keputusan">): KeputusanPublik {
  const hasil = wajib(r.hasil, "hasil");
  if (!adalahHasil(hasil)) throw new Error(`hasil keputusan tidak dikenal: ${hasil}`);
  const status = r.status_rekomendasi;
  if (status !== null && !adalahStatusUsulan(status)) throw new Error(`status rekomendasi tidak dikenal: ${status}`);
  return {
    proposalId: wajib(r.proposal_id, "proposal_id"),
    judul: r.judul,
    namaSingkat: r.nama_singkat,
    hasil,
    alasan: r.alasan,
    sumberDana: r.sumber_dana,
    peringkat: r.peringkat,
    jumlahUsulan: r.jumlah_usulan,
    skor: r.skor,
    statusRekomendasi: status,
    biaya: wajib(r.biaya, "biaya"),
    dukungan: wajib(r.dukungan, "dukungan"),
    urgensi: r.urgensi,
    rw: r.rw,
    beda: wajib(r.beda_dari_rekomendasi, "beda_dari_rekomendasi"),
    statusSekarang: wajib(r.status_sekarang, "status_sekarang"),
    selesaiPada: r.selesai_pada,
    catatanSelesai: r.catatan_selesai,
    biayaRealisasi: r.biaya_realisasi,
  };
}

// ---------------------------------------------------------------------------
// Pembaca tanpa cache (dipakai di dalam pembaca ber-cache lain, mis. muatBeranda)
// ---------------------------------------------------------------------------

/**
 * Periode terakhir yang sudah diputuskan, untuk beranda saat tidak ada usulan dalam hitungan. Bila datanya tidak
 * terbaca, hasilnya null (bukan data contoh): beranda hanya menampilkan penjelasannya, tanpa ringkasan.
 */
export async function getPeriodeTerakhir(): Promise<Periode | null> {
  const h = await denganFallback<{ baris: Periode | null }>(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .from("v_periode")
        .select("*")
        .eq("status", "diputuskan")
        .order("tahun", { ascending: false })
        .limit(1)
        .abortSignal(sinyal);
      return { data: error ? null : { baris: data?.[0] ? periodeDariDb(data[0]) : null }, error };
    },
    () => ({ baris: null }),
  );
  return h.data.baris;
}

// ---------------------------------------------------------------------------
// Pembaca halaman
// ---------------------------------------------------------------------------

/** Semua periode, terbaru di atas, untuk /keputusan. */
export async function muatDaftarKeputusan(): Promise<{ periode: Periode[]; dataCadangan: boolean }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  // beranda: setiap aksi admin menyegarkannya, jadi ringkasan periode ikut segar bahkan bila hanya tag itu yang disentuh.
  cacheTag(TAG.keputusan, TAG.beranda);

  const h = await denganFallback<Periode[]>(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .from("v_periode")
        .select("*")
        .order("tahun", { ascending: false })
        .abortSignal(sinyal);
      return { data: data?.map(periodeDariDb) ?? null, error };
    },
    () => [PERIODE_2026],
  );
  return { periode: h.data, dataCadangan: h.source === "fallback" };
}

/** Satu periode beserta keputusannya dan nama RW. `periode` null berarti tidak ada periode dengan tahun ini. */
export async function muatPeriode(tahun: number): Promise<DataPeriode> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  // forum dan beranda: halaman ini memuat judul dan status usulan, yang berubah lewat moderasi (usulan disembunyikan
  // mengosongkan judulnya di v_keputusan) dan lewat aksi admin lain; keduanya menyegarkan tag itu.
  cacheTag(TAG.keputusan, TAG.forum, TAG.beranda);

  const [p, k, w] = await Promise.all([
    denganFallback<{ baris: Periode | null }>(
      async (sinyal) => {
        const { data, error } = await supabaseServer
          .from("v_periode")
          .select("*")
          .eq("tahun", tahun)
          .abortSignal(sinyal)
          .maybeSingle();
        // "Tidak ada" adalah jawaban yang sah; hanya galat yang beralih ke cadangan.
        return { data: error ? null : { baris: data ? periodeDariDb(data) : null }, error };
      },
      () => ({ baris: periodeCadangan(tahun).periode }),
    ),
    denganFallback<KeputusanPublik[]>(
      async (sinyal) => {
        const { data, error } = await supabaseServer
          .from("v_keputusan")
          .select("*")
          .eq("tahun", tahun)
          .order("peringkat", { ascending: true })
          .order("biaya", { ascending: false })
          .abortSignal(sinyal);
        return { data: data?.map(keputusanDariDb) ?? null, error };
      },
      () => periodeCadangan(tahun).keputusan,
    ),
    getWilayah(),
  ]);

  return {
    periode: p.data.baris,
    keputusan: k.data,
    wilayah: w.data.map((x) => ({ rw: x.rw, nama: x.nama, penduduk: x.penduduk })),
    dataCadangan: [p, k, w].some((h) => h.source === "fallback"),
  };
}

/**
 * Jejak keputusan lengkap (accountability_logs), terbaru di atas, dengan filter jenis. Membaca satu lebih banyak dari
 * `batas` untuk tahu masih ada yang belum tampil. Berubah bersama hampir semua aksi admin, jadi ikut tag beranda.
 */
export async function muatJejak(
  filter: FilterJejak,
): Promise<{ log: BarisLog[]; adaLagi: boolean; dataCadangan: boolean; judul: Record<string, string> }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  cacheTag(TAG.keputusan, TAG.beranda);

  const batas = Math.min(Math.max(Math.trunc(filter.batas), 1), BATAS_JEJAK_MAKS);
  const h = await denganFallback<BarisLog[]>(
    async (sinyal) => {
      let kueri = supabaseServer.from("accountability_logs").select("*");
      if (filter.jenis) kueri = kueri.eq("log_type", filter.jenis);
      const { data, error } = await kueri
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(batas + 1)
        .abortSignal(sinyal);
      return { data: data?.map(logDariDb) ?? null, error };
    },
    () => [],
  );
  const log = h.data.slice(0, batas);

  // Judul usulan untuk catatan yang menyangkut satu usulan. v_usulan sudah mengosongkan judul usulan yang disembunyikan.
  const idUsulan = [...new Set(log.flatMap((l) => (l.proposal_id ? [l.proposal_id] : [])))];
  const judul: Record<string, string> = {};
  if (idUsulan.length > 0) {
    const j = await denganFallback<{ id: string; title: string | null }[]>(
      async (sinyal) => {
        const { data, error } = await supabaseServer.from("v_usulan").select("id, title").in("id", idUsulan).abortSignal(sinyal);
        return { data: data?.map((r) => ({ id: wajib(r.id, "id"), title: r.title })) ?? null, error };
      },
      () => [],
    );
    for (const r of j.data) if (r.title) judul[r.id] = r.title;
  }
  return { log, adaLagi: h.data.length > batas, dataCadangan: h.source === "fallback", judul };
}

/** Keputusan yang berlaku untuk satu usulan, untuk halaman detail forum. null bila belum pernah diputuskan. */
export async function muatKeputusanUsulan(id: string): Promise<{ keputusan: KeputusanUsulan | null; dataCadangan: boolean }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  cacheTag(TAG.usulan(id), TAG.keputusan, TAG.forum);

  const h = await denganFallback<{ keputusan: KeputusanUsulan | null }>(
    async (sinyal) => {
      const { data, error } = await supabaseServer
        .from("v_keputusan")
        .select("*")
        .eq("proposal_id", id)
        .order("tahun", { ascending: false })
        .limit(1)
        .abortSignal(sinyal);
      if (error) return { data: null, error };
      const baris = data?.[0];
      if (!baris) return { data: { keputusan: null }, error: null };

      const tahun = wajib(baris.tahun, "tahun");
      const k = keputusanDariDb(baris);
      const periode = await supabaseServer
        .from("v_periode")
        .select("tanggal_musyawarah, ada_rekomendasi")
        .eq("tahun", tahun)
        .abortSignal(sinyal)
        .maybeSingle();
      if (periode.error) return { data: null, error: periode.error };
      return {
        data: {
          keputusan: {
            tahun,
            tanggalMusyawarah: periode.data?.tanggal_musyawarah ?? null,
            hasil: k.hasil,
            alasan: k.alasan,
            sumberDana: k.sumberDana,
            beda: k.beda,
            adaRekomendasi: periode.data?.ada_rekomendasi ?? false,
            statusSekarang: k.statusSekarang,
            selesaiPada: k.selesaiPada,
            catatanSelesai: k.catatanSelesai,
            biayaRealisasi: k.biayaRealisasi,
          },
        },
        error: null,
      };
    },
    () => ({ keputusan: keputusanUsulanCadangan(id) }),
  );
  return { keputusan: h.data.keputusan, dataCadangan: h.source === "fallback" };
}
