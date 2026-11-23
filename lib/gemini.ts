// Klien Gemini lewat REST dengan `fetch`, tanpa dependensi baru. Hanya untuk server: kunci dibaca dari
// lingkungan dan TIDAK PERNAH dikembalikan, dicatat, atau dimasukkan ke pesan galat.
//
// Memakai `generateContent` (didukung penuh) dan bukan Interactions: bentuk keluaran terstruktur
// (responseMimeType + responseSchema) dan cara menonaktifkan penyimpanan permintaan pada Interactions tidak
// bisa dipastikan dari dokumen yang dibaca; generateContent tidak membuat sumber daya yang bisa dilanjutkan.
// Catatan jujur: pada paket gratis Google boleh memakai isi permintaan untuk mengembangkan produknya, dan
// peninjau manusia bisa membacanya, karena itu hanya judul, deskripsi, dan kategori yang disamarkan yang dikirim.
//
// Sengaja tanpa "server-only" supaya bisa diuji; modul ini tidak boleh diimpor dari komponen klien.

export const MODEL_BAWAAN = "gemini-3.5-flash-lite";
export const ALAMAT_BAWAAN = "https://generativelanguage.googleapis.com";
/** Batas waktu keseluruhan satu permintaan, termasuk satu kali ulang. Cloud Run bawaannya 300 detik. */
export const BATAS_WAKTU_MS = 12_000;

const TINGKAT_BERPIKIR = ["minimal", "low", "medium", "high"] as const;
type TingkatBerpikir = (typeof TINGKAT_BERPIKIR)[number];

export interface KonfigurasiGemini {
  kunci: string;
  model: string;
  alamat: string;
  berpikir: TingkatBerpikir | null;
}

/**
 * Konfigurasi dari lingkungan, atau null bila kunci tidak terpasang (fitur mati, tanpa jejak di antarmuka).
 * GEMINI_BASE_URL hanya diterima untuk alamat resmi atau mesin lokal (server tiruan E2E): alamat lain diabaikan
 * supaya kunci tidak pernah terkirim ke tujuan yang tidak dikenal karena salah ketik.
 */
export function bacaKonfigurasiGemini(env: Record<string, string | undefined> = process.env): KonfigurasiGemini | null {
  const kunci = env.GEMINI_API_KEY?.trim();
  if (!kunci) return null;
  const model = /^[a-z0-9][a-z0-9._-]{1,60}$/i.test(env.GEMINI_MODEL?.trim() ?? "") ? env.GEMINI_MODEL!.trim() : MODEL_BAWAAN;
  const diminta = env.GEMINI_BASE_URL?.trim().replace(/\/+$/, "");
  const diizinkan =
    diminta !== undefined &&
    (diminta === ALAMAT_BAWAAN || /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d{2,5})?$/.test(diminta));
  const berpikir = TINGKAT_BERPIKIR.find((t) => t === env.GEMINI_THINKING?.trim()) ?? null;
  return { kunci, model, alamat: diizinkan ? diminta : ALAMAT_BAWAAN, berpikir };
}

export type KodeGalatGemini =
  | "kuota" // 429
  | "kunci" // 401/403, kunci salah atau tidak berhak
  | "permintaan" // 400/404: permintaan atau model ditolak
  | "server" // 5xx
  | "batas_waktu"
  | "jaringan"
  | "kosong" // badan kosong atau tanpa kandidat
  | "diblokir" // disaring oleh filter keamanan
  | "terpotong"; // keluaran habis sebelum selesai

export type HasilGemini =
  | { ok: true; teks: string; durasiMs: number }
  | { ok: false; kode: KodeGalatGemini; status?: number; durasiMs: number };

export interface PermintaanGemini {
  sistem: string;
  pengguna: string;
  skema: Record<string, unknown>;
}

type Pengambil = typeof fetch;

