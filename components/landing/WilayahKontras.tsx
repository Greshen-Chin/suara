import type { BarisRekomendasi, BarisWilayah } from "@/lib/data";
import { desimal, ribuan, rupiah } from "@/lib/format";
import styles from "./WilayahKontras.module.css";

interface Props {
  wilayah: BarisWilayah[];
  usulan: BarisRekomendasi[];
}

const suaraPer1000 = (w: BarisWilayah) => (w.jumlah_suara * 1000) / w.penduduk;
const perKapita = (w: BarisWilayah) => w.anggaran_lalu / w.penduduk;

/**
 * Dua RW berdampingan: yang paling besar penduduknya dan yang paling sedikit
 * menerima anggaran per penduduk. Semua angka datang dari database.
 */
export function WilayahKontras({ wilayah, usulan }: Props) {
  if (wilayah.length < 2) return null;

  const besar = wilayah.reduce((a, b) => (b.penduduk > a.penduduk ? b : a));
  const tertinggal = wilayah
    .filter((w) => w.rw !== besar.rw)
    .reduce((a, b) => (perKapita(b) < perKapita(a) ? b : a));
  const pasangan = [besar, tertinggal];

  const maksPenduduk = Math.max(...pasangan.map((w) => w.penduduk));
  const maksSuara = Math.max(...pasangan.map((w) => w.jumlah_suara));

  const lebihBersuara =
    suaraPer1000(tertinggal) > suaraPer1000(besar)
      ? ` Per 1.000 penduduk, justru ${tertinggal.nama} yang lebih banyak bersuara.`
      : "";

  return (
    <section
      aria-labelledby="judul-wilayah"
      className={`bagian ${styles.bagian}`}
    >
      <div className="wadah bagian-dua-kolom">
        <div className="bagian-kepala">
          <h2 id="judul-wilayah">
            {besar.nama} dan {tertinggal.nama}, di desa yang sama
          </h2>
          <p>
            {besar.nama} mengumpulkan {besar.jumlah_suara} suara,{" "}
            {tertinggal.nama} {tertinggal.jumlah_suara}.{lebihBersuara}
          </p>
        </div>

        <div className={styles.pasangan}>
          {pasangan.map((w) => (
            <article
              key={w.rw}
              aria-labelledby={`wilayah-${w.rw}`}
              className={styles.panel}
            >
              <h3 id={`wilayah-${w.rw}`} className={styles.nama}>
                {w.nama}
              </h3>

              <dl className={styles.data}>
                <div>
                  <dt>Penduduk</dt>
                  <dd>
                    {ribuan(w.penduduk)} orang
                    <span className={styles.batang} aria-hidden="true">
                      <span style={{ width: `${(w.penduduk / maksPenduduk) * 100}%` }} />
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Suara</dt>
                  <dd>
                    {w.jumlah_suara} suara, {desimal(suaraPer1000(w))} per 1.000
                    penduduk
                    <span className={styles.batang} aria-hidden="true">
                      <span style={{ width: `${(w.jumlah_suara / maksSuara) * 100}%` }} />
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Anggaran periode lalu</dt>
                  <dd>
                    {w.anggaran_lalu === 0
                      ? "Belum pernah menerima anggaran"
                      : `Menerima ${rupiah(w.anggaran_lalu)}`}
                  </dd>
                </div>
                <div>
                  <dt>Mengusulkan</dt>
                  <dd>
                    <ul className={styles.usulan}>
                      {usulan
                        .filter((u) => u.rw === w.rw)
                        .map((u) => (
                          <li key={u.id}>{u.title}</li>
                        ))}
                    </ul>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
