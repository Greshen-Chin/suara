import { NextResponse } from "next/server";
import { jelaskanRekomendasiDenganAI } from "@/lib/ai";

export async function POST(req: Request) {
  // Fail-closed: Tolak jika AI_BACKEND_SECRET belum disetel di server atau x-api-key tidak cocok
  const secret = process.env.AI_BACKEND_SECRET?.trim();
  const apiKey = req.headers.get("x-api-key")?.trim();

  if (!secret || !apiKey || apiKey !== secret) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (
      typeof body?.pagu !== "number" ||
      !Array.isArray(body?.terpilih) ||
      !Array.isArray(body?.ditunda)
    ) {
      return NextResponse.json(
        { error: "Format payload pagu, terpilih, dan ditunda tidak valid" },
        { status: 400 }
      );
    }

    const penjelasan = await jelaskanRekomendasiDenganAI({
      pagu: body.pagu,
      bobot: body.bobot,
      terpilih: body.terpilih,
      ditunda: body.ditunda,
    });

    return NextResponse.json({ ok: true, penjelasan });
  } catch (error) {
    console.error("Vertex AI /api/ai/rekomendasi error:", error);
    return NextResponse.json(
      { error: "Gagal menghasilkan penjelasan rekomendasi" },
      { status: 500 }
    );
  }
}
