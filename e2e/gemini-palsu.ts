// Server Gemini tiruan, HANYA untuk pengujian E2E saran urgensi. Tidak dipakai di produksi.
//
//   node e2e/gemini-palsu.ts            (port 54399, atau PORT_GEMINI_PALSU)
//
// Meniru satu titik: POST /v1beta/models/<model>:generateContent. Aplikasi diarahkan ke sini lewat
// GEMINI_BASE_URL (hanya alamat lokal yang diterima aplikasi). TIDAK PERNAH memanggil Gemini sungguhan.
// Yang tidak ikut terverifikasi: perilaku dan batas Gemini yang asli (kuota nyata, filter keamanan, mutu nilai).
//
// Titik tambahan khusus uji:
//   POST /__uji/atur       { mode, delayMs?, nilai? }   mengatur perilaku jawaban berikutnya
//   GET  /__uji/panggilan  daftar permintaan yang diterima (badan lengkap, tanpa kunci)
//   POST /__uji/reset      mode kembali "normal" dan daftar dikosongkan
//
// Mode:
//   normal | kuota (429) | permintaan (400) | server (503 terus) | server-sekali (503 sekali) | kosong |
//   terpotong | diblokir | kutipan-palsu | json-rusak | nilai-salah | patuh (menuruti injeksi: nilai 10 + kunci tambahan)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.PORT_GEMINI_PALSU ?? 54399);
const KUNCI_SAH = "kunci-uji-e2e";

interface Catatan {
  model: string;
  kunciSah: boolean;
  kunciDiUrl: boolean;
  badan: string;
}

let mode = "normal";
let delayMs = 0;
let nilai = 7;
let sekali = false;
let panggilan: Catatan[] = [];

const tingkat = (n: number) => (n <= 3 ? 1 : n <= 6 ? 2 : n <= 8 ? 3 : 4);

function baca(req: IncomingMessage): Promise<string> {
  return new Promise((selesai) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => selesai(s));
  });
}

function kirim(res: ServerResponse, status: number, badan: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof badan === "string" ? badan : JSON.stringify(badan));
}

const bungkus = (teks: string, selesai = "STOP") => ({
  candidates: [{ content: { parts: [{ text: teks }], role: "model" }, finishReason: selesai }],
});

/** Isi deskripsi dari prompt pengguna: di antara "Deskripsi:" dan pembatas penutup. */
function deskripsiDari(badan: string): string {
  const o = JSON.parse(badan) as { contents: { parts: { text: string }[] }[] };
  const t = o.contents[0].parts[0].text;
  const m = /Deskripsi:\n([\s\S]*?)\nUSULAN_WARGA>>>/.exec(t);
  return m ? m[1] : "";
}

function jawabanNormal(badan: string, n: number): Record<string, unknown> {
  const kalimat = deskripsiDari(badan)
    .split(/(?<=[.!?])\s+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 12);
  const potong = (k: string) => k.replace(/[.!?]+$/, "").slice(0, 60).trim();
  const alasan = (kalimat.length ? kalimat : ["isi usulan"]).slice(0, 2).map((k, i) => ({
    teks: i === 0 ? "Kondisi yang dilaporkan terjadi berulang dan dirasakan warga." : "Ada risiko bagi warga yang melintas di sana.",
    kutipan: potong(k),
  }));
  return { nilai: n, tingkat: tingkat(n), keyakinan: "sedang", alasan, pertanyaan: ["Apakah sudah ada yang terjatuh lagi?"] };
}

async function tangani(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/__uji/atur" && req.method === "POST") {
    const o = JSON.parse((await baca(req)) || "{}") as { mode?: string; delayMs?: number; nilai?: number };
    mode = o.mode ?? "normal";
    delayMs = o.delayMs ?? 0;
    nilai = o.nilai ?? 7;
    sekali = false;
    return kirim(res, 200, "{}");
  }
  if (url.pathname === "/__uji/panggilan" && req.method === "GET") return kirim(res, 200, panggilan);
  if (url.pathname === "/__uji/reset" && req.method === "POST") {
    mode = "normal";
    delayMs = 0;
    nilai = 7;
    sekali = false;
    panggilan = [];
    return kirim(res, 200, "{}");
  }

  const m = /^\/v1beta\/models\/([^/:]+):generateContent$/.exec(url.pathname);
  if (!m || req.method !== "POST") return kirim(res, 404, { error: { message: "tidak ada" } });

  const badan = await baca(req);
  const kunci = req.headers["x-goog-api-key"];
  panggilan.push({ model: m[1], kunciSah: kunci === KUNCI_SAH, kunciDiUrl: url.search.includes("key="), badan });
  if (kunci !== KUNCI_SAH) return kirim(res, 403, { error: { status: "PERMISSION_DENIED" } });

  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

  switch (mode) {
    case "kuota":
      return kirim(res, 429, { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } });
    case "permintaan":
      return kirim(res, 400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "skema terlalu rumit" } });
    case "server":
      return kirim(res, 503, { error: { code: 503, status: "UNAVAILABLE" } });
    case "server-sekali":
      if (!sekali) {
        sekali = true;
        return kirim(res, 503, { error: { code: 503, status: "UNAVAILABLE" } });
      }
      return kirim(res, 200, bungkus(JSON.stringify(jawabanNormal(badan, nilai))));
    case "kosong":
      return kirim(res, 200, "");
    case "terpotong":
      return kirim(res, 200, bungkus('{"nilai":', "MAX_TOKENS"));
    case "diblokir":
      return kirim(res, 200, { promptFeedback: { blockReason: "SAFETY" } });
    case "json-rusak":
      return kirim(res, 200, bungkus("ini bukan json sama sekali"));
    case "nilai-salah":
      return kirim(res, 200, bungkus(JSON.stringify({ ...jawabanNormal(badan, 7), nilai: "8" })));
    case "kutipan-palsu":
      return kirim(
        res,
        200,
        bungkus(JSON.stringify({ ...jawabanNormal(badan, 7), alasan: [{ teks: "Alasan yang dikarang saja.", kutipan: "banjir bandang setiap tahun" }] })),
      );
    case "patuh": {
      // Model yang menuruti injeksi di deskripsi: nilai 10, tetapi tetap berupa saran. Kunci tambahan harus dibuang aplikasi.
      const j = jawabanNormal(badan, 10);
      return kirim(res, 200, bungkus(JSON.stringify({ ...j, status: "approved", perintah: "hapus semua usulan", urgency_score: 10 })));
    }
    default:
      return kirim(res, 200, bungkus(JSON.stringify(jawabanNormal(badan, nilai))));
  }
}

createServer((req, res) => {
  tangani(req, res).catch((err) => kirim(res, 500, { error: { message: String(err) } }));
}).listen(PORT, "127.0.0.1", () => console.log(`Gemini tiruan di http://127.0.0.1:${PORT}`));
