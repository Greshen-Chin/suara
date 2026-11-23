// Membaca data untuk halaman admin. Hanya untuk server.
//
// Berbeda dari lib/data.ts dan lib/forum-data.ts:
//   - TIDAK ada data cadangan. Keputusan anggaran tidak boleh diambil dari data basi. Kalau database
//     tidak terjangkau, fungsi di sini melempar galat dan app/admin/error.tsx menampilkan halaman
//     galat dengan tombol "Coba lagi"; tidak ada aksi yang bisa ditekan.
//   - TIDAK ada 'use cache'. Isinya data pribadi (nama lengkap, nomor warga) dan keadaan yang harus
//     segar; halaman memakai `await connection()` dan membaca langsung.
//   - Setiap fungsi menerima Pengguna dan menolak yang bukan admin. Itu lapisan kedua setelah
//     periksaAkses() di halaman, supaya pembaca tidak pernah terpakai tanpa pemeriksaan peran.
//
// Daftar dibaca utuh (maksimal 500 usulan, 1.000 akun, 500 komentar) lalu disaring dan dipotong di
// server dengan lib/admin-filter.ts, seperti forum: untuk ukuran desa, satu bacaan yang sederhana
// lebih baik daripada kueri berlapis. Lebih dari itu, daftar terbaru yang dipotong.
import "server-only";
import { BATAS_WAKTU_MS, logDariDb, wajib, type BarisLog } from "./data";
import type { Database, Json } from "./database.types";
import type { JenisLog } from "./jenis-log";
import { uraiHitungan, type Hasil, type HitunganResmi } from "./keputusan";
import { keputusanDariDb, periodeDariDb } from "./keputusan-data";
import type { Periode } from "./keputusan-tipe";
import type { Pengguna } from "./auth";
import type { DasarHitung } from "./pratinjau";
import { supabaseServer as db } from "./supabase-server";

const BATAS_BACA_MS = Math.max(BATAS_WAKTU_MS, 5000);
const sinyal = () => AbortSignal.timeout(BATAS_BACA_MS);

/** Hasil yang harus ada. Galat database, atau jawaban kosong tanpa galat, dilempar. */
function periksa<T>(hasil: { data: T | null; error: { message: string } | null }): T {
  if (hasil.error) throw new Error(`Database: ${hasil.error.message}`);
  if (hasil.data === null) throw new Error("Database: jawaban kosong");
  return hasil.data;
}

/** Hasil yang boleh tidak ada (maybeSingle): null berarti memang tidak ada barisnya. */
function periksaBoleh<T>(hasil: { data: T | null; error: { message: string } | null }): T | null {
  if (hasil.error) throw new Error(`Database: ${hasil.error.message}`);
  return hasil.data;
}

function pastikanAdmin(pengguna: Pengguna): void {
  if (pengguna.peran !== "admin") throw new Error("Data ini hanya untuk admin desa.");
}

type Baca<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];

// ---------------------------------------------------------------------------
// Pengaturan: pagu dan bobot
// ---------------------------------------------------------------------------

export interface PengaturanAnggaran {
  pagu: number;
  /** Versi yang dibaca; dikirim kembali saat menyimpan supaya admin lain yang lebih dulu tidak tertimpa. */
  versiPagu: number;
  diubahPagu: string;
  bobot: { popularitas: number; urgensi: number; pemerataan: number };
  versiBobot: number;
  diubahBobot: string;
}

