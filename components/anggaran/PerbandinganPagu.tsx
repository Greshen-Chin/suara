import type { ReactNode } from "react";
import { PaguBar } from "@/components/landing/PaguBar";
import { StatusLabel } from "@/components/ui/StatusLabel";
import { rupiah } from "@/lib/format";
import type { ModePagu } from "@/lib/pagu-model";
import { namaDenganRw, TEKS_STATUS, type BarisBanding, type HasilBanding } from "@/lib/pratinjau";
import styles from "./PerbandinganPagu.module.css";

/** Bagian HasilPratinjau (lib/pratinjau.ts) yang ditampilkan; hasil simulasi menyusun bentuk yang sama. */
export interface DataPerbandingan {
  sekarang: ModePagu;
  sesudah: ModePagu;
  paguSekarang: number;
  paguSesudah: number;
  banding: HasilBanding;
}

interface Props {
  hasil: DataPerbandingan;
  /** Judul batang pertama, mis. "Sekarang" (admin) atau "Rekomendasi resmi" (simulasi). */
  labelSebelum: string;
  /** Judul batang kedua, mis. "Sesudah disimpan" (admin) atau "Simulasi Anda" (simulasi). */
  labelSesudah: string;
  /**
   * "kedua" (bawaan): dua Garis Pagu ringkas berdampingan. "sebelum": hanya yang pertama, untuk halaman
   * yang sudah menampilkan batang kedua sebagai tampilan utamanya (simulasi).
   */
  batang?: "kedua" | "sebelum";
  /** true = isinya diredam selama hitungan baru berjalan: hasil lama tetap terbaca. */
  lama?: boolean;
  /** Nama aksesibel batang pertama dan kedua; bawaan "Pembagian pagu Rp ...". */
  labelBatangSebelum?: string;
  labelBatangSesudah?: string;
  /** Skala batang hanya berisi angka bulat; lihat PaguBar. Bawaan false (halaman admin tidak berubah). */
  skalaBulat?: boolean;
  /** Teks status untuk usulan yang belum dihitung di keadaan pertama. */
  teksBelumDihitung?: string;
  /** Teks status untuk usulan yang tidak lagi dihitung di keadaan kedua. */
  teksTidakLagi?: string;
  /** Teks ringkasan pembuka daftar yang berubah (untuk pembaca layar). */
  labelDaftar?: string;
  /** Tambahan di samping nama usulan, mis. penanda "andaian" pada usulan forum yang ditambahkan. */
  penanda?: (b: BarisBanding) => ReactNode;
}

function Perubahan({
  b,
  teksBelumDihitung,
  teksTidakLagi,
  penanda,
}: {
  b: BarisBanding;
  teksBelumDihitung: string;
  teksTidakLagi: string;
  penanda?: Props["penanda"];
}) {
  const sebelum = b.sebelum ? <StatusLabel status={b.sebelum.status} teks={TEKS_STATUS[b.sebelum.status]} /> : <span className={styles.tanpaStatus}>{teksBelumDihitung}</span>;
  const sesudah = b.sesudah ? <StatusLabel status={b.sesudah.status} teks={TEKS_STATUS[b.sesudah.status]} /> : <span className={styles.tanpaStatus}>{teksTidakLagi}</span>;
  return (
    <li className={styles.perubahan}>
      <span className={styles.nama}>
        {namaDenganRw(b)}
        {penanda?.(b)}
      </span>
      <span className={styles.status}>
        {sebelum}
        <span aria-hidden="true" className={styles.panah}>
          →
        </span>
        <span className="sr-only">menjadi</span>
        {sesudah}
      </span>
    </li>
  );
}

/**
 * Dua keadaan Garis Pagu yang dibandingkan, lalu usulan yang berubah status (dan yang tidak berubah, dilipat).
 * Dipakai pratinjau dampak di halaman admin ("Sekarang" dan "Sesudah disimpan") dan halaman simulasi
 * ("Rekomendasi resmi" dan "Simulasi Anda"). Murni tampilan: tidak memanggil server dan tidak menyimpan
 * apa pun; pemakainya yang menghitung dan menyerahkan `hasil`.
 */
export function PerbandinganPagu({
  hasil,
  labelSebelum,
  labelSesudah,
  batang = "kedua",
  labelBatangSebelum,
  labelBatangSesudah,
  skalaBulat = false,
  lama = false,
  teksBelumDihitung = "Belum dihitung",
  teksTidakLagi = "Tidak lagi dihitung",
  labelDaftar = "Usulan yang berubah status",
  penanda,
}: Props) {
  const { banding } = hasil;
  const bagian = { teksBelumDihitung, teksTidakLagi, penanda };
  return (
    <div className={lama ? `${styles.isi} ${styles.lama}` : styles.isi}>
      <div className={styles.batang}>
        <figure className={styles.gambar}>
          <figcaption>
            {labelSebelum} <span className={styles.paguKet}>(pagu {rupiah(hasil.paguSekarang)})</span>
          </figcaption>
          <PaguBar ringkas pagu={hasil.paguSekarang} mode={hasil.sekarang} label={labelBatangSebelum} skalaBulat={skalaBulat} />
        </figure>
        {batang === "kedua" && (
          <figure className={styles.gambar}>
            <figcaption>
              {labelSesudah} <span className={styles.paguKet}>(pagu {rupiah(hasil.paguSesudah)})</span>
            </figcaption>
            <PaguBar ringkas pagu={hasil.paguSesudah} mode={hasil.sesudah} label={labelBatangSesudah} skalaBulat={skalaBulat} />
          </figure>
        )}
      </div>

      {(banding.masuk.length > 0 || banding.keluar || banding.berubah.length > 0) && (
        <ul className={styles.daftar} aria-label={labelDaftar}>
          {banding.masuk.map((b) => (
            <Perubahan key={b.id} b={b} {...bagian} />
          ))}
          {banding.keluar && <Perubahan b={banding.keluar} {...bagian} />}
          {banding.berubah.map((b) => (
            <Perubahan key={b.id} b={b} {...bagian} />
          ))}
        </ul>
      )}

      {banding.tetap.length > 0 && (
        <details className={styles.tetap}>
          <summary>{banding.tetap.length} usulan tidak berubah</summary>
          <ul className={styles.daftar}>
            {banding.tetap.map((b) => (
              <Perubahan key={b.id} b={b} {...bagian} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
