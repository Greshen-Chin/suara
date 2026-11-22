import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/admin/Admin.module.css";

export const metadata: Metadata = { title: "Admin · Tidak ditemukan" };

/** 404 untuk usulan atau akun yang tidak ada (id salah, atau sudah dihapus). */
export default function TidakDitemukanAdmin() {
  return (
    <div className={styles.khusus}>
      <h1>Halaman tidak ditemukan</h1>
      <p>
        Usulan atau akun yang Anda cari tidak ada. Mungkin alamatnya salah ketik, atau datanya sudah dihapus. Kembali ke
        daftar untuk mencarinya lagi.
      </p>
      <div className={styles.tombolBaris}>
        <Link href="/admin/usulan" className="tombol tombol-utama">
          Lihat semua usulan
        </Link>
        <Link href="/admin/akun" className="tombol tombol-kedua">
          Lihat semua akun
        </Link>
      </div>
    </div>
  );
}
