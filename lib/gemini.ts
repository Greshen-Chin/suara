// Klien Gemini lewat REST fetch atau Google Cloud Vertex AI (@google/genai). Hanya untuk server:
// kredensial dibaca dari lingkungan dan TIDAK PERNAH dikembalikan, dicatat, atau dimasukkan ke pesan galat.
//
// Memakai `generateContent` (didukung penuh) dan bukan Interactions: bentuk keluaran terstruktur
// (responseMimeType + responseSchema) dan cara menonaktifkan penyimpanan permintaan pada Interactions tidak
// bisa dipastikan dari dokumen yang dibaca; generateContent tidak membuat sumber daya yang bisa dilanjutkan.
// Catatan jujur: pada paket gratis Google boleh memakai isi permintaan untuk mengembangkan produknya, dan
// peninjau manusia bisa membacanya, karena itu hanya judul, deskripsi, dan kategori yang disamarkan yang dikirim.
//
// Sengaja tanpa "server-only" supaya bisa diuji; modul ini tidak boleh diimpor dari komponen klien.

export const MODEL_VERTEX_BAWAAN = "gemini-3.8-flash";
export const MODEL_BAWAAN = "gemini-3.5-flash-lite";
export const ALAMAT_BAWAAN = "https://generativelanguage.googleapis.com";
/** Batas waktu keseluruhan satu permintaan, termasuk satu kali ulang. Cloud Run bawaannya 300 detik. */
export const BATAS_WAKTU_MS = 25_000;

const TINGKAT_BERPIKIR = ["minimal", "low", "medium", "high"] as const;
type TingkatBerpikir = (typeof TINGKAT_BERPIKIR)[number];

