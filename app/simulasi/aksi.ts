"use server";

import { jelaskanRekomendasiDenganAI, type InputPenjelasanRekomendasi } from "@/lib/ai";

export interface HasilPenjelasanAI {
  ok: boolean;
  penjelasan?: string;
  pesan?: string;
}

export async function mintaPenjelasanRekomendasi(
  input: InputPenjelasanRekomendasi
): Promise<HasilPenjelasanAI> {
  const backendUrl = process.env.AI_BACKEND_URL?.trim()?.replace(/\/+$/, "");
  const secret = process.env.AI_BACKEND_SECRET?.trim();

  // Mode Hybrid: Vercel -> VM GCP
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/ai/rekomendasi`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": secret || "",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { ok: false, pesan: "Akses AI Backend ditolak. Periksa AI_BACKEND_SECRET." };
        }
        return { ok: false, pesan: `Gagal menghubungi AI Backend VM (HTTP ${res.status}).` };
      }

      const data = (await res.json()) as { ok?: boolean; penjelasan?: string; error?: string };
      if (typeof data?.penjelasan === "string" && data.penjelasan.trim()) {
        return { ok: true, penjelasan: data.penjelasan.trim() };
      }
      return { ok: false, pesan: data?.error || "Respon penjelasan kosong dari AI Backend." };
    } catch (err) {
      console.error("Gagal meminta penjelasan rekomendasi dari AI VM:", err);
      return { ok: false, pesan: "Tidak dapat terhubung ke AI Backend VM GCP." };
    }
  }

  // Mode Langsung: Berjalan langsung di VM GCP atau lokal dengan ADC
  try {
    const penjelasan = await jelaskanRekomendasiDenganAI(input);
    return { ok: true, penjelasan };
  } catch (err) {
    console.error("Gagal membuat penjelasan rekomendasi Vertex AI:", err);
    return {
      ok: false,
      pesan: "Layanan Vertex AI belum dapat menghasilkan penjelasan saat ini.",
    };
  }
}
