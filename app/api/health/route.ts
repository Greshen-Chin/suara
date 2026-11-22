import { PAGU_DEFAULT, BATAS_WAKTU_MS } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase-server";

// Cek kesehatan sebelum deploy. Sengaja memanggil database langsung (tanpa fallback),
// supaya kegagalan database benar-benar terlihat.
export async function GET() {
  try {
    const sinyal = AbortSignal.timeout(BATAS_WAKTU_MS);

    const [usulan, rekomendasi] = await Promise.all([
      supabaseServer
        .from("proposals")
        .select("*", { count: "exact", head: true })
        .abortSignal(sinyal),
      supabaseServer
        .rpc("rekomendasi_resmi", { p_pagu: PAGU_DEFAULT })
        .abortSignal(sinyal),
    ]);

    if (usulan.error) throw usulan.error;
    if (rekomendasi.error) throw rekomendasi.error;

    return Response.json({
      db: "ok",
      proposals: usulan.count ?? 0,
      rekomendasi_terpilih: rekomendasi.data.filter((r) => r.selected).length,
    });
  } catch {
    // Pesan error asli sengaja tidak dikirim ke klien.
    return Response.json(
      { db: "error", proposals: 0, rekomendasi_terpilih: 0 },
      { status: 503 },
    );
  }
}
