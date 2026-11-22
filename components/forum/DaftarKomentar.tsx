import { tanggalPanjang, waktuRelatif } from "@/lib/waktu";
import type { KomentarForum } from "@/lib/forum-data";
import { DialogSembunyikan } from "./DialogSembunyikan";
import styles from "./Detail.module.css";

interface Props {
  komentar: KomentarForum[];
  idUsulan: string;
  /** Hanya admin yang melihat tombol sembunyikan. Keputusannya tetap di server (fungsi SQL). */
  bisaModerasi: boolean;
  sekarang: Date;
}

const pad = (rw: number) => String(rw).padStart(2, "0");

/**
 * Teks komentar dirender sebagai TEKS React biasa: tidak ada HTML, Markdown, atau tautan yang
 * bisa diklik. Tautan yang ditulis warga tampil apa adanya sebagai teks (white-space: pre-wrap
 * di CSS hanya menjaga baris baru).
 */
export function DaftarKomentar({ komentar, idUsulan, bisaModerasi, sekarang }: Props) {
  if (komentar.length === 0) {
    return <p className={styles.kosongKomentar}>Belum ada komentar. Jadilah yang pertama menanggapi.</p>;
  }

  return (
    <ol className={styles.daftarKomentar}>
      {komentar.map((k) => {
        const penulis = k.dari_admin
          ? "Admin desa"
          : `${k.penulis_nama_depan ?? "Warga"}${k.penulis_rw !== null ? `, RW ${pad(k.penulis_rw)}` : ""}`;
        const idKomentar = `komentar-${k.id}`;

        if (k.disembunyikan_pada !== null) {
          return (
            <li key={k.id} className={styles.komentar}>
              <div id={idKomentar} tabIndex={-1} data-tersembunyi="true" className={styles.disembunyikan}>
                <p>
                  <strong>Komentar disembunyikan</strong> oleh admin desa pada{" "}
                  <time dateTime={k.disembunyikan_pada}>{tanggalPanjang(k.disembunyikan_pada)}</time>.
                </p>
                <p>Alasan: {k.alasan_disembunyikan}</p>
              </div>
            </li>
          );
        }

        return (
          <li key={k.id} className={styles.komentar}>
            <div id={idKomentar} tabIndex={-1} className={styles.komentarIsi}>
              <p className={styles.penulis}>
                {!k.dari_admin && <span className={styles.nama}>{penulis}</span>}
                {k.dari_admin && (
                  <span className={styles.labelAdmin}>
                    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z" />
                    </svg>
                    Admin desa
                  </span>
                )}
                <time dateTime={k.created_at} className={styles.waktuKomentar}>
                  {waktuRelatif(k.created_at, sekarang)}
                </time>
              </p>
              <p className={styles.teks}>{k.isi}</p>
              {bisaModerasi && (
                <DialogSembunyikan
                  jenis="komentar"
                  id={k.id}
                  idUsulan={idUsulan}
                  teksTombol="Sembunyikan"
                  tentang={`komentar dari ${penulis}`}
                  fokusSetelah={idKomentar}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
