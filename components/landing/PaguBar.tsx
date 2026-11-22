import { rupiah } from "@/lib/format";
import { titikSkala } from "@/lib/pagu";
import type { ModePagu } from "@/lib/pagu-model";
import { IkonStatus } from "@/components/ui/StatusLabel";
import styles from "./PaguBar.module.css";

interface Props {
  pagu: number;
  mode: ModePagu;
  /**
   * Varian ringkas untuk dua batang yang dibandingkan (pratinjau dampak di halaman admin):
   * lebih pendek dan hanya nama di tiap blok, tanpa rincian biaya. Tanpa prop ini tampilannya
   * sama dengan di halaman utama.
   */
  ringkas?: boolean;
}

/**
 * Batang yang mewakili seluruh pagu. Lebar tiap blok (tinggi pada layar sempit)
 * persis sebanding dengan biayanya; ukurannya datang dari hitungTataPagu.
 * Blok dan ruang sisa memakai data-flip supaya bisa dianimasikan saat mode berganti.
 */
export function PaguBar({ pagu, mode, ringkas = false }: Props) {
  const { tata, terpilih } = mode;
  const barisBlok = new Map(tata.blok.map((b) => [b.id, b]));

  return (
    <div className={ringkas ? `${styles.pita} ${styles.ringkas}` : styles.pita}>
      <div className={styles.skala} aria-hidden="true">
        {titikSkala(pagu).map((t) => (
          <span
            key={t.posisi}
            className={styles.tanda}
            style={{ "--p": t.posisi } as React.CSSProperties}
          >
            {t.rupiah === 0 ? "Rp 0" : rupiah(t.rupiah)}
          </span>
        ))}
      </div>

      <ul className={styles.batang} role="list" aria-label={`Pembagian pagu ${rupiah(pagu)}`}>
        {terpilih.map((item) => (
          <li
            key={item.id}
            data-flip={item.id}
            className={styles.blok}
            style={
              { "--ukuran": `${barisBlok.get(item.id)?.lebar ?? 0}%` } as React.CSSProperties
            }
          >
            <div data-flip-isi className={styles.isi}>
              <span className={styles.nama}>
                <IkonStatus status="terpilih" />
                <span className="sr-only">Terpilih: </span>
                <span className={styles.namaTeks}>{item.nama}</span>
              </span>
              {ringkas ? (
                <span className="sr-only">
                  {item.rw}, {rupiah(item.biaya)}
                </span>
              ) : (
                <span className={styles.meta}>
                  {item.rw}, {rupiah(item.biaya)}
                </span>
              )}
            </div>
          </li>
        ))}
        <li
          data-flip="sisa"
          className={styles.sisa}
          style={{ "--ukuran": `${tata.sisa.lebar}%` } as React.CSSProperties}
        >
          <div data-flip-isi className={styles.isi}>
            <span className={styles.labelSisa}>Sisa {rupiah(tata.sisa.rupiah)}</span>
          </div>
        </li>
      </ul>
    </div>
  );
}
