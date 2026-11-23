import Link from "next/link";
import type { Bobot } from "@/lib/seleksi";
import { RUTE } from "@/lib/tautan";
import styles from "./CaraKerja.module.css";

interface Props {
  bobot: Bobot;
  /** true bila saran urgensi dari AI aktif (kunci terpasang). Nilainya dibaca saat build atau revalidasi halaman. */
  saranAi: boolean;
}

interface Langkah {
  judul: string;
  isi: string;
  peranAi: string;
  tautan: { href: string; teks: string };
}

function susunLangkah(bobot: Bobot, saranAi: boolean): Langkah[] {
  return [
    {
      judul: "Sampaikan aspirasi",
      isi: "Warga menulis usulan, atau mendukung usulan yang sudah ada.",
      peranAi:
        "AI mengenali usulan yang mirip dari maknanya, lalu menawarkan gabung dukungan. Bila AI tidak tersedia, SUARA mencocokkan kata dan mengatakannya terus terang.",
      tautan: { href: RUTE.forum, teks: "Buka forum warga" },
    },
    {
      judul: "Bandingkan pilihan anggaran",
      isi: `Skor tiap usulan menggabungkan dukungan per 1.000 penduduk, urgensi, dan pemerataan anggaran, dengan bobot ${bobot.popularitas}, ${bobot.urgensi}, dan ${bobot.pemerataan} hasil musyawarah.`,
      peranAi: saranAi
        ? "AI menyarankan nilai urgensi beserta alasan yang mengutip usulan. Admin desa yang menetapkan."
        : "AI tidak dipakai untuk menilai urgensi. Admin desa menilainya 1 sampai 10 dengan rubrik dan menuliskan alasannya.",
      tautan: { href: RUTE.simulasi, teks: "Coba simulasi anggaran" },
    },
    {
      judul: "Putuskan dengan alasan tertulis",
      isi: "Musyawarah desa memutuskan, dan setiap perubahan bobot atau status dicatat.",
      peranAi: saranAi
        ? "AI tidak ikut memutuskan. Sarannya hanya bahan, dan bila admin membukanya sebelum menilai, nilai saran itu tercatat di jejak."
        : "AI tidak ikut memutuskan. Musyawarah desa dan admin yang menetapkan, dan setiap perubahan tercatat.",
      tautan: { href: RUTE.keputusan, teks: "Lihat keputusan desa" },
    },
  ];
}

/** Tiga tahap berurutan, jadi pakai penomoran. Tiap tahap menyebut peran AI dan tertaut ke layarnya. */
export function CaraKerja({ bobot, saranAi }: Props) {
  return (
    <section aria-labelledby="judul-cara" className="bagian">
      <div className="wadah">
        <div className="bagian-kepala">
          <h2 id="judul-cara">Tiga langkah dari usulan sampai keputusan</h2>
        </div>
        <ol className={styles.daftar}>
          {susunLangkah(bobot, saranAi).map((l, i) => (
            <li key={l.judul} className={styles.langkah}>
              <span className={styles.nomor} aria-hidden="true">
                {i + 1}
              </span>
              <h3>{l.judul}</h3>
              <p>{l.isi}</p>
              <p className={styles.ai}>
                <strong>Peran AI.</strong> {l.peranAi}
              </p>
              <Link href={l.tautan.href} className={styles.tautan}>
                {l.tautan.teks}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