export async function bacaPengaturan(pengguna: Pengguna): Promise<PengaturanAnggaran> {
  pastikanAdmin(pengguna);
  const [a, b] = await Promise.all([
    db.from("pengaturan_anggaran").select("pagu, versi, updated_at").eq("id", 1).abortSignal(sinyal()).single(),
    db
      .from("scoring_weights")
      .select("w_popularitas, w_urgensi, w_pemerataan, versi, updated_at")
      .eq("id", 1)
      .abortSignal(sinyal())
      .single(),
  ]);
  const anggaran = periksa(a);
  const bobot = periksa(b);
  return {
    pagu: anggaran.pagu,
    versiPagu: anggaran.versi,
    diubahPagu: anggaran.updated_at,
    bobot: { popularitas: bobot.w_popularitas, urgensi: bobot.w_urgensi, pemerataan: bobot.w_pemerataan },
    versiBobot: bobot.versi,
    diubahBobot: bobot.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Usulan
// ---------------------------------------------------------------------------

export interface UsulanAdmin {
  id: string;
  /** Judul asli, juga untuk usulan tersembunyi (admin perlu menilai ulang). */
  title: string;
  nama_singkat: string | null;
  description: string | null;
  category: string;
  estimated_budget: number;
  status: string;
  source: string;
  rw: number | null;
  created_at: string;
  urgency_score: number | null;
  urgency_reason: string | null;
  disembunyikan_pada: string | null;
  alasan_disembunyikan: string | null;
  pengusul_nama_depan: string | null;
  pengusul_rw: number | null;
  vote_count: number;
  jumlah_komentar: number;
  penduduk: number | null;
  suara_per_1000: number | null;
}

function usulanDariDb(r: Baca<"v_admin_usulan">): UsulanAdmin {
  return {
    id: wajib(r.id, "id"),
    title: wajib(r.title, "title"),
    nama_singkat: r.nama_singkat,
    description: r.description,
    category: wajib(r.category, "category"),
    estimated_budget: wajib(r.estimated_budget, "estimated_budget"),
    status: wajib(r.status, "status"),
    source: wajib(r.source, "source"),
    rw: r.rw,
    created_at: wajib(r.created_at, "created_at"),
    urgency_score: r.urgency_score,
    urgency_reason: r.urgency_reason,
    disembunyikan_pada: r.disembunyikan_pada,
    alasan_disembunyikan: r.alasan_disembunyikan,
    pengusul_nama_depan: r.pengusul_nama_depan,
    pengusul_rw: r.pengusul_rw,
    vote_count: wajib(r.vote_count, "vote_count"),
    jumlah_komentar: wajib(r.jumlah_komentar, "jumlah_komentar"),
    penduduk: r.penduduk,
    suara_per_1000: r.suara_per_1000,
  };
}

export async function bacaSemuaUsulan(pengguna: Pengguna): Promise<UsulanAdmin[]> {
  pastikanAdmin(pengguna);
  const baris = periksa(
    await db
      .from("v_admin_usulan")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
      .abortSignal(sinyal()),
  );
  return baris.map(usulanDariDb);
}

/** null = tidak ada usulan dengan id ini (halaman 404). */
export async function bacaUsulan(pengguna: Pengguna, id: string): Promise<UsulanAdmin | null> {
  pastikanAdmin(pengguna);
  const baris = periksaBoleh(
    await db.from("v_admin_usulan").select("*").eq("id", id).abortSignal(sinyal()).maybeSingle(),
  );
  return baris ? usulanDariDb(baris) : null;
}

/**
 * Data yang sama dengan rekomendasi_resmi di SQL: usulan voting yang tidak tersembunyi, wilayah,
 * bobot, dan pagu. Dibaca dari database yang sama tanpa data cadangan, supaya pratinjau dan hasil
 * sungguhan memakai masukan yang sama. Urutan usulan: created_at lalu id, seperti pilih_optimal.
 */
export async function bacaDasarHitung(pengguna: Pengguna): Promise<DasarHitung> {
  pastikanAdmin(pengguna);
  const [u, w, pengaturan] = await Promise.all([
    db
      .from("v_admin_usulan")
      .select("id, title, nama_singkat, category, rw, estimated_budget, urgency_score, vote_count, created_at")
      .eq("status", "voting")
      .is("disembunyikan_pada", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .abortSignal(sinyal()),
    db.from("wilayah").select("rw, nama, penduduk, anggaran_lalu").order("rw", { ascending: true }).abortSignal(sinyal()),
    bacaPengaturan(pengguna),
  ]);
  const usulan = periksa(u).flatMap((r) =>
    // Tanpa RW atau urgensi, usulan tidak ikut dinilai (inner join di skor_usulan).
    r.rw === null || r.urgency_score === null
      ? []
      : [
          {
            id: wajib(r.id, "id"),
            title: wajib(r.title, "title"),
            namaSingkat: r.nama_singkat ?? wajib(r.title, "title"),
            category: wajib(r.category, "category"),
            rw: r.rw,
            estimatedBudget: wajib(r.estimated_budget, "estimated_budget"),
            voteCount: wajib(r.vote_count, "vote_count"),
            urgencyScore: r.urgency_score,
            dibuat: wajib(r.created_at, "created_at"),
          },
        ],
  );
  return {
    usulan,
    wilayah: periksa(w).map((r) => ({ rw: r.rw, nama: r.nama, penduduk: r.penduduk, anggaranLalu: r.anggaran_lalu })),
    pagu: pengaturan.pagu,
    bobot: pengaturan.bobot,
  };
}

// ---------------------------------------------------------------------------
// Komentar
// ---------------------------------------------------------------------------

export interface KomentarAdmin {
  id: string;
  proposal_id: string;
  proposal_judul: string;
  /** Isi asli, juga untuk komentar tersembunyi. */
  isi: string;
  created_at: string;
  disembunyikan_pada: string | null;
  alasan_disembunyikan: string | null;
  dari_admin: boolean;
  penulis_nama_depan: string | null;
  penulis_rw: number | null;
}

function komentarDariDb(r: Baca<"v_admin_komentar">): KomentarAdmin {
  return {
    id: wajib(r.id, "id"),
    proposal_id: wajib(r.proposal_id, "proposal_id"),
    proposal_judul: wajib(r.proposal_judul, "proposal_judul"),
    isi: wajib(r.isi, "isi"),
    created_at: wajib(r.created_at, "created_at"),
    disembunyikan_pada: r.disembunyikan_pada,
    alasan_disembunyikan: r.alasan_disembunyikan,
    dari_admin: wajib(r.dari_admin, "dari_admin"),
    penulis_nama_depan: r.penulis_nama_depan,
    penulis_rw: r.penulis_rw,
  };
}

/** Komentar terbaru dari semua usulan (maksimal 500), terbaru di atas. */
export async function bacaSemuaKomentar(pengguna: Pengguna): Promise<KomentarAdmin[]> {
  pastikanAdmin(pengguna);
  const baris = periksa(
    await db
      .from("v_admin_komentar")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
      .abortSignal(sinyal()),
  );
  return baris.map(komentarDariDb);
}

/** Komentar terbaru pada satu usulan, termasuk yang tersembunyi. */
export async function bacaKomentarUsulan(pengguna: Pengguna, idUsulan: string, batas = 5): Promise<KomentarAdmin[]> {
  pastikanAdmin(pengguna);
  const baris = periksa(
    await db
      .from("v_admin_komentar")
      .select("*")
      .eq("proposal_id", idUsulan)
      .order("created_at", { ascending: false })
      .limit(batas)
      .abortSignal(sinyal()),
  );
  return baris.map(komentarDariDb);
}

// ---------------------------------------------------------------------------
// Akun
// ---------------------------------------------------------------------------

export interface AkunAdmin {
  id: string;
  nama_pengguna: string;
  peran: string;
  aktif: boolean;
  harus_ganti_sandi: boolean;
  created_at: string;
  dibuat_oleh_nama: string | null;
  warga_nama: string | null;
  warga_nomor: number | null;
  warga_rt: number | null;
  warga_rw: number | null;
}

function akunDariDb(r: Baca<"v_admin_akun">): AkunAdmin {
  return {
    id: wajib(r.id, "id"),
    nama_pengguna: wajib(r.nama_pengguna, "nama_pengguna"),
    peran: wajib(r.peran, "peran"),
    aktif: wajib(r.aktif, "aktif"),
    harus_ganti_sandi: wajib(r.harus_ganti_sandi, "harus_ganti_sandi"),
    created_at: wajib(r.created_at, "created_at"),
    dibuat_oleh_nama: r.dibuat_oleh_nama,
    warga_nama: r.warga_nama,
    warga_nomor: r.warga_nomor,
    warga_rt: r.warga_rt,
    warga_rw: r.warga_rw,
  };
}

export async function bacaSemuaAkun(pengguna: Pengguna): Promise<AkunAdmin[]> {
  pastikanAdmin(pengguna);
  const baris = periksa(
    await db
      .from("v_admin_akun")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000)
      .abortSignal(sinyal()),
  );
  return baris.map(akunDariDb);
}

export async function bacaAkun(pengguna: Pengguna, id: string): Promise<AkunAdmin | null> {
  pastikanAdmin(pengguna);
  const baris = periksaBoleh(
    await db.from("v_admin_akun").select("*").eq("id", id).abortSignal(sinyal()).maybeSingle(),
  );
  return baris ? akunDariDb(baris) : null;
}

/** true bila nama pengguna belum dipakai. */
export async function namaPenggunaTersedia(pengguna: Pengguna, nama: string): Promise<boolean> {
  pastikanAdmin(pengguna);
  const baris = periksaBoleh(
    await db.from("akun").select("id").eq("nama_pengguna", nama).abortSignal(sinyal()).maybeSingle(),
  );
  return baris === null;
}

// ---------------------------------------------------------------------------
// Jejak
// ---------------------------------------------------------------------------

export interface JejakAdmin {
  id: number;
  aksi: string;
  created_at: string;
  pelaku_nama: string;
  sasaran_nama: string | null;
  detail: Json;
}

function jejakDariDb(r: Baca<"v_jejak_admin">): JejakAdmin {
  return {
    id: wajib(r.id, "id"),
    aksi: wajib(r.aksi, "aksi"),
    created_at: wajib(r.created_at, "created_at"),
    pelaku_nama: wajib(r.pelaku_nama, "pelaku_nama"),
    sasaran_nama: r.sasaran_nama,
    detail: r.detail ?? {},
  };
}

/** Jejak tertutup untuk satu akun: siapa membuat, mengatur ulang, menonaktifkan, dan kapan. Terbaru di atas. */
export async function bacaJejakAkun(pengguna: Pengguna, idAkun: string, batas = 50): Promise<JejakAdmin[]> {
  pastikanAdmin(pengguna);
  const baris = periksa(
    await db
      .from("v_jejak_admin")
      .select("*")
      .eq("sasaran_akun_id", idAkun)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(batas)
      .abortSignal(sinyal()),
  );
  return baris.map(jejakDariDb);
}

/** Siapa menyembunyikan dan menampilkan kembali konten (jejak tertutup, bukan jejak publik). */
export async function bacaJejakModerasi(pengguna: Pengguna, batas = 300): Promise<JejakAdmin[]> {
  pastikanAdmin(pengguna);
  const baris = periksa(
    await db
      .from("v_jejak_admin")
      .select("*")
      .in("aksi", ["sembunyikan", "tampilkan"])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(batas)
      .abortSignal(sinyal()),
  );
  return baris.map(jejakDariDb);
}

// ---------------------------------------------------------------------------
// Jejak keputusan publik (accountability_logs), tanpa cadangan
// ---------------------------------------------------------------------------

export async function bacaLogKeputusan(
  pengguna: Pengguna,
  o: { jenis?: readonly JenisLog[]; idUsulan?: string; batas?: number; terbaruDulu?: boolean } = {},
): Promise<BarisLog[]> {
  pastikanAdmin(pengguna);
  const terbaruDulu = o.terbaruDulu ?? true;
  let kueri = db.from("accountability_logs").select("*");
  if (o.jenis) kueri = kueri.in("log_type", [...o.jenis]);
  if (o.idUsulan) kueri = kueri.eq("proposal_id", o.idUsulan);
  const baris = periksa(
    await kueri
      .order("created_at", { ascending: !terbaruDulu })
      .order("id", { ascending: !terbaruDulu })
      .limit(Math.min(Math.max(o.batas ?? 20, 1), 100))
      .abortSignal(sinyal()),
  );
  return baris.map(logDariDb);
}

// ---------------------------------------------------------------------------
// Keputusan musyawarah (/admin/keputusan)
// ---------------------------------------------------------------------------

/** Usulan yang sudah diputuskan dan menunggu ditandai selesai (disetujui atau diajukan ke dana lain). */
export interface PekerjaanBerjalan {
  proposalId: string;
  tahun: number;
  /** null bila usulannya disembunyikan. */
  judul: string | null;
  hasil: Hasil;
  biaya: number;
  rw: number | null;
  sumberDana: string | null;
  statusSekarang: string;
}

export interface KeadaanKeputusan {
  /** Periode yang sedang berjalan (tempat keputusan berikutnya ditetapkan). null bila tidak ada. */
  berjalan: { tahun: number; versi: number } | null;
  /** Hitungan resmi saat ini, dari fungsi SQL yang sama dengan yang dipakai penetapan. */
  hitungan: HitunganResmi;
  wilayah: { rw: number; nama: string; penduduk: number; anggaranLalu: number }[];
  /** Penetapan terakhir (periode diputuskan dengan tahun terbesar) beserta apakah sudah ada usulannya yang selesai. */
  terakhir: { periode: Periode; adaSelesai: boolean } | null;
  pekerjaan: PekerjaanBerjalan[];
}

export async function bacaKeadaanKeputusan(pengguna: Pengguna): Promise<KeadaanKeputusan> {
  pastikanAdmin(pengguna);
  const [berjalan, hitungan, wilayah, diputuskan, pekerjaan] = await Promise.all([
    db.from("periode").select("tahun, versi").eq("status", "berjalan").abortSignal(sinyal()).maybeSingle(),
    db.rpc("sidik_hitungan").abortSignal(sinyal()),
    db.from("wilayah").select("rw, nama, penduduk, anggaran_lalu").order("rw", { ascending: true }).abortSignal(sinyal()),
    db.from("v_periode").select("*").eq("status", "diputuskan").order("tahun", { ascending: false }).limit(1).abortSignal(sinyal()),
    db
      .from("v_keputusan")
      .select("*")
      .in("status_sekarang", ["approved", "referred"])
      .order("tahun", { ascending: false })
      .order("peringkat", { ascending: true })
      .limit(200)
      .abortSignal(sinyal()),
  ]);

  const baris = periksa(diputuskan)[0];
  let terakhir: KeadaanKeputusan["terakhir"] = null;
  if (baris) {
    const periode = periodeDariDb(baris);
    const selesai = await db
      .from("v_keputusan")
      .select("*", { count: "exact", head: true })
      .eq("tahun", periode.tahun)
      .eq("status_sekarang", "done")
      .abortSignal(sinyal());
    if (selesai.error) throw new Error(`Database: ${selesai.error.message}`);
    terakhir = { periode, adaSelesai: (selesai.count ?? 0) > 0 };
  }

  const b = periksaBoleh(berjalan);
  return {
    berjalan: b ? { tahun: b.tahun, versi: b.versi } : null,
    hitungan: uraiHitungan(periksa(hitungan)),
    wilayah: periksa(wilayah).map((r) => ({ rw: r.rw, nama: r.nama, penduduk: r.penduduk, anggaranLalu: r.anggaran_lalu })),
    terakhir,
    pekerjaan: periksa(pekerjaan).map((r: Baca<"v_keputusan">) => {
      const k = keputusanDariDb(r);
      return {
        proposalId: k.proposalId,
        tahun: wajib(r.tahun, "tahun"),
        judul: k.judul,
        hasil: k.hasil,
        biaya: k.biaya,
        rw: k.rw,
        sumberDana: k.sumberDana,
        statusSekarang: k.statusSekarang,
      };
    }),
  };
}

/** Tahun periode yang sedang berjalan dan jumlah usulan yang menunggu keputusan, untuk ringkasan admin. */
export async function bacaTahunBerjalan(pengguna: Pengguna): Promise<number | null> {
  pastikanAdmin(pengguna);
  const jawaban = await db.from("periode").select("tahun, versi").eq("status", "berjalan").abortSignal(sinyal()).maybeSingle();
  const r = periksaBoleh(jawaban);
  return r ? r.tahun : null;
}
