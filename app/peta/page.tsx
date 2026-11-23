import type { Metadata } from "next";
import { PetaDesa } from "@/components/peta/PetaDesa";
import { muatForum } from "@/lib/forum-data";
import { koordinatUntukUsulan, type UsulanPeta } from "@/lib/peta-data";

export const metadata: Metadata = {
  title: "Peta Persebaran Usulan Desa",
  description:
    "Pantau lokasi fisik dan sebaran usulan pembangunan desa berbasis OpenStreetMap dan Leaflet. Menjaga transparansi dan keadilan pemerataan antar-RW.",
};

export default async function HalamanPeta() {
  const data = await muatForum();

  const daftarUsulan: UsulanPeta[] = data.usulan.map((u) => {
    const titik = koordinatUntukUsulan(u.id, u.rw);
    return {
      id: u.id,
      title: u.title,
      nama_singkat: u.nama_singkat,
      category: u.category,
      estimated_budget: u.estimated_budget,
      status: u.status,
      rw: u.rw,
      vote_count: u.vote_count,
      lat: titik.lat,
      lng: titik.lng,
    };
  });

  return (
    <main id="isi" tabIndex={-1} className="wadah" style={{ paddingTop: "1rem" }}>
      <PetaDesa daftarUsulan={daftarUsulan} />
    </main>
  );
}
