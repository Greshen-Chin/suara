import Link from "next/link";
import { RUTE } from "@/lib/tautan";
import styles from "./Admin.module.css";

/**
 * Yang sudah masuk tetapi bukan admin melihat ini, bukan pengalihan diam-diam: mereka tahu halamannya ada,
 * kenapa tidak bisa dibuka, dan ke mana sebaiknya pergi.
 */
export function KhususAdmin() {
  return (
    <div className={styles.khusus}>
      <h1>Halaman ini khusus admin desa</h1>
      <p>
        Akun Anda masuk sebagai warga, jadi halaman admin tidak bisa dibuka. Forum tetap bisa Anda pakai untuk membaca,
        mendukung, dan berdiskusi.
      </p>
      <div className={styles.tombolBaris}>
        <Link href={RUTE.forum} className="tombol tombol-utama">
          Ke forum warga
        </Link>
        <Link href={RUTE.akun} className="tombol tombol-kedua">
          Ke akun saya
        </Link>
      </div>
    </div>
  );
}
