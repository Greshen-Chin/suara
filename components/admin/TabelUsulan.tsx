import Link from "next/link";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { StatusSiklus } from "@/components/ui/StatusSiklus";
import type { UsulanAdmin } from "@/lib/admin-data";
import { desimal, ribuan, rupiah } from "@/lib/format";
import type { PosisiHitung } from "@/lib/pratinjau";
import { TEKS_STATUS, labelRw } from "@/lib/pratinjau";
import { teksStatusAdmin } from "@/lib/transisi-status";
import { LABEL_KATEGORI, adalahKategori } from "@/lib/usulan-skema";
import { waktuRelatif } from "@/lib/waktu";
import styles from "./Admin.module.css";

interface Props {
  usulan: readonly UsulanAdmin[];
  /** Posisi pada rekomendasi untuk usulan yang masuk hitungan anggaran. */
  posisi: ReadonlyMap<string, PosisiHitung>;
  /** Id usulan yang baru diubah: ditandai singkat. */
  baru: string | null;
  sekarang: Date;
  /** Kalimat di <caption>, mis. "Menampilkan 25 dari 60 usulan". */
  keterangan: string;
}

/**
 * Daftar usulan sebagai tabel asli (caption, th scope, kolom angka rata kanan) di layar lebar, dan blok
 * bertumpuk berlabel di bawah 64rem (tanpa gulir horizontal). Peran ARIA dipasang eksplisit: bila CSS
 * mengubah tampilan tabel menjadi blok, sebagian browser membuang semantik tabelnya.
 */
export function TabelUsulan({ usulan, posisi, baru, sekarang, keterangan }: Props) {
  return (
    <table className={styles.tabel} role="table">
      <caption>{keterangan}</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">Usulan</th>
          <th scope="col" role="columnheader">RW</th>
          <th scope="col" role="columnheader">Kategori</th>
          <th scope="col" role="columnheader" className={styles.angka}>Biaya</th>
          <th scope="col" role="columnheader" className={styles.angka}>Dukungan</th>
          <th scope="col" role="columnheader" className={styles.angka}>Komentar</th>
          <th scope="col" role="columnheader">Umur</th>
          <th scope="col" role="columnheader">Aksi</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {usulan.map((u) => {
          const tersembunyi = u.disembunyikan_pada !== null;
          const p = posisi.get(u.id);
          return (
            <tr key={u.id} role="row" className={baru === u.id ? styles.baruDiubah : undefined} data-baru={baru === u.id ? "true" : undefined}>
              <td role="cell" className={styles.selUtama}>
                <div className={styles.sel}>
                  <span className={styles.judulBaris}>
                    <Link href={`/forum/${u.id}`}>{u.title}</Link>
                  </span>
                  <span className={styles.baris}>
                    {tersembunyi ? (
                      <span className={styles.capPutus}>Disembunyikan</span>
                    ) : (
                      <StatusSiklus status={u.status} teks={teksStatusAdmin(u.status, u.urgency_score)} />
                    )}
                    {baru === u.id && <span className={styles.penandaBaru}>Baru diubah</span>}
                  </span>
                  {/* Posisi yang sama dengan Garis Pagu dan forum, dalam bentuk ringkas supaya baris tidak membengkak. */}
                  {!tersembunyi && u.status === "voting" && p && (
                    <span className={styles.baris}>
                      <span className={styles.posisi}>
                        Peringkat {p.peringkat} dari {p.jumlah}
                      </span>
                      <StatusLabel status={p.status} teks={TEKS_STATUS[p.status]} />
                    </span>
                  )}
                </div>
              </td>
              <td role="cell" className={styles.nowrap}>
                <span className={styles.labelSempit} aria-hidden="true">RW</span>
                {u.rw !== null ? labelRw(u.rw) : "Tanpa RW"}
              </td>
              <td role="cell">
                <span className={styles.labelSempit} aria-hidden="true">Kategori</span>
                {adalahKategori(u.category) ? LABEL_KATEGORI[u.category] : u.category}
              </td>
              <td role="cell" className={styles.angka}>
                <span className={styles.labelSempit} aria-hidden="true">Biaya</span>
                {rupiah(u.estimated_budget)}
              </td>
              <td role="cell" className={styles.angka}>
                <span className={styles.labelSempit} aria-hidden="true">Dukungan</span>
                <span>
                  {ribuan(u.vote_count)}
                  {u.suara_per_1000 !== null && (
                    <span className={styles.sedikit}> ({desimal(u.suara_per_1000)} per 1.000 penduduk RW)</span>
                  )}
                </span>
              </td>
              <td role="cell" className={styles.angka}>
                <span className={styles.labelSempit} aria-hidden="true">Komentar</span>
                {ribuan(u.jumlah_komentar)}
              </td>
              <td role="cell">
                <span className={styles.labelSempit} aria-hidden="true">Umur</span>
                <time dateTime={u.created_at}>{waktuRelatif(u.created_at, sekarang)}</time>
              </td>
              <td role="cell">
                <span className={styles.aksiSel}>
                  <Link href={`/admin/usulan/${u.id}`}>
                    Tinjau<span className="sr-only"> {u.title}</span>
                  </Link>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
