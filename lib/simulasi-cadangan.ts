// Data cadangan untuk /simulasi bila database tidak terjangkau: usulan voting dari lib/fallback-data.json
// (sama dengan beranda) dan usulan forum dari lib/fallback-forum.json (sama dengan forum). Murni dan tanpa
// "server-only", supaya tes memakainya juga. Dipakai per bagian oleh lib/simulasi-data.ts: tiap kueri yang
// gagal jatuh ke bagian cadangannya sendiri.
import fallbackData from "./fallback-data.json" with { type: "json" };
import fallbackForum from "./fallback-forum.json" with { type: "json" };
import type { UsulanHitung } from "./pratinjau.ts";
import type { Bobot, Wilayah } from "./seleksi.ts";
import { namaSingkatDari, type DataSimulasi, type UsulanForum } from "./simulasi.ts";

interface BarisForumCadangan {
  id: string;
  title: string | null;
  nama_singkat: string | null;
  category: string;
  estimated_budget: number;
  status: string;
  rw: number | null;
  created_at: string;
  vote_count: number;
  disembunyikan_pada: string | null;
}

const forumCadangan = fallbackForum.usulan as unknown as BarisForumCadangan[];

/** Usulan voting dengan waktu dibuat dari cadangan forum bila ada; bila tidak, urutan di berkas (selisih satu detik). */
export function votingCadangan(): UsulanHitung[] {
  const dibuatDari = new Map(forumCadangan.map((u) => [u.id, u.created_at]));
  const dasar = Date.parse(fallbackData.dibuat);
  return fallbackData.usulan_voting.map((u, i) => ({
    id: u.id,
    title: u.title,
    namaSingkat: u.nama_singkat,
    category: u.category,
    rw: u.rw,
    estimatedBudget: u.estimated_budget,
    voteCount: u.vote_count,
    urgencyScore: u.urgency_score,
    dibuat: dibuatDari.get(u.id) ?? new Date(dasar + i * 1000).toISOString(),
  }));
}

export const wilayahCadangan = (): Wilayah[] =>
  fallbackData.wilayah.map((w) => ({ rw: w.rw, nama: w.nama, penduduk: w.penduduk, anggaranLalu: w.anggaran_lalu }));

export const bobotCadangan = (): Bobot => ({ ...fallbackData.bobot_resmi });

export const paguCadangan = (): number => fallbackData.pagu_contoh;

/** Usulan forum yang tampil (tidak tersembunyi) dan punya RW, terlama dulu. */
export function forumDariCadangan(): UsulanForum[] {
  return forumCadangan
    .filter((u) => u.status === "forum" && u.disembunyikan_pada === null && u.rw !== null && u.title !== null)
    .map((u) => ({
      id: u.id,
      title: u.title!,
      namaSingkat: namaSingkatDari(u.nama_singkat, u.title!),
      category: u.category,
      estimatedBudget: u.estimated_budget,
      rw: u.rw!,
      voteCount: u.vote_count,
      dibuat: u.created_at,
    }))
    .sort((a, b) => (a.dibuat < b.dibuat ? -1 : a.dibuat > b.dibuat ? 1 : a.id < b.id ? -1 : 1));
}

/** Seluruh data dari cadangan. Tes dan kondisi database tidak terjangkau memakainya. */
export function dataSimulasiCadangan(): DataSimulasi {
  return {
    dasar: { usulan: votingCadangan(), wilayah: wilayahCadangan(), pagu: paguCadangan(), bobot: bobotCadangan() },
    forum: forumDariCadangan(),
    dataCadangan: true,
  };
}
