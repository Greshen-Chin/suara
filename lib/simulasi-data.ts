// Membaca data halaman /simulasi: usulan voting (dengan created_at, yang tidak dikembalikan pembaca publik
// lain padahal urutan seri SQL memakainya), usulan forum yang boleh ditambahkan, wilayah, pagu, dan bobot
// resmi. Hanya untuk server.
//
// Pola sama dengan lib/beranda.ts dan lib/forum-data.ts: 'use cache' (datanya sama untuk semua pengunjung),
// tag yang sama dengan beranda, pengaturan, dan forum supaya setiap mutasi yang mengubah angka publik ikut
// memperbarui halaman ini, dan data cadangan (lib/simulasi-cadangan.ts) per bagian bila database tidak
// menjawab dalam 3 detik atau skemanya belum cocok. Tidak ada data pribadi: hanya angka dan judul usulan.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { denganFallback, getBobotResmi, getPagu, getWilayah, wajib } from "./data";
import type { UsulanHitung } from "./pratinjau";
import { namaSingkatDari, type DataSimulasi, type UsulanForum } from "./simulasi";
import { forumDariCadangan, votingCadangan } from "./simulasi-cadangan";
import { supabaseServer } from "./supabase-server";
import { TAG } from "./tag-cache";

// Kolom ditulis satu per satu (bukan "*"): skema yang belum cocok menghasilkan galat, bukan baris kosong
// yang menyesatkan, dan halaman beralih ke data cadangan beserta penandanya.
const KOLOM_VOTING = "id, title, nama_singkat, category, rw, estimated_budget, vote_count, urgency_score, created_at" as const;
const KOLOM_FORUM = "id, title, nama_singkat, category, rw, estimated_budget, vote_count, created_at" as const;

/** Usulan forum terbaru yang bisa dipilih. Forum desa jauh di bawah ini. */
const BATAS_FORUM = 150;

async function bacaVoting(sinyal: AbortSignal) {
  const { data, error } = await supabaseServer
    .from("v_usulan")
    .select(KOLOM_VOTING)
    .eq("status", "voting")
    .is("disembunyikan_pada", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .abortSignal(sinyal);
  const usulan: UsulanHitung[] | null = data
    ? data.flatMap((r) =>
        // Tanpa RW atau urgensi, usulan tidak ikut dinilai (inner join di skor_usulan).
        r.rw === null || r.urgency_score === null
          ? []
          : [
              {
                id: wajib(r.id, "id"),
                title: wajib(r.title, "title"),
                namaSingkat: namaSingkatDari(r.nama_singkat, wajib(r.title, "title")),
                category: wajib(r.category, "category"),
                rw: r.rw,
                estimatedBudget: wajib(r.estimated_budget, "estimated_budget"),
                voteCount: wajib(r.vote_count, "vote_count"),
                urgencyScore: r.urgency_score,
                dibuat: wajib(r.created_at, "created_at"),
              },
            ],
      )
    : null;
  return { data: usulan, error };
}

async function bacaForum(sinyal: AbortSignal) {
  const { data, error } = await supabaseServer
    .from("v_forum")
    .select(KOLOM_FORUM)
    .eq("status", "forum")
    .order("created_at", { ascending: false })
    .limit(BATAS_FORUM)
    .abortSignal(sinyal);
  const forum: UsulanForum[] | null = data
    ? data
        .flatMap((r) =>
          r.rw === null
            ? []
            : [
                {
                  id: wajib(r.id, "id"),
                  title: wajib(r.title, "title"),
                  namaSingkat: namaSingkatDari(r.nama_singkat, wajib(r.title, "title")),
                  category: wajib(r.category, "category"),
                  rw: r.rw,
                  estimatedBudget: wajib(r.estimated_budget, "estimated_budget"),
                  voteCount: wajib(r.vote_count, "vote_count"),
                  dibuat: wajib(r.created_at, "created_at"),
                },
              ],
        )
        // Terlama dulu, seperti urutan seri di SQL; layar memilih urutan tampilannya sendiri.
        .sort((a, b) => (a.dibuat < b.dibuat ? -1 : a.dibuat > b.dibuat ? 1 : a.id < b.id ? -1 : 1))
    : null;
  return { data: forum, error };
}

export async function muatSimulasi(): Promise<DataSimulasi> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  // beranda: dukungan pada usulan voting dan perubahan status. pengaturan: pagu dan bobot resmi.
  // forum: usulan yang bisa ditambahkan dan dukungannya.
  cacheTag(TAG.beranda, TAG.pengaturan, TAG.forum);

  const [pagu, bobot, wilayah, voting, forum] = await Promise.all([
    getPagu(),
    getBobotResmi(),
    getWilayah(),
    denganFallback(bacaVoting, votingCadangan),
    denganFallback(bacaForum, forumDariCadangan),
  ]);

  return {
    dasar: {
      usulan: voting.data,
      wilayah: wilayah.data.map((w) => ({ rw: w.rw, nama: w.nama, penduduk: w.penduduk, anggaranLalu: w.anggaran_lalu })),
      pagu: pagu.data,
      bobot: bobot.data,
    },
    forum: forum.data,
    dataCadangan: [pagu, bobot, wilayah, voting, forum].some((h) => h.source === "fallback"),
  };
}
