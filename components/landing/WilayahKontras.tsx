import type { BarisRekomendasi, BarisWilayah } from "@/lib/data";
import { desimal, persen, ribuan, rupiah } from "@/lib/format";
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
 *
 * "Anggaran periode lalu" hanya menyangkut satu periode: nilai 0 berarti tidak menerima di periode lalu, bukan
 * "belum pernah" (setelah sebuah penetapan, RW yang kali ini tidak kebagian bisa saja menerima di periode sebelumnya).
 * Tanpa usulan dalam hitungan tidak ada suara untuk dibandingkan: tampil hanya penduduk dan anggaran periode lalu.
 */
export function WilayahKontras({ wilayah, usulan }: Props) {
  if (wilayah.length < 2) return null;

  const besar = wilayah.reduce((a, b) => (b.penduduk > a.penduduk ? b : a));
  const tertinggal = wilayah
    .filter((w) => w.rw !== besar.rw)
    .reduce((a, b) => (perKapita(b) < perKapita(a) ? b : a));
  const pasangan = [besar, tertinggal];

  const adaSuara = usulan.length > 0 && pasangan.some((w) => w.jumlah_suara > 0);
  const maksPenduduk = Math.max(...pasangan.map((w) => w.penduduk));
  const maksSuara = Math.max(...pasangan.map((w) => w.jumlah_suara));

  const lebihBersuara =
    adaSuara && suaraPer1000(tertinggal) > suaraPer1000(besar)
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
          {adaSuara ? (
            <p>
              {besar.nama} mengumpulkan {besar.jumlah_suara} suara,{" "}
              {tertinggal.nama} {tertinggal.jumlah_suara}.{lebihBersuara}
            </p>
          ) : (
            <p>
              Belum ada usulan dalam hitungan anggaran, jadi belum ada suara untuk dibandingkan. Yang tampil di sini
              penduduk dan anggaran periode lalu.
            </p>
          )}
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
                      <span style={{ width: `${persen(w.penduduk, maksPenduduk)}%` }} />
                    </span>
                  </dd>
                </div>
                {adaSuara && (
                  <div>
                    <dt>Suara</dt>
                    <dd>
                      {w.jumlah_suara} suara, {desimal(suaraPer1000(w))} per 1.000
                      penduduk
                      <span className={styles.batang} aria-hidden="true">
                        <span style={{ width: `${persen(w.jumlah_suara, maksSuara)}%` }} />
                      </span>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Anggaran periode lalu</dt>
                  <dd>
                    {w.anggaran_lalu === 0
                      ? "Tidak menerima anggaran"
                      : `Menerima ${rupiah(w.anggaran_lalu)}`}
                  </dd>
                </div>
                {adaSuara && (
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
                )}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
