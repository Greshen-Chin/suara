import { ribuan, rupiah, rupiahRinci } from "@/lib/format";
import type { BarisRw } from "@/lib/simulasi";
import styles from "./Simulasi.module.css";

interface Props {
  resmi: readonly BarisRw[];
  simulasi: readonly BarisRw[];
}

/** "naik Rp 85 juta", "turun Rp 20 juta", atau "sama" untuk selisih rupiah resmi dan simulasi. */
function selisih(resmi: number, simulasi: number): string {
  if (resmi === simulasi) return "sama dengan resmi";
  return `${simulasi > resmi ? "naik" : "turun"} ${rupiah(Math.abs(simulasi - resmi))}`;
}

/**
 * Siapa yang kebagian, per RW: rupiah, jumlah usulan, dan rupiah per penduduk, resmi dan simulasi
 * berdampingan. Rupiah per penduduk adalah cara paling jujur melihat pemerataan: RW kecil dengan sedikit
 * usulan bisa mendapat jauh lebih banyak per orang. Tabel asli; di layar sempit sel dipecah menjadi pasangan
 * label dan nilai (peran ARIA dipasang eksplisit, seperti tabel di halaman admin).
 */
export function TabelRw({ resmi, simulasi }: Props) {
  return (
    <table className={styles.tabelRw} role="table">
      <caption>Anggaran yang diterima tiap RW, rekomendasi resmi dan simulasi Anda</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader" rowSpan={2} className={styles.thRw}>
            RW
          </th>
          <th
            scope="colgroup"
            role="columnheader"
            colSpan={3}
            className={`${styles.golongan} ${styles.golonganResmi}`}
          >
            Rekomendasi resmi
          </th>
          <th
            scope="colgroup"
            role="columnheader"
            colSpan={3}
            className={`${styles.golongan} ${styles.golonganSimulasi} ${styles.mulaiSimulasi}`}
          >
            Simulasi Anda
          </th>
        </tr>
        <tr role="row">
          <th
            scope="col"
            role="columnheader"
            className={`${styles.angka} ${styles.subHeader} ${styles.mulaiGolongan}`}
          >
            Anggaran
          </th>
          <th scope="col" role="columnheader" className={`${styles.angka} ${styles.subHeader}`}>
            Usulan
          </th>
          <th scope="col" role="columnheader" className={`${styles.angka} ${styles.subHeader}`}>
            Per penduduk
          </th>
          <th
            scope="col"
            role="columnheader"
            className={`${styles.angka} ${styles.subHeader} ${styles.mulaiGolongan} ${styles.mulaiSimulasi}`}
          >
            Anggaran
          </th>
          <th
            scope="col"
            role="columnheader"
            className={`${styles.angka} ${styles.subHeader} ${styles.kolomSimulasi}`}
          >
            Usulan
          </th>
          <th
            scope="col"
            role="columnheader"
            className={`${styles.angka} ${styles.subHeader} ${styles.kolomSimulasi}`}
          >
            Per penduduk
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {resmi.map((r, i) => {
          const s = simulasi[i];
          const bedaRupiah = s.rupiah - r.rupiah;
          const kelasSelisih =
            bedaRupiah > 0
              ? styles.selisihNaik
              : bedaRupiah < 0
              ? styles.selisihTurun
              : styles.selisihSama;

          return (
            <tr key={r.rw} role="row">
              <th scope="row" role="rowheader" className={styles.selRw}>
                <span className={styles.namaRw}>{r.nama}</span>
                <span className={styles.penduduk}>{ribuan(r.penduduk)} penduduk</span>
              </th>
              <td role="cell" className={`${styles.angka} ${styles.mulaiGolongan}`}>
                <span className={styles.labelSempit} aria-hidden="true">
                  Resmi: anggaran
                </span>
                {rupiah(r.rupiah)}
              </td>
              <td role="cell" className={styles.angka}>
                <span className={styles.labelSempit} aria-hidden="true">
                  Resmi: usulan
                </span>
                {r.jumlah}
              </td>
              <td role="cell" className={styles.angka}>
                <span className={styles.labelSempit} aria-hidden="true">
                  Resmi: per penduduk
                </span>
                {rupiahRinci(Math.round(r.perPenduduk))}
              </td>
              <td
                role="cell"
                className={`${styles.angka} ${styles.mulaiGolongan} ${styles.mulaiSimulasi}`}
              >
                <span className={styles.labelSempit} aria-hidden="true">
                  Simulasi: anggaran
                </span>
                <strong>{rupiah(s.rupiah)}</strong>
                <span className={`${styles.selisih} ${kelasSelisih}`}>
                  {selisih(r.rupiah, s.rupiah)}
                </span>
              </td>
              <td role="cell" className={`${styles.angka} ${styles.kolomSimulasi}`}>
                <span className={styles.labelSempit} aria-hidden="true">
                  Simulasi: usulan
                </span>
                <strong>{s.jumlah}</strong>
              </td>
              <td role="cell" className={`${styles.angka} ${styles.kolomSimulasi}`}>
                <span className={styles.labelSempit} aria-hidden="true">
                  Simulasi: per penduduk
                </span>
                <strong>{rupiahRinci(Math.round(s.perPenduduk))}</strong>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
