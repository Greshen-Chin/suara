import { rupiah } from "@/lib/format";
import type { ItemPagu } from "@/lib/pagu-model";
import { StatusLabel } from "@/components/ui/StatusLabel";
import styles from "./PaguTidakTerbiayai.module.css";

interface Props {
  item: ItemPagu[];
}

/** Usulan yang tidak masuk pagu di mode ini: tetap terbaca, supaya yang dikorbankan terlihat. */
export function PaguTidakTerbiayai({ item }: Props) {
  return (
    <section aria-labelledby="judul-tidak-terbiayai" className={styles.bagian}>
      <h3 id="judul-tidak-terbiayai" className={styles.judul}>
        Usulan yang tidak terbiayai
      </h3>
      {item.length === 0 ? (
        <p className={styles.kosong}>Semua usulan masuk pagu.</p>
      ) : (
        <ul className={styles.daftar} role="list">
          {item.map((i) => (
            <li key={i.id} data-flip={i.id} className={styles.baris}>
              <div data-flip-isi className={styles.isi}>
                <div className={styles.nama}>
                  <strong>{i.judul}</strong>
                  <span>
                    {i.rw}, {rupiah(i.biaya)}
                  </span>
                </div>
                <p className={styles.data}>
                  {i.suara} suara, urgensi {i.urgensi} dari 10
                </p>
                <StatusLabel status={i.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
