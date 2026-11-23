// Data cadangan keputusan bila database tidak terjangkau (atau migrasi 0006 belum dijalankan): periode lampau
// Tahun Anggaran 2026 dari supabase/seed_keputusan.sql. Hanya itu yang diketahui; halaman menampilkan penanda
// "Ini data contoh" dan tidak mengarang periode lain.
import type { DataPeriode, KeputusanPublik, KeputusanUsulan, Periode } from "./keputusan-tipe.ts";

export const PERIODE_2026: Periode = {
  tahun: 2026,
  status: "diputuskan",
  diputuskanPada: "2025-12-12T13:00:00.000Z",
  tanggalMusyawarah: "2025-12-12",
  catatan:
    "Musyawarah desa di balai warga, dihadiri perwakilan RT dan RW. Tiga usulan disetujui, satu ditolak karena biayanya melebihi sisa pagu dan bukan kebutuhan dasar.",
  pagu: 320_000_000,
  bobot: null,
  adaRekomendasi: false,
  wilayahSebelum: null,
  diputuskanOleh: null,
  jumlah: { disetujui: 3, danaLain: 0, dilanjutkan: 0, ditolak: 1 },
  beda: 0,
  terpakai: 310_000_000,
};

const dasar = {
  alasan: null,
  sumberDana: null,
  peringkat: null,
  jumlahUsulan: null,
  skor: null,
  statusRekomendasi: null,
  dukungan: 0,
  beda: false,
  catatanSelesai: null,
  biayaRealisasi: null,
  selesaiPada: null,
} as const;

export const KEPUTUSAN_2026: KeputusanPublik[] = [
  {
    ...dasar, proposalId: "6f1b3d0a-1002-4c8e-9a10-000000000001", judul: "Rehabilitasi saluran irigasi sawah RW 01",
    namaSingkat: "Irigasi sawah", hasil: "disetujui", biaya: 150_000_000, urgensi: 8, rw: 1, statusSekarang: "done",
    selesaiPada: "2026-08-14T03:00:00.000Z",
    catatanSelesai: "Saluran selesai dan sudah dipakai musim tanam kedua. Air sampai ke sawah paling ujung.", biayaRealisasi: 147_500_000,
  },
  {
    ...dasar, proposalId: "6f1b3d0a-1002-4c8e-9a10-000000000002", judul: "Perbaikan jalan lingkungan RW 01",
    namaSingkat: "Jalan lingkungan", hasil: "disetujui", biaya: 100_000_000, urgensi: 6, rw: 1, statusSekarang: "done",
    selesaiPada: "2026-06-02T08:00:00.000Z", catatanSelesai: "Pengaspalan selesai di seluruh ruas yang diusulkan.", biayaRealisasi: 100_000_000,
  },
  {
    ...dasar, proposalId: "6f1b3d0a-1002-4c8e-9a10-000000000003", judul: "Pembangunan MCK umum RW 03",
    namaSingkat: "MCK umum", hasil: "disetujui", biaya: 60_000_000, urgensi: 7, rw: 3, statusSekarang: "done",
    selesaiPada: "2026-07-20T04:00:00.000Z",
    catatanSelesai: "Bangunan MCK dan sumur bor selesai. Pengelolaannya diserahkan ke pengurus RW 03.", biayaRealisasi: 58_000_000,
  },
  {
    ...dasar, proposalId: "6f1b3d0a-1002-4c8e-9a10-000000000004", judul: "Pembangunan kolam renang desa",
    namaSingkat: "Kolam renang", hasil: "ditolak", biaya: 400_000_000, urgensi: 2, rw: 3, statusSekarang: "rejected",
    alasan: "Biayanya Rp 400 juta, lebih besar dari seluruh sisa pagu, dan kolam renang bukan kebutuhan dasar warga tahun ini.",
  },
];

export function periodeCadangan(tahun: number): DataPeriode {
  return {
    periode: tahun === 2026 ? PERIODE_2026 : null,
    keputusan: tahun === 2026 ? KEPUTUSAN_2026 : [],
    wilayah: [],
    dataCadangan: true,
  };
}

export function keputusanUsulanCadangan(id: string): KeputusanUsulan | null {
  const k = KEPUTUSAN_2026.find((x) => x.proposalId === id);
  if (!k) return null;
  return {
    tahun: 2026, tanggalMusyawarah: PERIODE_2026.tanggalMusyawarah, hasil: k.hasil, alasan: k.alasan, sumberDana: null,
    beda: false, adaRekomendasi: false, statusSekarang: k.statusSekarang, selesaiPada: k.selesaiPada,
    catatanSelesai: k.catatanSelesai, biayaRealisasi: k.biayaRealisasi,
  };
}
