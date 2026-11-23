import Link from "next/link";
import { rupiah } from "@/lib/format";
import type { ModePagu } from "@/lib/pagu-model";
import { RUTE } from "@/lib/tautan";
import styles from "./BerandaProyekPrioritas.module.css";

interface Props {
  modeRekomendasi: ModePagu;
  dataContoh: boolean;
}

export function BerandaProyekPrioritas({ modeRekomendasi, dataContoh }: Props) {
  const usulanTerpilih = modeRekomendasi.terpilih;
  const penjelasanDitunda = modeRekomendasi.ditunda[0];

  return (
    <section className={styles.bagian} aria-labelledby="judul-prioritas">
      <div className="wadah">
        <div className={styles.kepala}>
          <div>
            <div className={styles.eyebrow}>
              USULAN PRIORITAS {dataContoh ? "· DATA CONTOH" : "· SISTEM"}
            </div>
            <h2 id="judul-prioritas" className={styles.judul}>
              {usulanTerpilih.length > 0
                ? `${usulanTerpilih.length} kebutuhan yang direkomendasikan.`
                : "Kebutuhan yang direkomendasikan."}
            </h2>
            <p className={styles.deskripsi}>
              Perhitungan sistem bukan keputusan final musyawarah.
            </p>
          </div>
          <Link href={RUTE.forum} className={styles.tautanSemua}>
            Lihat semua usulan <span aria-hidden="true">↗</span>
          </Link>
        </div>

        {usulanTerpilih.length > 0 ? (
          <div className={styles.tabel}>
            {usulanTerpilih.map((item, idx) => (
              <Link
                key={item.id}
                href={`/forum/${item.id}`}
                className={styles.baris}
              >
                <span className={styles.nomor}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className={styles.nama}>
                  {item.judul}
                  <small>Usulan pembangunan</small>
                </span>
                <span className={styles.wilayah}>{item.rw}</span>
                <span className={styles.urgensi}>
                  Urgensi {item.urgensi} / 10
                </span>
                <span className={styles.biaya}>{rupiah(item.biaya)}</span>
                <span className={styles.panah} aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.kosong}>
            Belum ada usulan yang masuk rekomendasi pagu saat ini.
          </p>
        )}

        {/* Kotak Transparansi Penundaan */}
        <div className={styles.peringatan}>
          <img
            src="/assets/mascot/tunas-thinking.png"
            alt="Tunas berpikir"
            className={styles.maskotPeringatan}
          />
          <div className={styles.teksPeringatan}>
            <p>
              <b>
                {penjelasanDitunda
                  ? penjelasanDitunda.pertanyaan
                  : "Kenapa Talud RW 07 ditunda?"}
              </b>{" "}
              {penjelasanDitunda
                ? penjelasanDitunda.paragraf.join(" ")
                : "Urgensinya 10/10, tetapi biayanya Rp220 juta. Sistem memilih kombinasi yang dapat membiayai empat kebutuhan lain dalam pagu yang sama."}
            </p>
          </div>
          <Link href={RUTE.keputusan} className={styles.tautanAlasan}>
            Lihat alasannya →
          </Link>
        </div>
      </div>
    </section>
  );
}
