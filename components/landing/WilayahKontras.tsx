import type { BarisWilayah } from "@/lib/data";
import { desimal, ribuan, rupiah } from "@/lib/format";
import styles from "./WilayahKontras.module.css";

interface Props { wilayah: BarisWilayah[] }

const suaraPer1000 = (w: BarisWilayah) => w.penduduk > 0 ? (w.jumlah_suara * 1000) / w.penduduk : 0;
const perKapita = (w: BarisWilayah) => w.penduduk > 0 ? w.anggaran_lalu / w.penduduk : 0;

export function WilayahKontras({ wilayah }: Props) {
  if (wilayah.length < 2) return null;
  const terbesar = wilayah.reduce((a, b) => b.penduduk > a.penduduk ? b : a);
  const tertinggal = wilayah.filter((w) => w.rw !== terbesar.rw)
    .reduce((a, b) => perKapita(b) < perKapita(a) ? b : a);

  return <section aria-labelledby="judul-wilayah" className={styles.bagian}>
    <div className={`wadah ${styles.isi}`}>
      <div className={styles.kepala}>
        <p className={styles.kicker}>Mengapa pemerataan penting</p>
        <h2 id="judul-wilayah">Jumlah suara belum menceritakan semuanya.</h2>
        <p>{terbesar.nama} dan {tertinggal.nama} memiliki jumlah penduduk berbeda. Dukungan per 1.000 warga membantu keduanya dibandingkan dengan lebih adil.</p>
      </div>
      <div className={styles.perbandingan}>
        {[terbesar, tertinggal].map((w) => <div key={w.rw} className={styles.wilayah}>
          <h3>{w.nama}</h3>
          <dl>
            <div><dt>Penduduk</dt><dd>{ribuan(w.penduduk)}</dd></div>
            <div><dt>Dukungan</dt><dd>{ribuan(w.jumlah_suara)} suara, {desimal(suaraPer1000(w))} per 1.000 penduduk</dd></div>
            <div><dt>Anggaran periode lalu</dt><dd>{w.anggaran_lalu === 0 ? "Belum menerima" : rupiah(w.anggaran_lalu)}</dd></div>
          </dl>
        </div>)}
      </div>
    </div>
  </section>;
}
