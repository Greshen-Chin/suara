import { BATAS_WAKTU_MS } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase-server";

// Cek kesehatan sebelum deploy. Sengaja memanggil database langsung (tanpa fallback),
// supaya kegagalan database benar-benar terlihat. Pagu dibaca dari tabel pengaturan_anggaran
// (migrasi 0005) dan tahun periode berjalan dari tabel periode (migrasi 0006): bila migrasinya belum
// dijalankan, hasilnya error, dan itu memang yang ingin terlihat.
export async function GET() {
  try {
    const sinyal = AbortSignal.timeout(BATAS_WAKTU_MS);

    const pengaturan = await supabaseServer
      .from("pengaturan_anggaran")
      .select("pagu")
      .eq("id", 1)
      .abortSignal(sinyal)
      .single();
    if (pengaturan.error) throw pengaturan.error;
    const pagu = pengaturan.data.pagu;

    // Periode berjalan (migrasi 0006): bila migrasinya belum dijalankan, hasilnya error dan itu memang yang ingin terlihat.
    const periode = await supabaseServer
      .from("periode")
      .select("tahun")
      .eq("status", "berjalan")
      .abortSignal(sinyal)
      .single();
    if (periode.error) throw periode.error;

    const [usulan, rekomendasi] = await Promise.all([
      supabaseServer
        .from("proposals")
        .select("*", { count: "exact", head: true })
        .abortSignal(sinyal),
      supabaseServer
        .rpc("rekomendasi_resmi", { p_pagu: pagu })
        .abortSignal(sinyal),
    ]);

    if (usulan.error) throw usulan.error;
    if (rekomendasi.error) throw rekomendasi.error;

    return Response.json({
      db: "ok",
      pagu,
      periode: periode.data.tahun,
      proposals: usulan.count ?? 0,
      rekomendasi_terpilih: rekomendasi.data.filter((r) => r.selected).length,
    });
  } catch {
    // Pesan error asli sengaja tidak dikirim ke klien.
    return Response.json(
      { db: "error", pagu: 0, periode: 0, proposals: 0, rekomendasi_terpilih: 0 },
      { status: 503 },
    );
  }
}
