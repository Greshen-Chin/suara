// Mencari usulan yang mirip dengan usulan yang sedang diketik warga. Hanya untuk server.
//
// Urutan kerja:
//   1. Hitung embedding teks baru (batas 3 detik). Berhasil: cari lewat makna (pgvector).
//      Gagal atau terlalu lama: turun ke kemiripan kata (pg_trgm) dan katakan terus terang.
//   2. Usulan lama yang BELUM punya embedding tetap dinilai, lewat kata. Tanpa ini mereka
//      diam-diam terlewat dan warga salah diberi tahu "tidak ada yang mirip".
//   3. Skor, ambang, dan alasan yang bisa dibaca ada di lib/kemiripan.ts.
//
// Label "AI" di layar hanya boleh muncul bila mode = "ai", yaitu embedding benar-benar dipakai.
import "server-only";
import { BATAS_WAKTU_MS } from "./data";
import { embedTeks, keLiteralVektor, susunTeksEmbedding } from "./embedding";
import {
  DEFAULT_KEMIRIPAN,
  pilihUsulanMirip,
  type KandidatMirip,
  type UsulanMirip,
} from "./kemiripan";
import { supabaseServer } from "./supabase-server";

export interface HasilMirip {
  /** "ai": makna dihitung dengan embedding. "teks": hanya kemiripan kata. */
  mode: "ai" | "teks";
  usulan: UsulanMirip[];
  /** Pada mode "ai": berapa usulan lama yang dinilai lewat kata karena belum punya embedding. */
  tanpaEmbedding: number;
}

export interface MasukanMirip {
  judul: string;
  deskripsi: string;
  rw: number;
  kategori: string;
  /**
   * Usulan yang dikecualikan dari hasil. Dipakai halaman admin: usulan yang sedang ditinjau pasti
   * paling mirip dengan dirinya sendiri, dan itu bukan duplikat.
   */
  kecuali?: string;
}

const KANDIDAT = 20;

export async function cariUsulanMirip(masukan: MasukanMirip): Promise<HasilMirip> {
  const sinyal = () => AbortSignal.timeout(BATAS_WAKTU_MS);

  // Kata selalu dicari: untuk cadangan, dan untuk usulan lama tanpa embedding.
  const teksRpc = supabaseServer
    .rpc("cari_usulan_mirip_teks", {
      p_judul: masukan.judul,
      p_deskripsi: masukan.deskripsi,
      p_batas: KANDIDAT,
    })
    .abortSignal(sinyal());

  let kosinus: Map<string, number> | null = null;
  try {
    const vektor = await embedTeks(susunTeksEmbedding(masukan.judul, masukan.deskripsi));
    const { data, error } = await supabaseServer
      .rpc("cari_usulan_mirip", { p_embedding: keLiteralVektor(vektor), p_batas: KANDIDAT })
      .abortSignal(sinyal());
    if (error) throw new Error(error.message);
    kosinus = new Map(data.map((r) => [r.id, r.kosinus]));
  } catch (err) {
    // Hanya jenis galatnya yang dicatat; teks warga tidak ikut tercatat.
    console.warn("Embedding tidak dipakai, turun ke kemiripan kata:", err instanceof Error ? err.message : err);
  }

  const { data: semuaBaris, error } = await teksRpc;
  if (error) throw new Error(`Database: ${error.message}`);
  const baris = masukan.kecuali ? semuaBaris.filter((r) => r.id !== masukan.kecuali) : semuaBaris;

  const lebar = { ...DEFAULT_KEMIRIPAN, maksTampil: KANDIDAT };
  const baru = { judul: masukan.judul, deskripsi: masukan.deskripsi, rw: masukan.rw, kategori: masukan.kategori };

  const dasar = (r: (typeof baris)[number]): KandidatMirip => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    rw: r.rw,
    status: r.status,
    voteCount: r.vote_count,
    simJudul: r.sim_judul,
    simIsi: r.sim_isi,
  });

  if (!kosinus) {
    return { mode: "teks", usulan: pilihUsulanMirip(baris.map(dasar), baru, "teks").slice(0, DEFAULT_KEMIRIPAN.maksTampil), tanpaEmbedding: 0 };
  }

  const peta = kosinus;
  const denganMakna: KandidatMirip[] = [];
  const hanyaKata: KandidatMirip[] = [];
  for (const r of baris) {
    if (!r.punya_embedding) hanyaKata.push(dasar(r));
    else if (peta.has(r.id)) denganMakna.push({ ...dasar(r), kosinus: peta.get(r.id) });
    // Punya embedding tetapi tidak masuk kandidat terdekat: tidak mirip, dilewati.
  }

  const gabungan = [
    ...pilihUsulanMirip(denganMakna, baru, "ai", lebar),
    ...pilihUsulanMirip(hanyaKata, baru, "teks", lebar),
  ]
    .sort((a, b) => b.skor - a.skor || b.dukungan - a.dukungan)
    .slice(0, DEFAULT_KEMIRIPAN.maksTampil);

  return { mode: "ai", usulan: gabungan, tanpaEmbedding: hanyaKata.length };
}

/**
 * Vektor untuk disimpan bersama usulan baru, atau null bila gagal atau lewat batas waktu.
 * Usulan tetap tersimpan tanpa embedding; `npm run embedding:isi` melengkapinya kemudian.
 */
export async function embeddingUntukUsulan(judul: string, deskripsi: string): Promise<string | null> {
  try {
    return keLiteralVektor(await embedTeks(susunTeksEmbedding(judul, deskripsi)));
  } catch {
    return null;
  }
}
