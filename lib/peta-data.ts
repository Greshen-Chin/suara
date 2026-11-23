import type { StatusUsulan } from "./seleksi";

export interface UsulanPeta {
  id: string;
  title: string;
  nama_singkat?: string | null;
  category: string;
  estimated_budget: number;
  status: string;
  rw: number | null;
  vote_count: number;
  lat: number;
  lng: number;
}

export interface AreaWilayahRw {
  rw: number;
  nama: string;
  penduduk: number;
  deskripsi: string;
  pusat: { lat: number; lng: number };
  radiusMeter: number;
  warna: string;
}

export const TITIK_PUSAT_DESA = {
  lat: -7.5510,
  lng: 110.2195,
};

export const DAFTAR_WILAYAH_PETA: AreaWilayahRw[] = [
  {
    rw: 1,
    nama: "RW 01 — Dusun Krajan (Pusat Desa)",
    penduduk: 3000,
    deskripsi: "Pusat pemerintahan desa, balai warga, dan pemukiman padat penduduk.",
    pusat: { lat: -7.5458, lng: 110.2185 },
    radiusMeter: 480,
    warna: "#2E7D32", // hijau sawah
  },
  {
    rw: 3,
    nama: "RW 03 — Dusun Pasar & Pendidikan",
    penduduk: 2000,
    deskripsi: "Sentra aktivitas ekonomi pasar desa, posyandu, dan sekolah SDN 03.",
    pusat: { lat: -7.5525, lng: 110.2260 },
    radiusMeter: 420,
    warna: "#0D6EFD", // biru
  },
  {
    rw: 7,
    nama: "RW 07 — Dusun Perbukitan & Tebing",
    penduduk: 400,
    deskripsi: "Wilayah lereng perbukitan terpencil yang rawan longsor dan minim infrastruktur.",
    pusat: { lat: -7.5595, lng: 110.2115 },
    radiusMeter: 550,
    warna: "#D97706", // oranye
  },
];

// Koordinat presisi untuk usulan bawaan (seed) agar terdistribusi realistis di bentang wilayah desa
const KOORDINAT_USULAN_SEED: Record<string, { lat: number; lng: number }> = {
  // RW 07 (Lereng, tebing, terisolir)
  "e8e6a794-f6d0-4d6d-942b-7aa18e59f482": { lat: -7.5625, lng: 110.2090 }, // Talud penahan longsor tebing
  "fe77cc4b-26f8-4b6f-b8ca-380b755281a9": { lat: -7.5565, lng: 110.2160 }, // Jembatan kecil penghubung
  "a6c1e7d0-183a-48dd-add9-44879db367c0": { lat: -7.5585, lng: 110.2130 }, // Normalisasi drainase
  "f4a5ec32-5cd8-4914-9bd8-68444d94f87f": { lat: -7.5605, lng: 110.2105 }, // Lampu PJU jalan setapak
  "6f1b3d0a-1001-4c8e-9a10-000000000001": { lat: -7.5575, lng: 110.2145 }, // Lampu jalan gang RW 07

  // RW 03 (Pasar, sekolah, MCK)
  "f45ae396-a260-46f4-bd99-7cb40de50b04": { lat: -7.5510, lng: 110.2245 }, // Perbaikan jalan depan SDN 03
  "6f1b3d0a-1002-4c8e-9a10-000000000003": { lat: -7.5538, lng: 110.2275 }, // Pembangunan MCK umum
  "6f1b3d0a-1001-4c8e-9a10-000000000004": { lat: -7.5528, lng: 110.2285 }, // Tong sampah pasar
  "6f1b3d0a-1001-4c8e-9a10-000000000002": { lat: -7.5502, lng: 110.2240 }, // Timbangan posyandu
  "6f1b3d0a-1002-4c8e-9a10-000000000004": { lat: -7.5545, lng: 110.2230 }, // Kolam renang (rejected)

  // RW 01 (Pusat pemukiman, balai desa, gapura)
  "0f8d979a-2841-4f66-a3ec-f8e86e0fb5b0": { lat: -7.5415, lng: 110.2190 }, // Gapura gerbang desa
  "631ab2c2-004a-4437-8d51-1eaa557ef965": { lat: -7.5452, lng: 110.2172 }, // Pengecatan balai warga
  "6f1b3d0a-1001-4c8e-9a10-000000000006": { lat: -7.5472, lng: 110.2200 }, // Lampu taman lapangan
  "6f1b3d0a-1001-4c8e-9a10-000000000003": { lat: -7.5438, lng: 110.2160 }, // Atap pos ronda
  "6f1b3d0a-1001-4c8e-9a10-000000000005": { lat: -7.5468, lng: 110.2180 }, // Pelatihan menjahit
  "6f1b3d0a-1002-4c8e-9a10-000000000001": { lat: -7.5488, lng: 110.2145 }, // Rehabilitasi irigasi
  "6f1b3d0a-1002-4c8e-9a10-000000000002": { lat: -7.5445, lng: 110.2215 }, // Perbaikan jalan lingkungan
};

/**
 * Menghasilkan koordinat realistis untuk usulan (baik dari seed maupun usulan baru warga).
 */
export function koordinatUntukUsulan(id: string, rw: number | null): { lat: number; lng: number } {
  if (KOORDINAT_USULAN_SEED[id]) {
    return KOORDINAT_USULAN_SEED[id];
  }

  // Jika usulan baru, plot di sekitar pusat RW terkait dengan jitter deterministik berdasarkan ID
  const infoRw = DAFTAR_WILAYAH_PETA.find((w) => w.rw === rw) ?? DAFTAR_WILAYAH_PETA[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const sudut = Math.abs(hash % 360) * (Math.PI / 180);
  const jarak = (Math.abs((hash >> 8) % 250) + 50) / 111320; // meter ke derajat perkiraan

  return {
    lat: Number((infoRw.pusat.lat + Math.sin(sudut) * jarak).toFixed(6)),
    lng: Number((infoRw.pusat.lng + Math.cos(sudut) * jarak).toFixed(6)),
  };
}
