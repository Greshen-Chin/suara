import { muatPeriode } from "@/lib/keputusan-data";
import { bangunCsv } from "@/lib/keputusan-csv";
import { bacaTahun } from "@/lib/keputusan-pesan";

// Unduhan data keputusan satu periode sebagai CSV. BACA SAJA: dari potret publik (v_keputusan), tanpa mengubah apa pun
// dan tanpa data pribadi. UTF-8 dengan BOM supaya rapi di Excel; sel teks yang diawali = + - @ dinetralkan
// (lib/keputusan-csv.ts) supaya alasan yang ditulis orang tidak berjalan sebagai rumus.
export async function GET(_req: Request, { params }: { params: Promise<{ tahun: string }> }) {
  const { tahun: teksTahun } = await params;
  const tahun = bacaTahun(teksTahun);
  if (tahun === null) return new Response("Periode tidak ditemukan.", { status: 404 });

  const data = await muatPeriode(tahun);
  // Data cadangan bukan data sebenarnya: lebih baik tidak ada berkas daripada berkas yang dikira asli.
  if (data.dataCadangan) return new Response("Data keputusan belum bisa dimuat. Coba lagi beberapa menit lagi.", { status: 503 });
  if (!data.periode || data.periode.status !== "diputuskan") {
    return new Response("Periode ini belum diputuskan atau tidak ada.", { status: 404 });
  }

  const csv = bangunCsv(
    tahun,
    data.keputusan.map((k) => ({
      peringkat: k.peringkat,
      judul: k.judul,
      rw: k.rw,
      biaya: k.biaya,
      hasil: k.hasil,
      beda: k.beda,
      statusRekomendasi: k.statusRekomendasi,
      skor: k.skor,
      dukungan: k.dukungan,
      alasan: k.alasan,
      sumberDana: k.sumberDana,
      statusSekarang: k.statusSekarang,
      selesaiPada: k.selesaiPada,
      catatanSelesai: k.catatanSelesai,
      biayaRealisasi: k.biayaRealisasi,
    })),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="keputusan-tahun-anggaran-${tahun}.csv"`,
      "x-content-type-options": "nosniff",
    },
  });
}
