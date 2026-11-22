// Pratinjau dampak: apa yang berubah pada Garis Pagu bila sebuah keputusan disimpan.
//
// Fungsi murni di atas pilihOptimal (lib/seleksi.ts), kembaran TypeScript dari pilih_optimal di
// SQL. TIDAK ada rumus baru di sini: pratinjau dan hasil sungguhan memakai mesin yang sama, dan
// supabase/tests/admin.test.ts membuktikan hasilnya sama dengan rekomendasi_resmi setelah
// perubahan disimpan. Sengaja tanpa akses database dan tanpa "server-only", supaya komponennya
// bisa dipakai ulang oleh halaman /simulasi (warga bermain dengan pagu dan bobot tanpa menyimpan).
import type { BarisRekomendasi, BarisWilayah } from "./data";
import { rupiah } from "./format.ts";
import { susunModePagu, type ModePagu } from "./pagu-model.ts";
import {
  pilihOptimal,
  statusUsulan,
  type Bobot,
  type HasilPilih,
  type StatusUsulan,
  type Usulan,
  type Wilayah,
} from "./seleksi.ts";

/** Usulan dengan waktu dibuatnya (ISO), untuk meniru urutan seri di SQL: skor, suara, created_at, id. */
export interface UsulanHitung extends Usulan {
  dibuat: string;
}

export interface DasarHitung {
  usulan: readonly UsulanHitung[];
  wilayah: readonly Wilayah[];
  pagu: number;
  bobot: Bobot;
}

export type Perubahan =
  | { jenis: "pagu"; pagu: number }
  | { jenis: "bobot"; bobot: Bobot }
  /** forum -> voting: usulan beserta urgensi yang sedang diisi admin. */
  | { jenis: "masuk"; usulan: UsulanHitung }
  /** voting -> forum. */
  | { jenis: "keluar"; id: string };

