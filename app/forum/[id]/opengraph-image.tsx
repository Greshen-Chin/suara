import { ImageResponse } from "next/og";
import { muatUsulan } from "@/lib/forum-data";
import { rupiah } from "@/lib/format";
import { adalahUuid } from "@/lib/usulan-skema";

// Gambar pratinjau saat tautan usulan dibagikan. Sengaja sederhana: judul, biaya, dan merek,
// memakai warna token SUARA. Usulan yang disembunyikan tidak membocorkan judulnya.
export const alt = "Usulan di forum warga SUARA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Gambar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = adalahUuid(id) ? await muatUsulan(id) : null;
  const usulan = data?.usulan ?? null;
  const tersembunyi = usulan?.disembunyikan_pada != null;
  const judul = !usulan ? "Usulan tidak ditemukan" : tersembunyi ? "Usulan disembunyikan" : (usulan.title ?? "");
  const rincian = usulan && !tersembunyi ? `${rupiah(usulan.estimated_budget)} · ${usulan.vote_count} dukungan` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f3f5ef",
          color: "#14261e",
          padding: 64,
          borderTop: "24px solid #14261e",
        }}
      >
        <div style={{ display: "flex", fontSize: 48, fontWeight: 700, letterSpacing: 6 }}>SUARA</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: judul.length > 50 ? 64 : 80, fontWeight: 700, lineHeight: 1.05 }}>
            {judul.length > 90 ? `${judul.slice(0, 87)}...` : judul}
          </div>
          {rincian && <div style={{ display: "flex", fontSize: 36, color: "#5b655f" }}>{rincian}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#5b655f" }}>Forum warga · Sistem Usulan dan Aspirasi Rakyat</div>
      </div>
    ),
    size,
  );
}
