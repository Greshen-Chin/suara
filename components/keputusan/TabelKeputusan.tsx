import { StatusLabel } from "@/components/ui/StatusLabel";
import { StatusSiklus } from "@/components/ui/StatusSiklus";
import { desimal, rupiah } from "@/lib/format";
import { namaRw } from "@/lib/keputusan-banding";
import { LABEL_HASIL, STATUS_SESUDAH } from "@/lib/keputusan";
import type { KeputusanPublik, WilayahPeriode } from "@/lib/keputusan-tipe";
import { tanggalPanjang } from "@/lib/waktu";
import styles from "./Keputusan.module.css";

interface Props {
  tahun: number;
  keputusan: readonly KeputusanPublik[];
  wilayah: readonly WilayahPeriode[];
  /** false: periode yang diputuskan sebelum SUARA dipakai; kolom rekomendasi tidak ada. */
  adaRekomendasi: boolean;
}

/**
 * Semua keputusan satu periode, berurutan menurut peringkat rekomendasi. Tabel asli (caption, th scope), dan di layar
 * sempit tiap baris menjadi blok bertumpuk dengan label di depan isian; peran tabel dipasang eksplisit supaya
 * pembaca layar tetap membacanya sebagai tabel meski tampilannya diubah dengan CSS.
 */
export function TabelKeputusan({ tahun, keputusan, wilayah, adaRekomendasi }: Props) {
  const baris = [...keputusan].sort((a, b) => (a.peringkat ?? 999) - (b.peringkat ?? 999) || b.biaya - a.biaya);
  return (
    <section className={styles.seksi} aria-labelledby="judul-semua">
      <h2 id="judul-semua">Semua keputusan</h2>
      <table className={styles.tabel} role="table">
        <caption>Keputusan musyawarah Tahun Anggaran {tahun}, {baris.length} usulan</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              Usulan
            </th>
            {adaRekomendasi && (
              <th scope="col" role="columnheader">
                Rekomendasi SUARA
              </th>
            )}
            <th scope="col" role="columnheader">
              Keputusan musyawarah
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {baris.map((k) => (
            <tr key={k.proposalId} role="row">
              <th scope="row" role="rowheader">
                <span className={styles.sel}>
                  {k.judul ?? "Usulan yang kemudian disembunyikan admin"}
                  <span className={styles.meta}>
                    {namaRw(k.rw, wilayah)}, {rupiah(k.biaya)}
                  </span>
                </span>
              </th>
              {adaRekomendasi && (
                <td role="cell" data-label="Rekomendasi SUARA">
                  {k.statusRekomendasi ? (
                    <span className={styles.sel}>
                      <StatusLabel status={k.statusRekomendasi} />
                      <span className={styles.meta}>
                        Peringkat {k.peringkat} dari {k.jumlahUsulan}, skor {k.skor === null ? "-" : desimal(k.skor)}
                      </span>
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              )}
              <td role="cell" data-label="Keputusan musyawarah">
                <span className={styles.sel}>
                  <StatusSiklus status={STATUS_SESUDAH[k.hasil]} teks={LABEL_HASIL[k.hasil]} />
                  {k.beda && (
                    <span className={styles.tandaBedaTeks}>
                      <span aria-hidden="true">≠</span> Berbeda dari rekomendasi
                    </span>
                  )}
                  {k.sumberDana && <span className={styles.meta}>Sumber dana: {k.sumberDana}</span>}
                  {k.alasan && <span className={styles.alasan}>{k.alasan}</span>}
                  {k.statusSekarang === "done" && (
                    <span className={styles.meta}>
                      Selesai dikerjakan{k.selesaiPada ? ` ${tanggalPanjang(k.selesaiPada)}` : ""}
                      {k.biayaRealisasi !== null ? `, biaya realisasi ${rupiah(k.biayaRealisasi)}` : ""}.
                      {k.catatanSelesai ? ` ${k.catatanSelesai}` : ""}
                    </span>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