/** created_at, lalu id: urutan yang dipakai pilih_optimal untuk memutus seri. */
function urutMasuk(a: UsulanHitung, b: UsulanHitung): number {
  return a.dibuat < b.dibuat ? -1 : a.dibuat > b.dibuat ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function terapkanPerubahan(dasar: DasarHitung, p: Perubahan): DasarHitung {
  switch (p.jenis) {
    case "pagu":
      return { ...dasar, pagu: p.pagu };
    case "bobot":
      return { ...dasar, bobot: p.bobot };
    case "masuk":
      return {
        ...dasar,
        usulan: [...dasar.usulan.filter((u) => u.id !== p.usulan.id), p.usulan].sort(urutMasuk),
      };
    case "keluar":
      return { ...dasar, usulan: dasar.usulan.filter((u) => u.id !== p.id) };
  }
}

/** Rekomendasi resmi: kombinasi terbaik dengan bobot dan pagu pada `dasar`. Melempar RangeError bila lebih dari 16 usulan. */
export function hitungRekomendasi(dasar: DasarHitung): HasilPilih[] {
  return pilihOptimal(dasar.usulan, dasar.wilayah, dasar.pagu, dasar.bobot);
}

// ---------------------------------------------------------------------------
// Membandingkan dua keadaan
// ---------------------------------------------------------------------------

export interface PosisiHitung {
  peringkat: number;
  status: StatusUsulan;
  skor: number;
  /** Jumlah usulan yang dihitung pada keadaan ini. */
  jumlah: number;
}

/** tetap/berubah: ada di kedua keadaan. masuk: baru ikut dihitung. keluar: tidak lagi dihitung. */
export type Kejadian = "tetap" | "berubah" | "masuk" | "keluar";

export interface BarisBanding {
  id: string;
  nama: string;
  judul: string;
  rw: number;
  biaya: number;
  sebelum: PosisiHitung | null;
  sesudah: PosisiHitung | null;
  kejadian: Kejadian;
}

export interface HasilBanding {
  /** Usulan yang ada di kedua keadaan dan statusnya berubah. */
  berubah: BarisBanding[];
  /** Usulan yang ada di kedua keadaan dan statusnya sama. */
  tetap: BarisBanding[];
  /**
   * Usulan yang baru ikut dihitung (forum -> voting), menurut peringkat sesudah. Admin memasukkan satu
   * per satu, jadi paling banyak satu; simulasi bisa menambahkan beberapa sekaligus.
   */
  masuk: BarisBanding[];
  /** Usulan yang tidak lagi dihitung (voting -> forum). */
  keluar: BarisBanding | null;
  sisaSebelum: number;
  sisaSesudah: number;
  terbiayaiSebelum: number;
  terbiayaiSesudah: number;
}

/** Posisi tiap usulan pada rekomendasi, dengan status yang sama dengan Garis Pagu di halaman utama. */
export function petaPosisi(hasil: readonly HasilPilih[]): Map<string, PosisiHitung> {
  const peta = new Map<string, PosisiHitung>();
  // Mode 'skor': "ditunda" dihitung sama dengan Garis Pagu di halaman utama dan posisi di forum.
  for (const h of statusUsulan(hasil, "skor")) {
    peta.set(h.id, { peringkat: h.peringkat, status: h.status, skor: h.skor, jumlah: hasil.length });
  }
  return peta;
}

const sisaPagu = (pagu: number, hasil: readonly HasilPilih[]) =>
  pagu - hasil.filter((h) => h.selected).reduce((n, h) => n + h.estimatedBudget, 0);

export function bandingkan(
  sebelum: DasarHitung,
  sesudah: DasarHitung,
  hasilSebelum: readonly HasilPilih[],
  hasilSesudah: readonly HasilPilih[],
): HasilBanding {
  const posLama = petaPosisi(hasilSebelum);
  const posBaru = petaPosisi(hasilSesudah);
  const info = new Map<string, Usulan>();
  for (const u of [...sebelum.usulan, ...sesudah.usulan]) info.set(u.id, u);

  const berubah: BarisBanding[] = [];
  const tetap: BarisBanding[] = [];
  const masuk: BarisBanding[] = [];
  let keluar: BarisBanding | null = null;

  // Urutan mengikuti peringkat sesudah (yang masih dihitung), lalu yang keluar.
  const urutan = [...hasilSesudah.map((h) => h.id), ...hasilSebelum.map((h) => h.id).filter((id) => !posBaru.has(id))];
  for (const id of urutan) {
    const u = info.get(id);
    if (!u) continue;
    const lama = posLama.get(id) ?? null;
    const baru = posBaru.get(id) ?? null;
    const kejadian: Kejadian = !lama ? "masuk" : !baru ? "keluar" : lama.status === baru.status ? "tetap" : "berubah";
    const baris: BarisBanding = {
      id,
      nama: u.namaSingkat,
      judul: u.title,
      rw: u.rw,
      biaya: u.estimatedBudget,
      sebelum: lama,
      sesudah: baru,
      kejadian,
    };
    if (kejadian === "berubah") berubah.push(baris);
    else if (kejadian === "tetap") tetap.push(baris);
    else if (kejadian === "masuk") masuk.push(baris);
    else keluar = baris;
  }

  return {
    berubah,
    tetap,
    masuk,
    keluar,
    sisaSebelum: sisaPagu(sebelum.pagu, hasilSebelum),
    sisaSesudah: sisaPagu(sesudah.pagu, hasilSesudah),
    terbiayaiSebelum: hasilSebelum.filter((h) => h.selected).length,
    terbiayaiSesudah: hasilSesudah.filter((h) => h.selected).length,
  };
}

// ---------------------------------------------------------------------------
// Kalimat yang bisa dibaca warga
// ---------------------------------------------------------------------------

export const TEKS_STATUS: Record<StatusUsulan, string> = {
  terpilih: "Terbiayai",
  ditunda: "Ditunda",
  "tidak-terpilih": "Tidak terpilih",
};

export const labelRw = (rw: number): string => `RW ${String(rw).padStart(2, "0")}`;

/** "Lampu PJU RW 07": nama singkat usulan dan RW-nya, seperti label batang di Garis Pagu. */
export const namaDenganRw = (b: Pick<BarisBanding, "nama" | "rw">): string => `${b.nama} ${labelRw(b.rw)}`;

/** Ringkasan satu baris: "2 usulan berubah status. Sisa pagu Rp 12 juta menjadi Rp 40 juta." */
export function ringkasanBanding(b: HasilBanding): string {
  const lain = b.masuk.length > 0 || b.keluar ? " lain" : "";
  const n = b.berubah.length;
  const status = n === 0 ? `Tidak ada usulan${lain} yang berubah status.` : `${n} usulan${lain} berubah status.`;
  if (b.sisaSebelum === b.sisaSesudah) return n === 0 ? status : `${status} Sisa pagu tetap ${rupiah(b.sisaSesudah)}.`;
  return `${status} Sisa pagu ${rupiah(b.sisaSebelum)} menjadi ${rupiah(b.sisaSesudah)}.`;
}

const BATAS_NAMA_GESER = 3;

function kalimatGeser(berubah: readonly BarisBanding[]): string {
  if (berubah.length === 0) return "";
  const tampil = berubah
    .slice(0, BATAS_NAMA_GESER)
    .map((b) => `${namaDenganRw(b)} bergeser menjadi ${TEKS_STATUS[b.sesudah!.status]}.`)
    .join(" ");
  const sisa = berubah.length - BATAS_NAMA_GESER;
  return ` ${tampil}${sisa > 0 ? ` ${sisa} usulan lain juga berubah status.` : ""}`;
}

/**
 * Kalimat khusus perpindahan, mis. "Jika dimasukkan dengan urgensi 8, usulan ini berada di
 * peringkat 3 dari 8 rekomendasi: Terbiayai. Lampu PJU RW 07 bergeser menjadi Ditunda."
 * null bila perubahannya pagu atau bobot.
 */
export function kalimatPerpindahan(b: HasilBanding, urgensi?: number): string | null {
  const masuk = b.masuk.filter((m) => m.sesudah !== null);
  if (masuk.length === 1) {
    const s = masuk[0].sesudah!;
    const awal = urgensi === undefined ? "Jika dimasukkan, usulan ini" : `Jika dimasukkan dengan urgensi ${urgensi}, usulan ini`;
    return `${awal} berada di peringkat ${s.peringkat} dari ${s.jumlah} rekomendasi: ${TEKS_STATUS[s.status]}.${kalimatGeser(b.berubah)}`;
  }
  if (masuk.length > 1) {
    const bagian = masuk.map((m) => `${namaDenganRw(m)} berada di peringkat ${m.sesudah!.peringkat} dari ${m.sesudah!.jumlah} rekomendasi: ${TEKS_STATUS[m.sesudah!.status]}`);
    return `Jika dimasukkan, ${bagian.join("; ")}.${kalimatGeser(b.berubah)}`;
  }
  if (b.keluar) {
    return `Jika dikembalikan ke pembahasan, usulan ini tidak lagi dihitung dalam anggaran.${kalimatGeser(b.berubah)}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hasil lengkap untuk layar
// ---------------------------------------------------------------------------

/** Untuk PaguBar: bentuk yang sama dengan Garis Pagu di halaman utama. */
export function modePaguDari(hasil: readonly HasilPilih[], wilayah: readonly Wilayah[], pagu: number): ModePagu {
  const baris: BarisRekomendasi[] = hasil.map((h) => ({
    peringkat: h.peringkat,
    id: h.id,
    title: h.title,
    nama_singkat: h.namaSingkat,
    category: h.category,
    rw: h.rw,
    estimated_budget: h.estimatedBudget,
    vote_count: h.voteCount,
    urgency_score: h.urgencyScore,
    skor: Math.round(h.skor * 10_000) / 10_000,
    selected: h.selected,
    total_berjalan: h.totalBerjalan,
  }));
  const rw: BarisWilayah[] = wilayah.map((w) => ({
    rw: w.rw,
    nama: w.nama,
    penduduk: w.penduduk,
    anggaran_lalu: w.anggaranLalu,
    jumlah_usulan: 0,
    jumlah_suara: 0,
  }));
  return susunModePagu("rekomendasi", baris, rw, pagu);
}

export interface HasilPratinjau {
  sekarang: ModePagu;
  sesudah: ModePagu;
  paguSekarang: number;
  paguSesudah: number;
  banding: HasilBanding;
  ringkasan: string;
  /** Kalimat khusus untuk perpindahan status; null untuk pagu dan bobot. */
  perpindahan: string | null;
}

export function hitungPratinjau(dasar: DasarHitung, perubahan: Perubahan): HasilPratinjau {
  const baru = terapkanPerubahan(dasar, perubahan);
  const hasilLama = hitungRekomendasi(dasar);
  const hasilBaru = hitungRekomendasi(baru);
  const banding = bandingkan(dasar, baru, hasilLama, hasilBaru);
  return {
    sekarang: modePaguDari(hasilLama, dasar.wilayah, dasar.pagu),
    sesudah: modePaguDari(hasilBaru, baru.wilayah, baru.pagu),
    paguSekarang: dasar.pagu,
    paguSesudah: baru.pagu,
    banding,
    ringkasan: ringkasanBanding(banding),
    perpindahan: kalimatPerpindahan(
      banding,
      perubahan.jenis === "masuk" ? perubahan.usulan.urgencyScore : undefined,
    ),
  };
}