interface BadanJawaban {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** Badan permintaan. Dipisah supaya tes bisa memeriksa persis apa yang dikirim (A-06). */
export function susunBadanGemini(k: KonfigurasiGemini, p: PermintaanGemini): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: p.sistem }] },
    contents: [{ role: "user", parts: [{ text: p.pengguna }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: p.skema,
      temperature: 0.2,
      // Token berpikir ikut terhitung; batas yang longgar mencegah jawaban terpotong sebelum JSON selesai.
      maxOutputTokens: 4096,
      ...(k.berpikir && { thinkingConfig: { thinkingLevel: k.berpikir } }),
    },
  };
}

function urai(status: number, badan: BadanJawaban | null): KodeGalatGemini | { teks: string } {
  if (status === 429) return "kuota";
  if (status === 401 || status === 403) return "kunci";
  if (status >= 500) return "server";
  if (status >= 400) return "permintaan";
  if (!badan) return "kosong";
  if (badan.promptFeedback?.blockReason) return "diblokir";
  const kandidat = badan.candidates?.[0];
  if (!kandidat) return "kosong";
  if (kandidat.finishReason === "SAFETY" || kandidat.finishReason === "PROHIBITED_CONTENT" || kandidat.finishReason === "BLOCKLIST") {
    return "diblokir";
  }
  if (kandidat.finishReason === "MAX_TOKENS") return "terpotong";
  const teks = (kandidat.content?.parts ?? [])
    .filter((b) => !b.thought && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
  return teks === "" ? "kosong" : { teks };
}

/**
 * Satu permintaan, batas waktu keseluruhan 12 detik. Satu kali ulang HANYA untuk galat jaringan atau 503, dan
 * hanya bila waktu masih cukup; 429 tidak diulang (mengulang hanya menghabiskan kuota lebih cepat).
 * Yang dicatat ke konsol hanya jenis galat, kode HTTP, model, dan durasi: tidak ada isi usulan, tidak ada kunci.
 */
export async function panggilGemini(
  k: KonfigurasiGemini,
  p: PermintaanGemini,
  opsi: { pengambil?: Pengambil; batasMs?: number; sekarang?: () => number } = {},
): Promise<HasilGemini> {
  const ambil = opsi.pengambil ?? fetch;
  const batas = opsi.batasMs ?? BATAS_WAKTU_MS;
  const sekarang = opsi.sekarang ?? (() => performance.now());
  const mulai = sekarang();
  const sinyal = AbortSignal.timeout(batas);
  const alamat = `${k.alamat}/v1beta/models/${encodeURIComponent(k.model)}:generateContent`;
  const badan = JSON.stringify(susunBadanGemini(k, p));
  const selesai = (h: Omit<Extract<HasilGemini, { ok: false }>, "durasiMs"> | { ok: true; teks: string }): HasilGemini => {
    const durasiMs = Math.round(sekarang() - mulai);
    if (!h.ok) console.error(`gemini gagal: ${h.kode}${h.status ? ` ${h.status}` : ""} model=${k.model} ${durasiMs}ms`);
    return { ...h, durasiMs } as HasilGemini;
  };

  for (let percobaan = 0; percobaan < 2; percobaan++) {
    let status = 0;
    let jawaban: BadanJawaban | null = null;
    try {
      const res = await ambil(alamat, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": k.kunci },
        body: badan,
        signal: sinyal,
        cache: "no-store",
      });
      status = res.status;
      try {
        jawaban = (await res.json()) as BadanJawaban;
      } catch {
        jawaban = null; // badan kosong atau bukan JSON
      }
    } catch (err) {
      const habis = sinyal.aborted || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
      if (habis) return selesai({ ok: false, kode: "batas_waktu" });
      if (percobaan === 0 && batas - (sekarang() - mulai) > 2000) continue;
      return selesai({ ok: false, kode: "jaringan" });
    }

    const hasil = urai(status, jawaban);
    if (typeof hasil === "object") return selesai({ ok: true, teks: hasil.teks });
    if (hasil === "server" && status === 503 && percobaan === 0 && batas - (sekarang() - mulai) > 2000) continue;
    return selesai({ ok: false, kode: hasil, ...(status ? { status } : {}) });
  }
  return selesai({ ok: false, kode: "jaringan" });
}
