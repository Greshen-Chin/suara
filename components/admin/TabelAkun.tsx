import Link from "next/link";
import type { AkunAdmin } from "@/lib/admin-data";
import { tanggalPanjang } from "@/lib/waktu";
import styles from "./Admin.module.css";

export const NAMA_PERAN: Record<string, string> = { warga: "Warga", admin: "Admin desa" };

/** Warga tertaut: nama lengkap, nomor, dan RT/RW (hanya terlihat admin), atau "Belum tertaut". */
export function Tertaut({ a }: { a: Pick<AkunAdmin, "warga_nama" | "warga_nomor" | "warga_rt" | "warga_rw" | "peran"> }) {
  if (a.warga_nama === null) {
    return <span className={styles.sedikit}>{a.peran === "admin" ? "Tidak tertaut ke warga" : "Belum tertaut"}</span>;
  }
  return (
    <span className={styles.sel}>
      <strong>{a.warga_nama}</strong>
      <span className={styles.sedikit}>
        Nomor {a.warga_nomor} · RT {a.warga_rt}, RW {String(a.warga_rw).padStart(2, "0")}
      </span>
    </span>
  );
}

/** Status akun: ikon dan teks (aktif atau nonaktif), plus penanda bila kata sandinya belum diganti pemilik. */
export function StatusAkun({ a }: { a: Pick<AkunAdmin, "aktif" | "harus_ganti_sandi"> }) {
  return (
    <span className={styles.baris}>
      {a.aktif ? <span className={styles.capAktif}>Aktif</span> : <span className={styles.capNonaktif}>Nonaktif</span>}
      {a.harus_ganti_sandi && <span className={styles.capPerhatian}>Belum mengganti kata sandi</span>}
    </span>
  );
}

/** Daftar akun sebagai tabel register (blok bertumpuk berlabel di ponsel). */
export function TabelAkun({ akun, keterangan }: { akun: readonly AkunAdmin[]; keterangan: string }) {
  return (
    <table className={styles.tabel} role="table">
      <caption>{keterangan}</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader">Nama pengguna</th>
          <th scope="col" role="columnheader">Peran</th>
          <th scope="col" role="columnheader">Warga</th>
          <th scope="col" role="columnheader">Status</th>
          <th scope="col" role="columnheader">Dibuat</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {akun.map((a) => (
          <tr key={a.id} role="row">
            <td role="cell" className={styles.selUtama}>
              <span className={styles.judulBaris}>
                <Link href={`/admin/akun/${a.id}`}>{a.nama_pengguna}</Link>
              </span>
            </td>
            <td role="cell">
              <span className={styles.labelSempit} aria-hidden="true">Peran</span>
              {NAMA_PERAN[a.peran] ?? a.peran}
            </td>
            <td role="cell">
              <span className={styles.labelSempit} aria-hidden="true">Warga</span>
              <Tertaut a={a} />
            </td>
            <td role="cell">
              <span className={styles.labelSempit} aria-hidden="true">Status</span>
              <StatusAkun a={a} />
            </td>
            <td role="cell">
              <span className={styles.labelSempit} aria-hidden="true">Dibuat</span>
              <time dateTime={a.created_at}>{tanggalPanjang(a.created_at)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
