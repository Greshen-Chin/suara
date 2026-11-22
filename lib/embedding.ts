// Embedding teks untuk mengenali usulan yang mirip dari MAKNANYA.
// Hanya untuk Node di server (onnxruntime-node). Jangan diimpor dari komponen klien.
//
// Model: Xenova/multilingual-e5-small (ONNX, kuantisasi 8-bit), 384 dimensi, mengerti
// bahasa Indonesia. Cocok dengan kolom proposals.embedding vector(384).
//
// Ukuran dan waktu (diukur di mesin pengembangan, Node 24, Windows):
//   berkas model 118 MB (tokenizer +17 MB), unduhan pertama sekitar 10 detik,
//   muat dari cache disk 0,8 detik, inferensi satu teks 4-15 ms setelah hangat.
//
// Kenapa awalan "query: " di kedua sisi: kartu model e5 menyebut awalan "query: " untuk
// tugas simetris seperti kemiripan teks dan deteksi duplikat. "passage: " hanya untuk
// dokumen yang dicari lewat pertanyaan, bukan kasus kita (dua usulan yang saling dibandingkan).
import { tmpdir } from "node:os";
import { join } from "node:path";

export const NAMA_MODEL = "Xenova/multilingual-e5-small";
export const DIMENSI = 384;
/** Batas waktu satu permintaan. Lewat dari ini, pemanggil turun ke kemiripan teks. */
export const BATAS_EMBEDDING_MS = 3000;

// Model ± 512 token; 1.200 karakter sudah lebih dari cukup untuk judul + deskripsi usulan.
const MAKS_KARAKTER = 1200;

type Pipa = (
  teks: string | string[],
  opsi: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

let pemuat: Promise<Pipa> | null = null;

/** Muat model sekali per proses. Kalau gagal, percobaan berikutnya mulai dari awal. */
function muatModel(): Promise<Pipa> {
  pemuat ??= (async () => {
    const { env, pipeline } = await import("@huggingface/transformers");
    // Di server tanpa disk tetap (mis. serverless) hanya /tmp yang boleh ditulis.
    env.cacheDir = process.env.EMBEDDING_CACHE_DIR ?? join(tmpdir(), "suara-model");
    const pipa = await pipeline("feature-extraction", NAMA_MODEL, { dtype: "q8" });
    return pipa as unknown as Pipa;
  })().catch((err: unknown) => {
    pemuat = null;
    throw err;
  });
  return pemuat;
}

/**
 * Mulai memuat model di latar belakang tanpa menunggu. Dipanggil saat halaman usulan
 * dibuka, supaya saat warga menekan "Periksa usulan serupa" modelnya sudah siap.
 */
export function mulaiPemanasan(): void {
  muatModel().catch(() => {
    /* kegagalan dilaporkan saat embedding benar-benar diminta */
  });
}

/** Teks yang dibandingkan: judul dan deskripsi, dipangkas dan dirapikan spasinya. */
export function susunTeksEmbedding(judul: string, deskripsi: string): string {
  const isi = `${judul.trim()}. ${deskripsi.trim()}`.replace(/\s+/g, " ");
  return `query: ${isi.slice(0, MAKS_KARAKTER)}`;
}

class BatasWaktu extends Error {
  constructor() {
    super("Embedding melewati batas waktu");
  }
}

/**
 * Vektor 384 dimensi (sudah dinormalkan, jadi hasil kali titik = kosinus).
 * Melempar bila model gagal dimuat atau melewati batas waktu. Saat melewati batas waktu,
 * pemuatan model tetap berjalan di latar belakang untuk permintaan berikutnya.
 */
export async function embedTeks(teks: string, batasMs = BATAS_EMBEDDING_MS): Promise<number[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const habis = new Promise<never>((_, tolak) => {
    timer = setTimeout(() => tolak(new BatasWaktu()), batasMs);
  });
  try {
    const hitung = muatModel().then(async (pipa) => {
      const keluaran = await pipa(teks, { pooling: "mean", normalize: true });
      const vektor = keluaran.tolist()[0];
      if (vektor?.length !== DIMENSI) {
        throw new Error(`Dimensi embedding ${vektor?.length}, seharusnya ${DIMENSI}`);
      }
      return vektor;
    });
    return await Promise.race([hitung, habis]);
  } finally {
    clearTimeout(timer);
  }
}

/** Format literal pgvector: "[0.1,0.2,...]". Dikirim ke Postgres sebagai teks. */
export function keLiteralVektor(vektor: readonly number[]): string {
  return `[${vektor.map((x) => Number(x.toFixed(6))).join(",")}]`;
}
