import { ribuan, rupiah, rupiahRinci } from "@/lib/format";
import type { BarisAnggaranRw } from "@/lib/keputusan-banding";
import styles from "./Keputusan.module.css";

/** "naik Rp 85 juta", "turun Rp 250 juta", atau "sama". Kata, bukan hanya panah atau warna. */
function selisih(sekarang: number, lalu: number | null): string | null {
  if (lalu === null) return null;
  if (sekarang === lalu) return "sama";
  return sekarang > lalu ? `naik ${rupiah(sekarang - lalu)}` : `turun ${rupiah(lalu - sekarang)}`;
}

/**
 * Anggaran tiap RW pada periode ini: jumlah yang disetujui, per penduduk, dan dibanding periode lalu menurut potret
 * saat penetapan. Per penduduk yang membuat RW kecil dan RW besar bisa dibandingkan.
 */
export function TabelRwKeputusan({ tahun, baris }: { tahun: number; baris: readonly BarisAnggaranRw[] }) {
  return (
    <section className={styles.seksi} aria-labelledby="judul-rw">
      <h2 id="judul-rw">Anggaran tiap RW</h2>
      <p className={styles.penjelas}>
        Jumlah biaya usulan yang disetujui di tiap RW pada Tahun Anggaran {tahun}. Angka ini juga menjadi &ldquo;anggaran periode
        lalu&rdquo; yang dipakai komponen pemerataan pada periode berikutnya.
      </p>
      <table className={styles.tabel} role="table">
        <caption>Anggaran tiap RW, Tahun Anggaran {tahun}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              RW
            </th>
            <th scope="col" role="columnheader" className={styles.angka}>
              Periode ini
            </th>
            <th scope="col" role="columnheader" className={styles.angka}>
              Per penduduk
            </th>
            <th scope="col" role="columnheader" className={styles.angka}>
              Periode lalu
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {baris.map((b) => (
            <tr key={b.rw} role="row">
              <th scope="row" role="rowheader">
                <span className={styles.sel}>
                  {b.nama}
                  <span className={styles.meta}>{ribuan(b.penduduk)} penduduk</span>
                </span>
              </th>
              <td role="cell" className={styles.angka} data-label="Periode ini">
                {rupiah(b.diterima)}
              </td>
              <td role="cell" className={styles.angka} data-label="Per penduduk">
                {rupiahRinci(b.perPenduduk)}
              </td>
              <td role="cell" className={styles.angka} data-label="Periode lalu">
                {b.periodeLalu === null ? (
                  "tidak diketahui"
                ) : (
                  <span className={styles.sel}>
                    {rupiah(b.periodeLalu)}
                    <span className={styles.meta}>{selisih(b.diterima, b.periodeLalu)}</span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
