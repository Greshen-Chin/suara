import { CaraKerja } from "@/components/landing/CaraKerja";
import { GarisPagu } from "@/components/landing/GarisPagu";
import { Hero } from "@/components/landing/Hero";
import { JejakKeputusan } from "@/components/landing/JejakKeputusan";
import { WilayahKontras } from "@/components/landing/WilayahKontras";
import { muatBeranda } from "@/lib/beranda";

export default async function Beranda() {
  const data = await muatBeranda();
  const judulUsulan = new Map(data.usulan.map((u) => [u.id, u.title]));

  return (
    <main id="isi" tabIndex={-1}>
      <Hero pagu={data.pagu} dataContoh={data.dataContoh} />
      <GarisPagu
        pagu={data.pagu}
        modeSuara={data.modeSuara}
        modeRekomendasi={data.modeRekomendasi}
      />
      <WilayahKontras wilayah={data.wilayah} />
      <CaraKerja bobot={data.bobot} />
      <JejakKeputusan log={data.log} judulUsulan={judulUsulan} />
    </main>
  );
}
