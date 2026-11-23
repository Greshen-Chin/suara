import Link from "next/link";
import { rupiah } from "@/lib/format";
import { LABEL_HASIL } from "@/lib/keputusan";
import { namaPeriode, tanggalMusyawarahTeks } from "@/lib/keputusan-kalimat";
import type { KeputusanUsulan as Data } from "@/lib/keputusan-tipe";
import { RUTE } from "@/lib/tautan";
import { tanggalPanjang } from "@/lib/waktu";
import styles from "./Detail.module.css";

/**
 * Blok tenang di halaman detail usulan yang sudah diputuskan: "Diputuskan pada musyawarah 20 November 2026: Disetujui",
 * alasannya, dan tautan ke halaman tahunnya. Untuk usulan yang sudah selesai dikerjakan: catatan dan biaya realisasi.
 */
export function KeputusanUsulan({ keputusan }: { keputusan: Data }) {
  const tanggal = tanggalMusyawarahTeks(keputusan.tanggalMusyawarah);
  return (
    <section className={styles.bagian} aria-labelledby="judul-keputusan">
      <h2 id="judul-keputusan">Keputusan musyawarah</h2>
      <div className={styles.keputusan}>
        <p className={styles.keputusanHasil}>
          {tanggal ? `Diputuskan pada musyawarah ${tanggal}: ` : "Diputuskan musyawarah: "}
          {LABEL_HASIL[keputusan.hasil]}.
        </p>
        {keputusan.sumberDana && <p>Diajukan ke: {keputusan.sumberDana}.</p>}
        {keputusan.alasan && <p>{keputusan.alasan}</p>}
        {keputusan.statusSekarang === "done" && (
          <p className={styles.keputusanSelesai}>
            Selesai dikerjakan{keputusan.selesaiPada ? ` ${tanggalPanjang(keputusan.selesaiPada)}` : ""}
            {keputusan.biayaRealisasi !== null ? `, biaya realisasi ${rupiah(keputusan.biayaRealisasi)}` : ""}.
            {keputusan.catatanSelesai ? ` ${keputusan.catatanSelesai}` : ""}
          </p>
        )}
        <Link href={`${RUTE.keputusan}/${keputusan.tahun}`}>Lihat {namaPeriode(keputusan.tahun)}</Link>
      </div>
    </section>
  );
}
