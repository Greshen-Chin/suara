import Link from "next/link";
import type { BarisLog } from "@/lib/data";
import { JENIS_LOG, LABEL_JENIS_LOG } from "@/lib/jenis-log";
import { BATAS_JEJAK_AWAL, BATAS_JEJAK_TAMBAH, bangunQueryJejak, type FilterJejak } from "@/lib/keputusan-jejak";
import { RUTE } from "@/lib/tautan";
import { tanggalDanJam } from "@/lib/waktu";
import styles from "./Keputusan.module.css";

interface Props {
  filter: FilterJejak;
  log: readonly BarisLog[];
  adaLagi: boolean;
  /** Judul usulan menurut id untuk catatan yang menyangkut satu usulan. */
  judul: Readonly<Record<string, string>>;
}

/**
 * Jejak keputusan lengkap: semua catatan akuntabilitas, terbaru di atas, dengan penyaring per jenis dan "Muat lebih
 * banyak". Keadaannya hidup di alamat (jenis, batas), jadi bisa dibagikan dan tombol kembali bekerja. Isi catatan
 * dirender sebagai teks.
 */
export function JejakLengkap({ filter, log, adaLagi, judul }: Props) {
  const dasar = `${RUTE.keputusan}`;
  const semua = filter.jenis === null;
  return (
    <section className={styles.seksi} aria-labelledby="jejak" id="jejak">
      <h2 id="jejak">Jejak keputusan</h2>
      <p className={styles.penjelas}>
        Setiap perubahan tercatat: apa yang berubah, siapa yang mencatat, dan kapan. Pilih jenis catatan untuk
        menyaringnya.
      </p>

      <nav aria-label="Saring jenis catatan">
        <ul className={styles.saring}>
          <li>
            <Link href={`${dasar}#jejak`} aria-current={semua ? "true" : undefined} scroll={false}>
              Semua
            </Link>
          </li>
          {JENIS_LOG.map((j) => (
            <li key={j}>
              <Link
                href={`${dasar}${bangunQueryJejak({ jenis: j, batas: BATAS_JEJAK_AWAL })}#jejak`}
                aria-current={filter.jenis === j ? "true" : undefined}
                scroll={false}
              >
                {LABEL_JENIS_LOG[j]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {log.length === 0 ? (
        <p className={styles.teks}>
          {filter.jenis === null ? "Belum ada catatan." : `Belum ada catatan berjenis “${LABEL_JENIS_LOG[filter.jenis]}”.`}
        </p>
      ) : (
        <>
          <p className={styles.penjelas} role="status">
            Menampilkan {log.length} catatan{adaLagi ? ", masih ada yang lebih lama" : ""}.
          </p>
          <ol className={styles.jejak}>
            {log.map((l) => {
              const subjek = l.proposal_id ? judul[l.proposal_id] : undefined;
              return (
                <li key={l.id} className={styles.jejakItem}>
                  <time dateTime={l.created_at}>{tanggalDanJam(l.created_at)}</time>
                  <div className={styles.jejakIsi}>
                    <p className={styles.jenis}>{LABEL_JENIS_LOG[l.log_type]}</p>
                    {subjek && <p className={styles.subjek}>{subjek}</p>}
                    <p>{l.message}</p>
                    <p className={styles.pencatat}>Dicatat oleh {l.actor}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {adaLagi && (
        <p>
          <Link
            href={`${dasar}${bangunQueryJejak(filter, { batas: filter.batas + BATAS_JEJAK_TAMBAH })}#jejak`}
            className="tombol tombol-kedua"
            scroll={false}
          >
            Muat lebih banyak
          </Link>
        </p>
      )}
    </section>
  );
}
