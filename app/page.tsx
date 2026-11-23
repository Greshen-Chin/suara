import { BerandaHero } from "@/components/landing/BerandaHero";
import { BerandaSummary } from "@/components/landing/BerandaSummary";
import { BerandaComparison } from "@/components/landing/BerandaComparison";
import { BerandaProyekPrioritas } from "@/components/landing/BerandaProyekPrioritas";
import { BerandaProses } from "@/components/landing/BerandaProses";
import { WilayahKontras } from "@/components/landing/WilayahKontras";
import { JejakKeputusan } from "@/components/landing/JejakKeputusan";
import { TanpaUsulan } from "@/components/landing/TanpaUsulan";
import { muatBeranda } from "@/lib/beranda";

export default async function Beranda() {
  const data = await muatBeranda();
  const totalDukungan = data.usulan.reduce(
    (acc, u) => acc + (u.vote_count ?? 0),
    0,
  );
  const judulUsulan = new Map(data.usulan.map((u) => [u.id, u.title]));

  return (
    <main id="isi" tabIndex={-1}>
      <BerandaHero dataContoh={data.dataContoh} />

      {data.usulan.length === 0 ? (
        <TanpaUsulan pagu={data.pagu} periodeTerakhir={data.periodeTerakhir} />
      ) : (
        <>
          <BerandaSummary
            pagu={data.pagu}
            jumlahUsulan={data.usulan.length}
            totalDukungan={totalDukungan}
            jumlahWilayah={data.wilayah.length}
          />
          <BerandaComparison
            pagu={data.pagu}
            modeSuara={data.modeSuara}
            modeRekomendasi={data.modeRekomendasi}
            bobot={data.bobot}
          />
          <BerandaProyekPrioritas
            modeRekomendasi={data.modeRekomendasi}
            dataContoh={data.dataContoh}
          />
        </>
      )}

      <BerandaProses />
      <WilayahKontras wilayah={data.wilayah} usulan={data.usulan} />
      <JejakKeputusan log={data.log} judulUsulan={judulUsulan} />
    </main>
  );
}
