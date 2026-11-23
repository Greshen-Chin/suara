import Link from "next/link";
import { rupiah } from "@/lib/format";
import type { ModePagu } from "@/lib/pagu-model";
import type { Bobot } from "@/lib/seleksi";
import { RUTE } from "@/lib/tautan";
import styles from "./BerandaComparison.module.css";

interface Props {
  pagu: number;
  modeSuara: ModePagu;
  modeRekomendasi: ModePagu;
  bobot: Bobot;
}

function ringkasanSingkat(mode: ModePagu): string {
  if (mode.terpilih.length === 0) return "Belum ada usulan yang muat.";
  const namaProyek = mode.terpilih.map((p) => p.judul.split(" depan ")[0].split(" yang ")[0]);
  if (namaProyek.length <= 2) {
    return `${namaProyek.join(" + ")}. Keduanya di ${mode.terpilih[0]?.rw || "wilayah terkait"}.`;
  }
  return `${namaProyek.slice(0, 3).join(", ")}, dan lainnya.`;
}

export function BerandaComparison({
  pagu,
  modeSuara,
  modeRekomendasi,
  bobot,
}: Props) {
  const terpakaiSuara = pagu - modeSuara.tata.sisa.rupiah;
  const sisaSuara = modeSuara.tata.sisa.rupiah;
  const persenSuara = pagu > 0 ? ((terpakaiSuara / pagu) * 100).toFixed(1) : "0";

  const terpakaiRekomendasi = pagu - modeRekomendasi.tata.sisa.rupiah;
  const sisaRekomendasi = modeRekomendasi.tata.sisa.rupiah;
  const persenRekomendasi =
    pagu > 0 ? ((terpakaiRekomendasi / pagu) * 100).toFixed(1) : "0";

  return (
    <section className={styles.bagian} id="banding" aria-labelledby="judul-banding">
      <div className="wadah">
        <div className={styles.kepala}>
          <div>
            <div className={styles.eyebrow}>INILAH PERBEDAANNYA</div>
            <h2 id="judul-banding" className={styles.judul}>
              Satu pagu. Dua cara memilih.
            </h2>
            <p className={styles.deskripsi}>
              Bandingkan hasil berdasarkan jumlah dukungan dengan rekomendasi yang juga
              mempertimbangkan urgensi dan pemerataan.
            </p>
          </div>
          <Link href={RUTE.simulasi} className={styles.tautanSimulasi}>
            Jelajahi simulasi <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className={styles.grid}>
          {/* Kartu Suara Terbanyak */}
          <article className={styles.kartu}>
            <div className={styles.labelKartu}>
              <span className={styles.ikonBulat}>①</span> SUARA TERBANYAK
            </div>
            <strong className={styles.angkaProyek}>
              {modeSuara.terpilih.length} <small>proyek</small>
            </strong>
            <div className={styles.barisUang}>
              {rupiah(terpakaiSuara)} <span>dialokasikan</span>
            </div>
            <div className={styles.track}>
              <i
                className={styles.fillSuara}
                style={{ width: `${persenSuara}%` }}
              />
            </div>
            <p className={styles.keteranganProyek}>
              {ringkasanSingkat(modeSuara)}
            </p>
            <span className={styles.catatanSisa}>
              Sisa pagu {rupiah(sisaSuara)}
            </span>
          </article>

          {/* Kartu Rekomendasi SUARA */}
          <article className={`${styles.kartu} ${styles.kartuRekomendasi}`}>
            <div className={styles.labelKartu}>
              <span className={styles.ikonBulat}>✦</span> REKOMENDASI SUARA
              <span className={styles.pilDisarankan}>Disarankan sistem</span>
            </div>
            <strong className={styles.angkaProyek}>
              {modeRekomendasi.terpilih.length} <small>proyek</small>
            </strong>
            <div className={styles.barisUang}>
              {rupiah(terpakaiRekomendasi)} <span>dialokasikan</span>
            </div>
            <div className={styles.track}>
              <i
                className={styles.fillRekomendasi}
                style={{ width: `${persenRekomendasi}%` }}
              />
            </div>
            <p className={styles.keteranganProyek}>
              {ringkasanSingkat(modeRekomendasi)}
            </p>
            <span className={styles.catatanSisa}>
              Sisa pagu {rupiah(sisaRekomendasi)}
            </span>
          </article>

          {/* Aside Penjelas */}
          <aside className={styles.penjelas}>
            <div className={styles.penjelasKepala}>
              <img
                src="/assets/mascot/tunas-explain.png"
                alt="Tunas menjelaskan rekomendasi SUARA"
                className={styles.maskotPenjelas}
              />
              <div>
                <span className={styles.eyebrowKecil}>KENAPA BERBEDA?</span>
                <h3 className={styles.judulPenjelas}>
                  Kebutuhan dinilai, bukan orangnya.
                </h3>
              </div>
            </div>
            <p className={styles.isiPenjelas}>
              Setiap suara tetap dihitung satu per satu. Prioritas ditentukan
              melalui kebutuhan mendesak, dukungan per penduduk, dan pemerataan
              anggaran.
            </p>
            <div className={styles.daftarBobot}>
              <div className={styles.barisBobot}>
                <span>Urgensi</span>
                <b>{bobot.urgensi}%</b>
              </div>
              <div className={styles.barisBobot}>
                <span>Dukungan</span>
                <b>{bobot.popularitas}%</b>
              </div>
              <div className={styles.barisBobot}>
                <span>Pemerataan</span>
                <b>{bobot.pemerataan}%</b>
              </div>
            </div>
            <Link href={RUTE.keputusan} className={styles.tautanJejak}>
              Baca jejak keputusan <span aria-hidden="true">↗</span>
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
