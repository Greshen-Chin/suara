// Penilaian "usulan ini mirip dengan usulan yang sudah ada?". Logika murni: SQL hanya
// mengambil kandidat (cari_usulan_mirip / cari_usulan_mirip_teks), semua keputusan ada di
// sini supaya bisa diuji dan angkanya diubah tanpa migrasi.
//
// Rumus skor gabungan, hasilnya 0 sampai 1:
//
//   makna  = potong((kosinus - kosinusBawah) / (kosinusAtas - kosinusBawah), 0, 1)
//   lokasi = 1 bila RW sama, 0 bila beda
//   skor   = bobotMakna x makna + bobotLokasi x lokasi
//
// Kenapa kosinus tidak langsung dipakai: embedding e5 memberi kosinus tinggi bahkan untuk
// dua teks yang tidak berkaitan (diukur 0,78 sampai 0,84 pada data seed), jadi skala
// mentahnya sempit. Rentang [kosinusBawah, kosinusAtas] meregangkannya ke 0..1.
// Angka-angkanya diukur, bukan ditebak: lihat docs/forum.md dan
// `npm run kemiripan:kalibrasi`.

export interface ParameterKemiripan {
  /** Kosinus yang dianggap "tidak berkaitan". Di bawah ini maknanya 0. */
  kosinusBawah: number;
  /** Kosinus yang dianggap "hampir sama". Di atas ini maknanya 1. */
  kosinusAtas: number;
  bobotMakna: number;
  bobotLokasi: number;
  /** Skor minimum agar usulan ditampilkan sebagai mirip (mode embedding). */
  ambang: number;
  /** Kemiripan teks (trigram) yang dianggap 1 pada mode cadangan. */
  teksAtas: number;
  /** Skor minimum pada mode cadangan (lebih tinggi: kata sama belum tentu maksud sama). */
  ambangTeks: number;
  /** Maksimum usulan mirip yang ditampilkan. */
  maksTampil: number;
}

// Hasil kalibrasi pada seed (13 usulan, 15 kalimat uji): 9 dari 11 target ditemukan, 0 usulan
// salah ikut tampil. Dipilih di tengah dataran nilai terbaik, bukan di tepinya. Lihat docs/forum.md.
export const DEFAULT_KEMIRIPAN: ParameterKemiripan = {
  kosinusBawah: 0.82,
  kosinusAtas: 0.94,
  bobotMakna: 0.8,
  bobotLokasi: 0.2,
  // Setara kosinus >= 0,895 bila RW sama dan >= 0,925 bila RW berbeda.
  ambang: 0.7,
  teksAtas: 0.5,
  ambangTeks: 0.5,
  maksTampil: 3,
};

export interface MasukanSkor {
  /** Kosinus embedding, atau null pada mode cadangan. */
  kosinus: number | null;
  /** Mode cadangan: kemiripan trigram judul dan judul+isi (0..1). */
  simJudul?: number;
  simIsi?: number;
  samaRw: boolean;
}

const potong = (n: number, min: number, maks: number) => Math.min(maks, Math.max(min, n));

export function hitungSkorMirip(m: MasukanSkor, p: ParameterKemiripan = DEFAULT_KEMIRIPAN): number {
  let makna: number;
  if (m.kosinus !== null) {
    makna = potong((m.kosinus - p.kosinusBawah) / (p.kosinusAtas - p.kosinusBawah), 0, 1);
  } else {
    const sim = 0.4 * (m.simJudul ?? 0) + 0.6 * (m.simIsi ?? 0);
    makna = potong(sim / p.teksAtas, 0, 1);
  }
  const lokasi = m.samaRw ? 1 : 0;
  return p.bobotMakna * makna + p.bobotLokasi * lokasi;
}

// ---------------------------------------------------------------------------
// Alasan yang bisa dibaca manusia
// ---------------------------------------------------------------------------

// Kata yang terlalu umum untuk dijadikan alasan: kata penghubung, kata kerja usulan,
// dan kata yang ada di hampir setiap usulan desa.
const KATA_UMUM = new Set(
  (
    "yang dan atau dengan untuk pada dari dalam ini itu juga sudah belum sering selalu setiap " +
    "agar supaya karena kalau saat ketika bisa harus perlu butuh minta usul usulan kami kita " +
    "saya warga desa dusun kampung rukun tetangga ada tidak tanpa lebih sangat sekali masih " +
    "banyak beberapa antar tolong mohon sebaiknya sekitar sehingga akan dapat para oleh bagi " +
    "sampai hingga demi bahkan namun tetapi serta lalu kemudian sebuah satu dua tiga empat lima " +
    "enam rumah ibu bapak anak orang"
  ).split(" "),
);

function kataKunci(teks: string): string[] {
  const kata = teks
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((k) => k.length >= 4 && !/^\d+$/.test(k) && !KATA_UMUM.has(k));
  return [...new Set(kata)];
}

