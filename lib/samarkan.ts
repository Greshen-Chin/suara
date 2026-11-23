// Menyamarkan data pribadi dalam teks usulan SEBELUM dikirim ke AI. Murni, tanpa akses jaringan atau database.
//
// Yang disamarkan: email, NIK/KK (16 digit), nomor telepon Indonesia, nomor rekening (bila disebut sebagai
// rekening), alamat rumah bernomor ("Jl. Mawar No. 12"), dan sapaan + nama ("Bu Sari", "Pak RT Budi",
// "bernama Sutrisno"). Yang TIDAK boleh tersamarkan: biaya, "RW 07", "SDN 03", dan nomor lain tanpa konteks
// pribadi (lihat lib/samarkan.test.ts).
//
// Samaran ini pendekatan berbasis pola, BUKAN jaminan. Nama orang tanpa sapaan ("Sutrisno melapor") dan
// alamat tanpa nomor lolos. Karena itu admin melihat teks yang akan dikirim lebih dulu, dan data yang
// dikirim sudah dibatasi pada judul, deskripsi, dan kategori.

export type JenisSamaran = "email" | "nomor identitas" | "telepon" | "nomor rekening" | "alamat" | "nama";

export interface BagianTeks {
  teks: string;
  /** true bila bagian ini pengganti dari data pribadi, mis. "[nama]". */
  samar: boolean;
}

export interface HasilSamaran {
  /** Teks yang dikirim, dengan penanda seperti [nama] di tempat data pribadi. */
  teks: string;
  /** Teks yang sama, dipecah supaya bagian yang disamarkan bisa ditandai di layar. */
  bagian: BagianTeks[];
  jumlah: number;
}

// Penanda sementara yang tidak mungkin ada di teks asli (karakter kontrol dibuang dari masukan lebih dulu).
const BUKA = "\u0001";
const TUTUP = "\u0002";
const tanda = (jenis: JenisSamaran) => `${BUKA}${jenis}${TUTUP}`;

const HARI = "Senin|Selasa|Rabu|Kamis|Jumat|Jum'at|Sabtu|Minggu";
const SAPAAN =
  "(?:Pak|Bapak|Bu|Ibu|Mbak|Mas|Kak|Dik|Bang|Mbah|Haji|Hajah|Ustaz|Ustadz|Ustadzah|Pak Haji|Bu Haji|Pak Ustaz)";
const JABATAN = "(?:RT|RW|Lurah|Kades|Dukuh|Camat|Kadus)";

interface Aturan {
  jenis: JenisSamaran;
  pola: RegExp;
  ganti: (...kena: string[]) => string;
}

const ATURAN: Aturan[] = [
  // Email dulu: bagian lokalnya bisa berisi angka yang mirip nomor telepon.
  { jenis: "email", pola: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, ganti: () => tanda("email") },
  // NIK atau KK: tepat 16 digit, boleh dipisah spasi, titik, atau tanda hubung per empat angka.
  {
    jenis: "nomor identitas",
    pola: /(?<![\d])\d{4}[ .-]?\d{4}[ .-]?\d{4}[ .-]?\d{4}(?![\d])/g,
    ganti: () => tanda("nomor identitas"),
  },
  // Telepon seluler: 08xx, +62 8xx, atau 628xx, total 10 sampai 13 digit.
  {
    jenis: "telepon",
    pola: /(?<![\d])(?:\+?62[ .-]?|0)8\d{1,2}(?:[ .-]?\d{3,4}){2,3}(?![\d])/g,
    ganti: () => tanda("telepon"),
  },
  // Rekening hanya bila disebut sebagai rekening: angka biasa (biaya, jumlah warga) tidak boleh ikut.
  {
    jenis: "nomor rekening",
    pola: /\b((?:no\.?\s*)?rek(?:ening)?\.?(?:\s+(?:[A-Za-z]{2,12}))?\s*[:#]?\s*)(\d[\d .-]{6,20}\d)/gi,
    ganti: (_semua, awal) => `${awal}${tanda("nomor rekening")}`,
  },
  // Alamat rumah: nama jalan + "No." + angka (+ RT/RW). Jalan tanpa nomor ("Jalan SDN 03") tidak disamarkan.
  {
    jenis: "alamat",
    pola: /\b(?:Jl\.?|Jalan|Gg\.?|Gang)\s+[A-Za-z][\w.'-]*(?:\s+[A-Za-z][\w.'-]*){0,4}?\s+(?:[Nn]omor|[Nn]o\.?)\s*\.?\s*\d+[A-Za-z]?(?:\s*,?\s*RT\s*\.?\s*\d+(?:\s*[/,]?\s*RW\s*\.?\s*\d+)?)?/g,
    ganti: () => tanda("alamat"),
  },
  // "bernama Sutrisno"
  {
    jenis: "nama",
    pola: /\b(bernama|atas nama|a\.n\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g,
    ganti: (_semua, kata) => `${kata} ${tanda("nama")}`,
  },
  // Sapaan + nama: "Bu Sari", "Pak RT Budi", "Haji Ahmad Fauzi". Hari ("Pak RT Selasa") tidak dianggap nama.
  {
    jenis: "nama",
    pola: new RegExp(
      `\\b${SAPAAN}(?:\\s+${JABATAN}(?:\\s*\\d{1,2})?)?\\s+(?!(?:${HARI})\\b)[A-Z][a-z]+(?:\\s+(?!(?:${HARI})\\b)[A-Z][a-z]{2,})?`,
      "g",
    ),
    ganti: () => tanda("nama"),
  },
];

/** Pecah teks bertanda menjadi bagian biasa dan bagian samaran. */
function pecah(bertanda: string): { teks: string; bagian: BagianTeks[]; jumlah: number } {
  const bagian: BagianTeks[] = [];
  let jumlah = 0;
  const pola = new RegExp(`${BUKA}([^${TUTUP}]*)${TUTUP}`, "g");
  let akhir = 0;
  for (const m of bertanda.matchAll(pola)) {
    if (m.index > akhir) bagian.push({ teks: bertanda.slice(akhir, m.index), samar: false });
    bagian.push({ teks: `[${m[1]}]`, samar: true });
    jumlah++;
    akhir = m.index + m[0].length;
  }
  if (akhir < bertanda.length) bagian.push({ teks: bertanda.slice(akhir), samar: false });
  return { teks: bagian.map((b) => b.teks).join(""), bagian, jumlah };
}

/** Samarkan satu teks. Teks kosong menghasilkan bagian kosong. */
export function samarkan(asli: string): HasilSamaran {
  // Penanda internal dibuang dari masukan supaya tidak bisa dipalsukan.
  let kini = asli.replace(/[\u0001\u0002]/g, "");
  for (const a of ATURAN) {
    kini = kini.replace(a.pola, (...args) => a.ganti(...(args.slice(0, -2) as string[])));
  }
  return pecah(kini);
}
