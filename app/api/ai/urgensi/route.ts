import { NextResponse } from "next/server";
import { nilaiUrgensiDenganAI } from "@/lib/ai";

export async function POST(req: Request) {
  const secret = process.env.AI_BACKEND_SECRET;
  // Tertutup bila AI_BACKEND_SECRET tidak diisi, supaya kuota Vertex tidak bisa dipakai siapa pun.
  if (!secret || req.headers.get("x-api-key") !== secret) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  try {
    const body = await req.json();
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
