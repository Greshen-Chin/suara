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
      <Hero dataContoh={data.dataContoh}>
        {data.usulan.length === 0 ? (
          <TanpaUsulan pagu={data.pagu} periodeTerakhir={data.periodeTerakhir} />
        ) : (
          <GarisPagu
            pagu={data.pagu}
            modeSuara={data.modeSuara}
            modeRekomendasi={data.modeRekomendasi}
          />
        )}
      </Hero>
      <WilayahKontras wilayah={data.wilayah} usulan={data.usulan} />
      <CaraKerja bobot={data.bobot} saranAi={saranAktif()} />
      <JejakKeputusan log={data.log} judulUsulan={judulUsulan} />
    </main>
  );
}