const PETA_THINKING_VERTEX: Record<TingkatBerpikir, string> = {
  minimal: "MINIMAL",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

export interface KonfigurasiGemini {
  kunci: string;
  model: string;
  alamat: string;
  berpikir: TingkatBerpikir | null;
  mode?: "vertex" | "api_key" | "backend";
  backendUrl?: string;
  backendSecret?: string;
  project?: string;
  location?: string;
}

/**
 * Konfigurasi dari lingkungan, atau null bila kredensial tidak terpasang (fitur mati, tanpa jejak di antarmuka).
 * Mendukung Dedicated AI Backend (AI_BACKEND_URL), Google Cloud Vertex AI (GOOGLE_CLOUD_PROJECT), maupun GEMINI_API_KEY.
 * GEMINI_BASE_URL hanya diterima untuk alamat resmi atau mesin lokal (server tiruan E2E): alamat lain diabaikan
 * supaya kunci tidak pernah terkirim ke tujuan yang tidak dikenal karena salah ketik.
 */
export function bacaKonfigurasiGemini(env: Record<string, string | undefined> = process.env): KonfigurasiGemini | null {
  const backendUrl = env.AI_BACKEND_URL?.trim();
  const vertexProject = env.GOOGLE_CLOUD_PROJECT?.trim() || env.VERTEX_AI_PROJECT?.trim();
  const kunci = env.GEMINI_API_KEY?.trim();

  // Bila tidak ada AI Backend URL, kredensial Vertex AI, atau API Key Gemini, fitur nonaktif
  if (!backendUrl && !vertexProject && !kunci) return null;

  const mode = backendUrl ? "backend" : vertexProject ? "vertex" : "api_key";
  const modelBawaan = mode === "vertex" || mode === "backend" ? MODEL_VERTEX_BAWAAN : MODEL_BAWAAN;
  const modelDiminta =
    mode === "vertex" || mode === "backend"
      ? (env.VERTEX_AI_MODEL?.trim() || env.GEMINI_MODEL?.trim())
      : env.GEMINI_MODEL?.trim();
  const model = /^[a-z0-9][a-z0-9._-]{1,60}$/i.test(modelDiminta ?? "") ? modelDiminta! : modelBawaan;

  if (mode === "backend") {
    const bersihUrl = backendUrl!.replace(/\/+$/, "");
    const secret = env.AI_BACKEND_SECRET?.trim() || "";
    return {
      kunci: secret,
      model,
      alamat: bersihUrl,
      berpikir: null,
      mode: "backend",
      backendUrl: bersihUrl,
      backendSecret: secret,
    };
  }

  const diminta = env.GEMINI_BASE_URL?.trim().replace(/\/+$/, "");
  const diizinkan =
    diminta !== undefined &&
    (diminta === ALAMAT_BAWAAN || /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d{2,5})?$/.test(diminta));
  const berpikir = TINGKAT_BERPIKIR.find((t) => t === env.GEMINI_THINKING?.trim()) ?? null;

  if (mode === "api_key") {
    return { kunci: kunci!, model, alamat: diizinkan ? diminta : ALAMAT_BAWAAN, berpikir };
  }

  return {
    kunci: kunci || "vertex-ai",
    model,
    alamat: diizinkan ? diminta : ALAMAT_BAWAAN,
    berpikir,
    mode: "vertex",
    project: vertexProject,
    location: env.GOOGLE_CLOUD_LOCATION?.trim() || env.VERTEX_AI_LOCATION?.trim() || "global",
  };
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
  const batas = opsi.batasMs ?? BATAS_WAKTU_MS;
  const sekarang = opsi.sekarang ?? (() => performance.now());
  const mulai = sekarang();
  const selesai = (h: Omit<Extract<HasilGemini, { ok: false }>, "durasiMs"> | { ok: true; teks: string }): HasilGemini => {
    const durasiMs = Math.round(sekarang() - mulai);
    if (!h.ok) console.error(`gemini gagal: ${h.kode}${h.status ? ` ${h.status}` : ""} model=${k.model} ${durasiMs}ms`);
    return { ...h, durasiMs } as HasilGemini;
  };

  // Jalur Dedicated AI Backend (Vercel -> VM GCP): aktif bila mode backend atau process.env.AI_BACKEND_URL terpasang
  const targetBackend =
    k.mode === "backend"
      ? k.backendUrl
      : !opsi.pengambil
        ? process.env.AI_BACKEND_URL?.trim()?.replace(/\/+$/, "")
        : undefined;

  if (k.mode === "backend" || targetBackend) {
    const baseUrl = k.backendUrl || targetBackend;
    const secret = k.backendSecret || process.env.AI_BACKEND_SECRET?.trim() || k.kunci;
    const ambil = opsi.pengambil ?? fetch;
    const sinyal = AbortSignal.timeout(batas);

    try {
      const res = await ambil(`${baseUrl}/api/ai/urgensi`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": secret,
        },
        body: JSON.stringify({
          sistem: p.sistem,
          pengguna: p.pengguna,
          skema: p.skema,
        }),
        signal: sinyal,
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return selesai({ ok: false, kode: "kunci", status: res.status });
        }
        if (res.status === 429) {
          return selesai({ ok: false, kode: "kuota", status: 429 });
        }
        if (res.status >= 500) {
          return selesai({ ok: false, kode: "server", status: res.status });
        }
        return selesai({ ok: false, kode: "permintaan", status: res.status });
      }

      const data = (await res.json()) as { ok?: boolean; teks?: string; error?: string };
      const teks = typeof data?.teks === "string" ? data.teks.trim() : "";
      if (!teks) {
        return selesai({ ok: false, kode: "kosong" });
      }
      return selesai({ ok: true, teks });
    } catch (err) {
      const habis = sinyal.aborted || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
      if (habis) return selesai({ ok: false, kode: "batas_waktu" });
      return selesai({ ok: false, kode: "jaringan" });
    }
  }

  // Jalur Google Cloud Vertex AI: dipakai bila mode vertex, tanpa pengambil tiruan (unit test), dan alamat bawaan
  if (k.mode === "vertex" && !opsi.pengambil && k.alamat === ALAMAT_BAWAAN) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        vertexai: true,
        project: k.project || process.env.GOOGLE_CLOUD_PROJECT || "suara-515516",
        location: k.location || process.env.GOOGLE_CLOUD_LOCATION || "global",
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const err = new Error("Batas waktu terlampaui");
          err.name = "TimeoutError";
          reject(err);
        }, batas);
      });

      const callPromise = ai.models.generateContent({
        model: k.model,
        contents: p.pengguna,
        config: {
          systemInstruction: p.sistem,
          responseMimeType: "application/json",
          responseSchema: p.skema,
          temperature: 0.2,
          maxOutputTokens: 4096,
          ...(k.berpikir && {
            thinkingConfig: {
              thinkingLevel: PETA_THINKING_VERTEX[k.berpikir] as unknown as undefined,
            },
          }),
        },
      });

      const resp = await Promise.race([callPromise, timeoutPromise]);
      const kandidat = resp.candidates?.[0];
      if (
        kandidat?.finishReason === "SAFETY" ||
        kandidat?.finishReason === "PROHIBITED_CONTENT" ||
        kandidat?.finishReason === "BLOCKLIST"
      ) {
        return selesai({ ok: false, kode: "diblokir" });
      }
      if (kandidat?.finishReason === "MAX_TOKENS") {
        return selesai({ ok: false, kode: "terpotong" });
      }
      const teks = resp.text?.trim();
      if (!teks) {
        return selesai({ ok: false, kode: "kosong" });
      }
      return selesai({ ok: true, teks });
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : String(err);
      const nama = err instanceof Error ? err.name : "";

      if (nama === "TimeoutError" || pesan.includes("deadline") || pesan.includes("timeout")) {
        return selesai({ ok: false, kode: "batas_waktu" });
      }
      if (pesan.includes("429") || pesan.includes("RESOURCE_EXHAUSTED") || pesan.includes("quota")) {
        return selesai({ ok: false, kode: "kuota", status: 429 });
      }
      if (
        pesan.includes("401") ||
        pesan.includes("403") ||
        pesan.includes("PERMISSION_DENIED") ||
        pesan.includes("UNAUTHENTICATED")
      ) {
        return selesai({ ok: false, kode: "kunci", status: 403 });
      }
      if (
        pesan.includes("404") ||
        pesan.includes("NOT_FOUND") ||
        pesan.includes("400") ||
        pesan.includes("INVALID_ARGUMENT")
      ) {
        return selesai({ ok: false, kode: "permintaan", status: 400 });
      }
      if (
        pesan.includes("500") ||
        pesan.includes("503") ||
        pesan.includes("INTERNAL") ||
        pesan.includes("UNAVAILABLE")
      ) {
        return selesai({ ok: false, kode: "server", status: 500 });
      }
      if (pesan.includes("SAFETY") || pesan.includes("blocked")) {
        return selesai({ ok: false, kode: "diblokir" });
      }
      return selesai({ ok: false, kode: "jaringan" });
    }
  }

  // Jalur HTTP REST biasa (Google AI Studio atau mock test/E2E)
  const ambil = opsi.pengambil ?? fetch;
  const sinyal = AbortSignal.timeout(batas);
  const alamat = `${k.alamat}/v1beta/models/${encodeURIComponent(k.model)}:generateContent`;
  const badan = JSON.stringify(susunBadanGemini(k, p));

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
