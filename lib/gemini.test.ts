import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  ALAMAT_BAWAAN,
  bacaKonfigurasiGemini,
  MODEL_BAWAAN,
  panggilGemini,
  susunBadanGemini,
  type KonfigurasiGemini,
} from "./gemini.ts";
import { skemaSaran, susunMasukan, susunPrompt } from "./saran-urgensi.ts";

const KUNCI = "KUNCI-RAHASIA-JANGAN-BOCOR-123";
const konf: KonfigurasiGemini = { kunci: KUNCI, model: "model-uji", alamat: "http://127.0.0.1:9", berpikir: null };
const permintaan = { sistem: "sistem", pengguna: "pengguna", skema: { type: "OBJECT" } };

const jawab = (status: number, badan: unknown) => async () =>
  new Response(badan === undefined ? "" : JSON.stringify(badan), { status, headers: { "content-type": "application/json" } });

const sukses = (teks: string) => ({ candidates: [{ content: { parts: [{ text: teks }] }, finishReason: "STOP" }] });

describe("bacaKonfigurasiGemini", () => {
  it("tanpa kunci: null (fitur mati)", () => {
    assert.equal(bacaKonfigurasiGemini({}), null);
    assert.equal(bacaKonfigurasiGemini({ GEMINI_API_KEY: "   " }), null);
  });

  it("bawaan: model dan alamat resmi", () => {
    const k = bacaKonfigurasiGemini({ GEMINI_API_KEY: "k" });
    assert.deepEqual(k, { kunci: "k", model: MODEL_BAWAAN, alamat: ALAMAT_BAWAAN, berpikir: null });
  });

  it("model dan tingkat berpikir dari lingkungan; yang tidak sah diabaikan", () => {
    const k = bacaKonfigurasiGemini({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-x-1", GEMINI_THINKING: "low" });
    assert.equal(k?.model, "gemini-x-1");
    assert.equal(k?.berpikir, "low");
    const buruk = bacaKonfigurasiGemini({ GEMINI_API_KEY: "k", GEMINI_MODEL: "a/../b", GEMINI_THINKING: "ekstrem" });
    assert.equal(buruk?.model, MODEL_BAWAAN);
    assert.equal(buruk?.berpikir, null);
  });

  it("GEMINI_BASE_URL hanya alamat resmi atau lokal; alamat lain tidak pernah menerima kunci", () => {
    assert.equal(bacaKonfigurasiGemini({ GEMINI_API_KEY: "k", GEMINI_BASE_URL: "http://127.0.0.1:5050/" })?.alamat, "http://127.0.0.1:5050");
    assert.equal(bacaKonfigurasiGemini({ GEMINI_API_KEY: "k", GEMINI_BASE_URL: "http://localhost:5050" })?.alamat, "http://localhost:5050");
    for (const asing of ["https://penyerang.example", "http://127.0.0.1.penyerang.example", "http://example.com"]) {
      assert.equal(bacaKonfigurasiGemini({ GEMINI_API_KEY: "k", GEMINI_BASE_URL: asing })?.alamat, ALAMAT_BAWAAN, asing);
    }
  });

  it("vertex ai: membaca project dan location dari lingkungan", () => {
    const k = bacaKonfigurasiGemini({ GOOGLE_CLOUD_PROJECT: "suara-515516", GOOGLE_CLOUD_LOCATION: "global" });
    assert.deepEqual(k, {
      kunci: "vertex-ai",
      model: "gemini-3.8-flash",
      alamat: ALAMAT_BAWAAN,
      berpikir: null,
      mode: "vertex",
      project: "suara-515516",
      location: "global",
    });
  });

  it("backend hybrid: membaca AI_BACKEND_URL dan AI_BACKEND_SECRET", () => {
    const k = bacaKonfigurasiGemini({
      AI_BACKEND_URL: "https://vm-gcp.suara.desa.id/",
      AI_BACKEND_SECRET: "rahasia-vm-123",
    });
    assert.deepEqual(k, {
      kunci: "rahasia-vm-123",
      model: "gemini-3.8-flash",
      alamat: "https://vm-gcp.suara.desa.id",
      berpikir: null,
      mode: "backend",
      backendUrl: "https://vm-gcp.suara.desa.id",
      backendSecret: "rahasia-vm-123",
    });
  });
});

describe("susunBadanGemini (A-06)", () => {
  it("memuat skema JSON dan hanya judul, deskripsi, kategori yang disamarkan; tanpa nama, RW, dukungan, biaya, id", () => {
    const m = susunMasukan({
      judul: "Lampu jalan Bu Sari mati",
      deskripsi: "Hubungi 081234567890 di Jl. Mawar No. 12. Gelap setelah magrib.",
      kategori: "infrastruktur",
    });
    const p = susunPrompt(m);
    const badan = JSON.stringify(susunBadanGemini(konf, { ...p, skema: skemaSaran() }));
    for (const bocor of ["Sari", "081234567890", "Mawar", "estimated_budget", "proposer", "vote", "dukungan:"]) {
      assert.ok(!badan.includes(bocor), `badan memuat ${bocor}`);
    }
    assert.ok(!badan.includes(KUNCI), "kunci tidak boleh ada di badan");
    assert.ok(badan.includes("responseMimeType"));
    assert.ok(badan.includes("[nama]"));
  });

  it("thinkingConfig hanya bila diminta", () => {
    assert.ok(!JSON.stringify(susunBadanGemini(konf, permintaan)).includes("thinkingConfig"));
    assert.ok(JSON.stringify(susunBadanGemini({ ...konf, berpikir: "low" }, permintaan)).includes('"thinkingLevel":"low"'));
  });
});

describe("panggilGemini: hasil dan galat (A-09)", () => {
  let galatKonsol: string[];
  beforeEach(() => {
    galatKonsol = [];
    mock.method(console, "error", (...a: unknown[]) => void galatKonsol.push(a.join(" ")));
  });
  afterEach(() => mock.restoreAll());

  it("berhasil: teks JSON dikembalikan, kunci hanya di header", async () => {
    let header: Headers | null = null;
    let alamat = "";
    const h = await panggilGemini(konf, permintaan, {
      pengambil: async (u, init) => {
        alamat = String(u);
        header = new Headers(init?.headers);
        return new Response(JSON.stringify(sukses('{"nilai":8}')), { status: 200 });
      },
    });
    assert.ok(h.ok);
    if (h.ok) assert.equal(h.teks, '{"nilai":8}');
    assert.equal(header!.get("x-goog-api-key"), KUNCI);
    assert.ok(!alamat.includes(KUNCI));
    assert.ok(alamat.endsWith("/v1beta/models/model-uji:generateContent"));
  });

  const kasus: [string, () => Promise<Response>, string][] = [
    ["429 kuota", jawab(429, { error: { status: "RESOURCE_EXHAUSTED" } }), "kuota"],
    ["400 permintaan", jawab(400, { error: { status: "INVALID_ARGUMENT" } }), "permintaan"],
    ["403 kunci", jawab(403, { error: {} }), "kunci"],
    ["500 server", jawab(500, {}), "server"],
    ["badan kosong", jawab(200, undefined), "kosong"],
    ["tanpa kandidat", jawab(200, { candidates: [] }), "kosong"],
    ["teks kosong", jawab(200, sukses("   ")), "kosong"],
    ["diblokir (promptFeedback)", jawab(200, { promptFeedback: { blockReason: "SAFETY" } }), "diblokir"],
    ["diblokir (finishReason)", jawab(200, { candidates: [{ finishReason: "SAFETY" }] }), "diblokir"],
    ["incomplete/MAX_TOKENS", jawab(200, { candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }] }), "terpotong"],
  ];
  for (const [nama, pengambil, kode] of kasus) {
    it(`${nama} -> ${kode}`, async () => {
      const h = await panggilGemini(konf, permintaan, { pengambil });
      assert.equal(h.ok, false);
      if (!h.ok) assert.equal(h.kode, kode);
    });
  }

  it("429 tidak diulang", async () => {
    let n = 0;
    await panggilGemini(konf, permintaan, {
      pengambil: async () => {
        n++;
        return jawab(429, {})();
      },
    });
    assert.equal(n, 1);
  });

  it("503 diulang sekali, lalu berhasil", async () => {
    let n = 0;
    const h = await panggilGemini(konf, permintaan, {
      pengambil: async () => {
        n++;
        return n === 1 ? jawab(503, {})() : jawab(200, sukses("{}"))();
      },
    });
    assert.equal(n, 2);
    assert.ok(h.ok);
  });

  it("503 terus-menerus: dua kali saja", async () => {
    let n = 0;
    const h = await panggilGemini(konf, permintaan, {
      pengambil: async () => {
        n++;
        return jawab(503, {})();
      },
    });
    assert.equal(n, 2);
    assert.equal(h.ok, false);
  });

  it("galat jaringan diulang sekali", async () => {
    let n = 0;
    const h = await panggilGemini(konf, permintaan, {
      pengambil: async () => {
        n++;
        throw new TypeError("fetch failed");
      },
    });
    assert.equal(n, 2);
    assert.equal(h.ok, false);
    if (!h.ok) assert.equal(h.kode, "jaringan");
  });

  it("batas waktu keseluruhan: tidak menunggu selamanya dan tidak diulang", async () => {
    let n = 0;
    const h = await panggilGemini(konf, permintaan, {
      batasMs: 50,
      pengambil: (_u, init) => {
        n++;
        return new Promise<Response>((_res, tolak) => {
          const timer = setTimeout(() => {
            tolak(new DOMException("habis", "TimeoutError"));
          }, 50);
          init?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              tolak(new DOMException("habis", "TimeoutError"));
            },
            { once: true },
          );
        });
      },
    });
    assert.equal(n, 1);
    assert.equal(h.ok, false);
    if (!h.ok) assert.equal(h.kode, "batas_waktu");
  });

  it("A-12: kunci dan isi usulan tidak pernah masuk catatan konsol", async () => {
    const rahasia = { ...permintaan, pengguna: "ISI-USULAN-RAHASIA" };
    await panggilGemini(konf, rahasia, { pengambil: jawab(500, { error: { message: KUNCI } }) });
    await panggilGemini(konf, rahasia, { pengambil: jawab(429, {}) });
    await panggilGemini(konf, rahasia, { pengambil: async () => { throw new TypeError(`gagal ${KUNCI}`); } });
    const semua = galatKonsol.join("\n");
    assert.ok(semua.length > 0, "galat memang dicatat");
    assert.ok(!semua.includes(KUNCI));
    assert.ok(!semua.includes("ISI-USULAN-RAHASIA"));
    assert.match(semua, /gemini gagal: (server 500|kuota 429|jaringan)/);
  });

  it("bagian 'thought' tidak ikut ke teks jawaban", async () => {
    const h = await panggilGemini(konf, permintaan, {
      pengambil: jawab(200, {
        candidates: [{ content: { parts: [{ text: "pikiran", thought: true }, { text: '{"a":1}' }] }, finishReason: "STOP" }],
      }),
    });
    assert.ok(h.ok);
    if (h.ok) assert.equal(h.teks, '{"a":1}');
  });

  describe("backend hybrid (Vercel -> VM GCP)", () => {
    const konfBackend: KonfigurasiGemini = {
      kunci: "secret-key",
      model: "gemini-3.8-flash",
      alamat: "https://vm.desa.id",
      berpikir: null,
      mode: "backend",
      backendUrl: "https://vm.desa.id",
      backendSecret: "secret-key",
    };

    it("meneruskan request ke VM /api/ai/urgensi dengan header x-api-key", async () => {
      let urlPanggilan = "";
      let headerApiKey = "";
      let bodyTerkirim = "";

      const pengambilKustom: typeof fetch = async (input, init) => {
        urlPanggilan = String(input);
        headerApiKey = (init?.headers as Record<string, string>)?.["x-api-key"] || "";
        bodyTerkirim = String(init?.body);
        return new Response(JSON.stringify({ ok: true, teks: '{"nilai": 8}' }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };

      const res = await panggilGemini(konfBackend, permintaan, { pengambil: pengambilKustom });
      assert.ok(res.ok);
      if (res.ok) assert.equal(res.teks, '{"nilai": 8}');
      assert.equal(urlPanggilan, "https://vm.desa.id/api/ai/urgensi");
      assert.equal(headerApiKey, "secret-key");
      const parsedBody = JSON.parse(bodyTerkirim);
      assert.equal(parsedBody.sistem, "sistem");
      assert.equal(parsedBody.pengguna, "pengguna");
    });

    it("menangani galat 401/403 dari VM sebagai kode kunci", async () => {
      const res = await panggilGemini(konfBackend, permintaan, {
        pengambil: async () => new Response(JSON.stringify({ error: "Tidak diizinkan" }), { status: 401 }),
      });
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.kode, "kunci");
    });

    it("menangani galat 429 dari VM sebagai kode kuota", async () => {
      const res = await panggilGemini(konfBackend, permintaan, {
        pengambil: async () => new Response(JSON.stringify({ error: "Limit" }), { status: 429 }),
      });
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.kode, "kuota");
    });

    it("menangani teks kosong dari VM sebagai kode kosong", async () => {
      const res = await panggilGemini(konfBackend, permintaan, {
        pengambil: async () => new Response(JSON.stringify({ ok: true, teks: "" }), { status: 200 }),
      });
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.kode, "kosong");
    });
  });
});
