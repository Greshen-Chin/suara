import { PaguBar } from "@/components/landing/PaguBar";
import { rupiah } from "@/lib/format";
import type { DuaBatang } from "@/lib/keputusan-banding";
import { TEKS_TANPA_REKOMENDASI } from "@/lib/keputusan-kalimat";
import type { ModePagu } from "@/lib/pagu-model";
import styles from "./Keputusan.module.css";

const terpakai = (m: ModePagu): number => m.terpilih.reduce((n, t) => n + t.biaya, 0);

/**
 * Dua Garis Pagu bertumpuk dengan skala yang sama: "Rekomendasi SUARA" dan "Keputusan musyawarah". Usulan yang sama
 * berada di kedua batang; yang BERBEDA ditandai bentuk (bingkai putus-putus dan tanda ≠), bukan hanya warna.
 * Periode yang diputuskan sebelum SUARA dipakai hanya punya batang keputusan, dan halaman menyebutnya terus terang.
 */
export function DuaGaris({ batang }: { batang: DuaBatang }) {
  const { pagu, rekomendasi, keputusan, beda } = batang;
  return (
    <section className={styles.seksi} aria-labelledby="judul-dua-garis">
      <h2 id="judul-dua-garis" className="sr-only">
        Rekomendasi SUARA dan keputusan musyawarah, pada pagu {rupiah(pagu)}
      </h2>
      <div className={styles.dua}>
        {rekomendasi && (
          <figure className={styles.gambar}>
            <figcaption>
              Rekomendasi SUARA
              <span className={styles.gambarKet}>
                {rupiah(terpakai(rekomendasi))} dari pagu {rupiah(pagu)}
              </span>
            </figcaption>
            <PaguBar
              pagu={pagu}
              mode={rekomendasi}
              ringkas
              skalaBulat
              tandaBeda={beda}
              kataStatus="Direkomendasikan"
              label={`Rekomendasi SUARA, pagu ${rupiah(pagu)}`}
            />
          </figure>
        )}
        <figure className={styles.gambar}>
          <figcaption>
            Keputusan musyawarah
            <span className={styles.gambarKet}>
              {rupiah(terpakai(keputusan))} dari pagu {rupiah(pagu)}
            </span>
          </figcaption>
          <PaguBar
            pagu={pagu}
            mode={keputusan}
            ringkas
            skalaBulat
            tandaBeda={beda}
            kataStatus="Disetujui"
            label={`Keputusan musyawarah, pagu ${rupiah(pagu)}`}
          />
        </figure>
      </div>

      {rekomendasi ? (
        <p className={styles.legenda}>
          <span className={styles.contohBeda}>
            <span aria-hidden="true">≠</span> nama usulan
          </span>
          <span>Bingkai putus-putus dan tanda ≠ menandai usulan yang berbeda antara kedua batang.</span>
        </p>
      ) : (
        <p className={styles.tanpaRekomendasi}>{TEKS_TANPA_REKOMENDASI}</p>
      )}
    </section>
  );
}