/** Dua kata kunci yang dipakai kedua usulan, yang paling khas dulu. */
export function kataBersama(
  baru: { judul: string; deskripsi: string },
  lama: { title: string; description: string | null },
): string[] {
  const judulBaru = new Set(kataKunci(baru.judul));
  const judulLama = new Set(kataKunci(lama.title));
  const isiBaru = new Set(kataKunci(`${baru.judul} ${baru.deskripsi}`));
  const isiLama = new Set(kataKunci(`${lama.title} ${lama.description ?? ""}`));

  const beri = (k: string): number => {
    if (judulBaru.has(k) && judulLama.has(k)) return 3; // di kedua judul
    if ((judulBaru.has(k) && isiLama.has(k)) || (judulLama.has(k) && isiBaru.has(k))) return 2;
    if (isiBaru.has(k) && isiLama.has(k)) return 1;
    return 0;
  };
  return [...isiBaru]
    .filter((k) => isiLama.has(k))
    .sort((a, b) => beri(b) - beri(a) || b.length - a.length || a.localeCompare(b))
    .slice(0, 2);
}

export interface MasukanAlasan {
  baru: { judul: string; deskripsi: string; rw: number; kategori?: string | null };
  lama: { title: string; description: string | null; rw: number | null; category: string };
  /** Mode embedding boleh mengaku "maknanya mirip"; mode cadangan tidak (hanya soal kata). */
  mode: "ai" | "teks";
  /** Makna 0..1 dari hitungSkorMirip; dipakai untuk menyebut "sangat mirip". */
  makna: number;
}

/**
 * Satu kalimat pendek tentang kenapa dua usulan dianggap mirip, mis.
 * "Sama-sama menyebut “lampu” dan “jalan”, di RW yang sama."
 * Hanya menyebut hal yang benar-benar terukur: kata yang sama, RW, kategori.
 */
export function alasanKemiripan({ baru, lama, mode, makna }: MasukanAlasan): string {
  const bagian: string[] = [];
  const kata = kataBersama(baru, lama);
  if (kata.length > 0) {
    bagian.push(`Sama-sama menyebut ${kata.map((k) => `“${k}”`).join(" dan ")}`);
  } else if (mode === "ai" && makna >= 0.5) {
    bagian.push("Maknanya mirip, meski kata-katanya berbeda");
  } else {
    bagian.push("Isinya mirip");
  }
  if (lama.rw !== null && lama.rw === baru.rw) bagian.push("di RW yang sama");
  else if (lama.rw !== null) bagian.push(`di RW ${String(lama.rw).padStart(2, "0")}`);
  if (baru.kategori && baru.kategori === lama.category) bagian.push(`kategori sama (${lama.category})`);
  return bagian.join(", ") + ".";
}

// ---------------------------------------------------------------------------
// Memilih yang ditampilkan
// ---------------------------------------------------------------------------

export interface KandidatMirip {
  id: string;
  title: string;
  description: string | null;
  category: string;
  rw: number | null;
  status: string;
  voteCount: number;
  kosinus?: number | null;
  simJudul?: number;
  simIsi?: number;
}

export interface UsulanMirip {
  id: string;
  judul: string;
  rw: number | null;
  status: string;
  dukungan: number;
  /** 0..1, hanya untuk urutan; tidak ditampilkan ke warga sebagai persen. */
  skor: number;
  alasan: string;
}

export function pilihUsulanMirip(
  kandidat: readonly KandidatMirip[],
  baru: { judul: string; deskripsi: string; rw: number; kategori?: string | null },
  mode: "ai" | "teks",
  p: ParameterKemiripan = DEFAULT_KEMIRIPAN,
): UsulanMirip[] {
  const ambang = mode === "ai" ? p.ambang : p.ambangTeks;
  return kandidat
    .map((k) => {
      const masukan: MasukanSkor = {
        kosinus: mode === "ai" ? (k.kosinus ?? 0) : null,
        simJudul: k.simJudul,
        simIsi: k.simIsi,
        samaRw: k.rw === baru.rw,
      };
      const skor = hitungSkorMirip(masukan, p);
      const makna =
        mode === "ai"
          ? potong(((k.kosinus ?? 0) - p.kosinusBawah) / (p.kosinusAtas - p.kosinusBawah), 0, 1)
          : potong((0.4 * (k.simJudul ?? 0) + 0.6 * (k.simIsi ?? 0)) / p.teksAtas, 0, 1);
      return { k, skor, makna };
    })
    .filter((x) => x.skor >= ambang)
    .sort((a, b) => b.skor - a.skor || b.k.voteCount - a.k.voteCount)
    .slice(0, p.maksTampil)
    .map(({ k, skor, makna }) => ({
      id: k.id,
      judul: k.title,
      rw: k.rw,
      status: k.status,
      dukungan: k.voteCount,
      skor,
      alasan: alasanKemiripan({ baru, lama: k, mode, makna }),
    }));
}
