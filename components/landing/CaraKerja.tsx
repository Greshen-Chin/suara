import Link from "next/link";
import type { Bobot } from "@/lib/seleksi";
import { RUTE } from "@/lib/tautan";
import styles from "./CaraKerja.module.css";

interface Props {
  bobot: Bobot;
  /** true bila saran urgensi dari AI aktif. Pernyataan tentang AI harus benar menurut keadaan ini. */
  saranAi: boolean;
}

export function CaraKerja({ bobot, saranAi }: Props) {
  const kriteria = [
    { nama: "Urgensi", nilai: bobot.urgensi, isi: "Admin desa menilai kebutuhan mendesak pada skala 1–10 dan menulis alasannya." },
    { nama: "Dukungan warga", nilai: bobot.popularitas, isi: "Dukungan dihitung per 1.000 penduduk agar RW kecil tetap terwakili." },
    { nama: "Pemerataan", nilai: bobot.pemerataan, isi: "Anggaran yang diterima tiap RW pada periode lalu ikut dipertimbangkan." },
  ];
  return <section aria-labelledby="judul-cara" className={styles.bagian}>
    <div className="wadah">
      <div className={styles.kepala}>
        <div>
          <h2 id="judul-cara">Mengapa hasilnya bisa berbeda?</h2>
          <p>Rekomendasi menggabungkan tiga pertimbangan. Bobot di bawah ini adalah pengaturan resmi saat ini.</p>
        </div>
        <Link href={RUTE.simulasi}>Uji bobot di simulasi <span aria-hidden="true">↗</span></Link>
      </div>
      <ol className={styles.daftar}>
        {kriteria.map((item) => <li key={item.nama}>
          <span className={styles.nilai}>{item.nilai}%</span>
          <h3>{item.nama}</h3>
          <p>{item.isi}</p>
        </li>)}
      </ol>
      <p className={styles.catatan}>
        <strong>Peran AI:</strong> mengenali usulan yang mirip dari maknanya{' '}
        {saranAi
          ? "dan menyarankan nilai urgensi beserta alasannya; admin desa tetap menetapkan nilainya sendiri."
          : "supaya dukungan tidak terpecah. Urgensi dinilai admin desa, bukan AI."}{' '}
        AI tidak ikut memutuskan.
      </p>
      <p className={styles.catatan}>
        Rekomendasi membantu musyawarah desa, bukan mengesahkan proyek.
        <Link href={RUTE.keputusan}> Periksa jejak perubahan yang sudah tercatat.</Link>
      </p>
    </div>
  </section>;
}
