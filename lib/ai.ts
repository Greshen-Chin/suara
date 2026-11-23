import { GoogleGenAI } from "@google/genai";
import {
  RUBRIK_URGENSI,
  label,
  rubrikUntuk,
  type TingkatUrgensi,
} from "./urgensi";

let klienAI: GoogleGenAI | null = null;

function ambilKlienAI(): GoogleGenAI {
  if (!klienAI) {
    klienAI = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_AI_PROJECT || "suara-515516",
      location: process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || "global",
    });
  }
  return klienAI;
}

const MODEL_GEMINI = process.env.VERTEX_AI_MODEL || "gemini-3.8-flash";

export interface InputUrgensiAI {
  judul: string;
  deskripsi: string;
  kategori?: string;
  wilayah?: string;
}

export interface HasilUrgensiAI {
  skor: number;
  alasan: string;
  tingkat: TingkatUrgensi | null;
}

/**
 * Menghasilkan saran skor urgensi (1-10) dan alasan singkat berdasarkan RUBRIK_URGENSI.
 */
export async function nilaiUrgensiDenganAI(
  input: InputUrgensiAI
): Promise<HasilUrgensiAI> {
  const teksRubrik = RUBRIK_URGENSI.map(
    (t) => `- Skor ${label(t)} (${t.ringkas}): ${t.jelas}`
  ).join("\n");

  const prompt = `
Anda adalah asisten penilai usulan Musyawarah Desa pada platform SUARA.
Tentukan tingkat urgensi usulan warga menggunakan rubrik resmi berikut (pilih tingkat dulu, lalu angka bulat 1-10 di dalamnya):

${teksRubrik}

Data Usulan:
- Judul: ${input.judul}
- Deskripsi: ${input.deskripsi}
${input.kategori ? `- Kategori: ${input.kategori}` : ""}
${input.wilayah ? `- Wilayah: ${input.wilayah}` : ""}

Aturan:
1. Berikan penilaian objektif sesuai rubrik di atas.
2. Alasan maksimal 1-2 kalimat bahasa Indonesia yang lugas dan mengacu pada dampak/risiko nyata di deskripsi.
3. Kembalikan HANYA JSON valid dengan format:
{
  "skor": <angka bulat 1 sampai 10>,
  "alasan": "<alasan singkat>"
}
`.trim();

  const respons = await ambilKlienAI().models.generateContent({
    model: MODEL_GEMINI,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const teks = respons.text?.trim();
  if (!teks) {
    throw new Error("Respon kosong dari Vertex AI saat menilai urgensi.");
  }

  const parsed = JSON.parse(teks) as { skor?: unknown; alasan?: unknown };
  const skorMentah = Number(parsed.skor);
  if (!Number.isFinite(skorMentah)) {
    throw new Error("Format skor dari Vertex AI tidak valid.");
  }

  const skor = Math.min(10, Math.max(1, Math.round(skorMentah)));
  const alasan =
    typeof parsed.alasan === "string" && parsed.alasan.trim().length > 0
      ? parsed.alasan.trim()
      : "Dinilai berdasarkan rubrik urgensi desa.";

  return {
    skor,
    alasan,
    tingkat: rubrikUntuk(skor),
  };
}

export interface RingkasanUsulanSimulasi {
  judul: string;
  wilayah: string;
  biaya: number;
  dukungan: number;
  urgensi: number;
  skor?: number;
}

export interface InputPenjelasanRekomendasi {
  pagu: number;
  bobot?: { popularitas: number; urgensi: number; pemerataan: number };
  terpilih: RingkasanUsulanSimulasi[];
  ditunda: RingkasanUsulanSimulasi[];
}

/**
 * Menghasilkan narasi penjelasan trade-off antara usulan terpilih vs ditunda di layar Simulasi Anggaran.
 */
export async function jelaskanRekomendasiDenganAI(
  input: InputPenjelasanRekomendasi
): Promise<string> {
  const prompt = `
Anda adalah analis transparansi anggaran Musyawarah Desa (SUARA).
Jelaskan trade-off pilihan anggaran berikut dalam bahasa Indonesia yang sederhana, objektif, dan berdasar angka sebenarnya.

Pagu Anggaran: Rp ${input.pagu.toLocaleString("id-ID")}
${
  input.bobot
    ? `Bobot: Popularitas ${input.bobot.popularitas}%, Urgensi ${input.bobot.urgensi}%, Pemerataan ${input.bobot.pemerataan}%`
    : ""
}

Usulan Terpilih:
${JSON.stringify(input.terpilih, null, 2)}

Usulan Ditunda:
${JSON.stringify(input.ditunda, null, 2)}

Aturan:
1. Jelaskan dalam 2-3 kalimat ringkas mengapa kombinasi usulan terpilih lebih diprioritaskan dibanding yang ditunda (sebutkan faktor biaya/pagu, urgensi, atau pemerataan RW jika relevan).
2. Hanya gunakan angka yang ada pada data di atas, jangan mengarang data baru.
`.trim();

  const respons = await ambilKlienAI().models.generateContent({
    model: MODEL_GEMINI,
    contents: prompt,
    config: {
      temperature: 0.3,
    },
  });

  const teks = respons.text?.trim();
  if (!teks) {
    throw new Error("Respon kosong dari Vertex AI saat menyusun penjelasan.");
  }
  return teks;
}
