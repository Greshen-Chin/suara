import { CaraKerja } from "@/components/landing/CaraKerja";
import { GarisPagu } from "@/components/landing/GarisPagu";
import { Hero } from "@/components/landing/Hero";
import { JejakKeputusan } from "@/components/landing/JejakKeputusan";
import { TanpaUsulan } from "@/components/landing/TanpaUsulan";
import { WilayahKontras } from "@/components/landing/WilayahKontras";
import { muatBeranda } from "@/lib/beranda";
import { saranAktif } from "@/lib/saran-urgensi-server";

export default async function Beranda() {
  const data = await muatBeranda();
  const judulUsulan = new Map(data.usulan.map((u) => [u.id, u.title]));

  return (
    <main id="isi" tabIndex={-1}>
      <Hero pagu={data.pagu} dataContoh={data.dataContoh} />
      {/* Tanpa usulan dalam hitungan (misalnya sesudah musyawarah memutuskan semuanya), perbandingan "0 usulan
          lawan 0 usulan" terbaca seperti galat. Keadaannya dijelaskan, dengan jalan ke keputusan terakhir dan forum. */}
      {data.usulan.length === 0 ? (
        <section id="perbandingan" aria-label="Perbandingan anggaran" className="wadah">
          <TanpaUsulan pagu={data.pagu} periodeTerakhir={data.periodeTerakhir} />
        </section>
      ) : (
        <GarisPagu
          pagu={data.pagu}
          modeSuara={data.modeSuara}
          modeRekomendasi={data.modeRekomendasi}
        />
      )}
      <WilayahKontras wilayah={data.wilayah} />
      <CaraKerja bobot={data.bobot} saranAi={saranAktif()} />
      <JejakKeputusan log={data.log} judulUsulan={judulUsulan} />
    </main>
  );
}
