import Link from "next/link";
import { IkonSuara, type NamaIkon } from "@/components/ui/IkonSuara";
import { StatusSiklus } from "@/components/ui/StatusSiklus";
import { tentukanKeadaanDukungan } from "@/lib/aturan-dukungan";
import type { ItemForum } from "@/lib/forum-data";
import { rupiah } from "@/lib/format";
import { LABEL_KATEGORI, adalahKategori } from "@/lib/usulan-skema";
import { waktuRelatif } from "@/lib/waktu";
import { PosisiAnggaran } from "./PosisiAnggaran";
import { TombolDukung } from "./TombolDukung";
import styles from "./Forum.module.css";

interface Props {
  usulan: ItemForum;
  /** Pengguna yang sedang masuk, hanya yang dibutuhkan tampilan. Tanpa id warga. */
  pengguna: { peran: "warga" | "admin"; punyaWarga: boolean } | null;
  didukung: boolean;
  dataCadangan: boolean;
  /** Query filter saat ini, untuk alamat kembali setelah masuk. */
  query: string;
  /** Waktu acuan "x hari lalu", dihitung sekali oleh pemanggil. */
  sekarang: Date;
}

export const pad = (rw: number) => String(rw).padStart(2, "0");

function kategoriKeIkon(kategori: string): NamaIkon {
  switch (kategori) {
    case "infrastruktur":
      return "infrastruktur";
    case "lingkungan":
      return "lingkungan";
    case "fasilitas":
      return "fasilitas";
    case "kesehatan":
      return "perisai";
    case "ekonomi":
      return "dompet";
    case "pendidikan":
      return "aspirasi";
    default:
      return "aspirasi";
  }
}

export function ItemUsulan({
  usulan: u,
  pengguna,
  didukung,
  dataCadangan,
  query,
  sekarang,
}: Props) {
  const keadaan = tentukanKeadaanDukungan({
    pengguna,
    status: u.status,
    dataCadangan,
  });
  const kategori = adalahKategori(u.category)
    ? LABEL_KATEGORI[u.category]
    : u.category;
  const idJudul = `judul-${u.id}`;

  return (
    <li id={`u-${u.id}`} className={styles.item} aria-labelledby={idJudul}>
      <div className={styles.kolomKiri}>
        <div className={styles.iconBox} aria-hidden="true">
          <IkonSuara nama={kategoriKeIkon(u.category)} ukuran={22} />
        </div>
        <div className={styles.isi}>
          <div className={styles.baris}>
            <StatusSiklus status={u.status} />
            <span className={styles.lokasi}>
              {u.rw !== null ? `RW ${pad(u.rw)}` : "Tanpa RW"} · {kategori}
            </span>
          </div>

          <h2 id={idJudul} className={styles.judul}>
            <Link href={`/forum/${u.id}`}>{u.title}</Link>
          </h2>

          <p className={styles.meta}>
            <span className={styles.biaya}>{rupiah(u.estimated_budget)}</span>
            <span>
              {u.source === "musrenbang"
                ? "Dari musyawarah desa"
                : u.pengusul_nama_depan
                  ? `Diusulkan ${u.pengusul_nama_depan}${u.pengusul_rw !== null ? `, RW ${pad(u.pengusul_rw)}` : ""}`
                  : "Diusulkan warga"}
            </span>
            <time dateTime={u.created_at}>
              {waktuRelatif(u.created_at, sekarang)}
            </time>
          </p>

          {u.posisi && <PosisiAnggaran posisi={u.posisi} />}

          <p className={styles.komentar}>
            <Link href={`/forum/${u.id}#komentar`}>
              {u.jumlah_komentar === 0
                ? "Belum ada komentar"
                : `${u.jumlah_komentar} komentar`}
            </Link>
          </p>
        </div>
      </div>

      <div className={styles.aksi}>
        <TombolDukung
          idUsulan={u.id}
          judul={u.title}
          jumlah={u.vote_count}
          didukung={didukung}
          per1000={u.suara_per_1000}
          keadaan={keadaan}
          lanjut={`/forum${query}#u-${u.id}`}
        />
      </div>
    </li>
  );
}
