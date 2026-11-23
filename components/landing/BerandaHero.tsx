import Link from "next/link";
import { RUTE } from "@/lib/tautan";
import styles from "./BerandaHero.module.css";

interface Props {
  dataContoh: boolean;
}

export function BerandaHero({ dataContoh }: Props) {
  return (
    <section className={styles.hero} aria-labelledby="judul-beranda">
      <div className={`wadah ${styles.grid}`}>
        <div className={styles.konten}>
          <div className={styles.eyebrow}>ASPIRASI DIDENGAR · ANGGARAN TERBUKA</div>
          <h1 id="judul-beranda" className={styles.judul}>
            Suara warga.<br />
            <em>Perubahan nyata.</em>
          </h1>
          <p className={styles.keterangan}>
            Warga mengusulkan, desa mempertimbangkan. Lihat bagaimana kebutuhan
            mendesak dan pemerataan memengaruhi rekomendasi anggaran.
          </p>
          <div className={styles.tombolGrup}>
            <Link href={RUTE.forum} className={styles.tombolUtama}>
              Jelajahi usulan <span aria-hidden="true">↗</span>
            </Link>
            <Link href={RUTE.simulasi} className={styles.tombolSekunder}>
              Coba simulasi
            </Link>
          </div>
          <div className={styles.catatanKaki}>
            <span className={styles.titikHijau} aria-hidden="true" />
            <span>
              {dataContoh ? "Data purwarupa" : "Data transparan"} · Keputusan tetap melalui musyawarah desa
            </span>
          </div>
        </div>

        <div className={styles.visual} aria-hidden="true">
          <div className={styles.latarBukit} />
          <img
            src="/assets/mascot/tunas-wave.png"
            alt="Tunas, maskot SUARA, menyambut warga desa"
            className={styles.tunas}
          />
          <div className={styles.balonUcapan}>
            Halo! Setiap kebutuhan punya cerita. 🌱
          </div>
          <img
            src="/assets/scenes/decorative-hills.svg"
            alt=""
            className={styles.bukitDekorasi}
          />
        </div>
      </div>
    </section>
  );
}
