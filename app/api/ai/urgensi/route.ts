import { NextResponse } from "next/server";
import { nilaiUrgensiDenganAI } from "@/lib/ai";

export async function POST(req: Request) {
  // Fail-closed: Tolak jika AI_BACKEND_SECRET belum disetel di server atau x-api-key tidak cocok
  const secret = process.env.AI_BACKEND_SECRET?.trim();
  const apiKey = req.headers.get("x-api-key")?.trim();

  if (!secret || !apiKey || apiKey !== secret) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Mode 1: Hybrid bridge dari lib/gemini.ts (sistem, pengguna, skema) via Vertex AI ADC
    if (typeof body?.sistem === "string" && typeof body?.pengguna === "string") {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_AI_PROJECT || "suara-515516",
        location: process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_AI_LOCATION || "global",
      });

      const model = process.env.VERTEX_AI_MODEL || "gemini-3.8-flash";
      const resp = await ai.models.generateContent({
        model,
        contents: body.pengguna,
        config: {
          systemInstruction: body.sistem,
          responseMimeType: "application/json",
          ...(body.skema ? { responseSchema: body.skema } : {}),
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      });

      const kandidat = resp.candidates?.[0];
      if (
        kandidat?.finishReason === "SAFETY" ||
        kandidat?.finishReason === "PROHIBITED_CONTENT" ||
        kandidat?.finishReason === "BLOCKLIST"
      ) {
        return NextResponse.json(
          { error: "Permintaan disaring oleh filter keamanan" },
          { status: 400 }
        );
      }
      if (kandidat?.finishReason === "MAX_TOKENS") {
        return NextResponse.json(
          { error: "Jawaban melebihi batas token" },
          { status: 500 }
        );
      }

      const teks = resp.text?.trim();
      if (!teks) {
        return NextResponse.json(
          { error: "Respon kosong dari Vertex AI" },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, teks });
    }

    // Mode 2: Pemanggilan langsung usulan (judul, deskripsi)
    const judul = typeof body?.judul === "string" ? body.judul.trim() : "";
    const deskripsi =
      typeof body?.deskripsi === "string" ? body.deskripsi.trim() : "";

    if (!judul || !deskripsi) {
      return NextResponse.json(
        { error: "Judul dan deskripsi wajib diisi" },
        { status: 400 }
      );
    }

    const hasil = await nilaiUrgensiDenganAI({
      judul,
      deskripsi,
      kategori: typeof body?.kategori === "string" ? body.kategori : undefined,
      wilayah: typeof body?.wilayah === "string" ? body.wilayah : undefined,
    });

    return NextResponse.json(hasil);
  } catch (error) {
    console.error("Vertex AI /api/ai/urgensi error:", error);
    return NextResponse.json(
      { error: "Gagal menilai urgensi usulan" },
      { status: 500 }
    );
  }
}
