import Link from "next/link";
import { RUTE } from "@/lib/tautan";
import styles from "./Simulasi.module.css";

/**
 * Belum ada usulan dalam hitungan anggaran (mis. setelah periode ditutup oleh fitur Keputusan). Kendali tidak
 * dirender: tidak ada yang bisa disimulasikan.
 */
export function SimulasiKosong() {
  return (
    <div className={styles.kosong}>
      <h2>Belum ada usulan dalam hitungan anggaran</h2>
      <p>
        Usulan masuk hitungan anggaran setelah admin desa menilainya. Sementara itu, Anda bisa melihat apa yang sedang
        dibahas warga.
      </p>
      <Link href={RUTE.forum} className="tombol tombol-utama">
        Lihat forum warga
      </Link>
    </div>
  );
}

/** Lebih dari 16 usulan: pencarian kombinasi terbaik tidak bisa dijalankan. Seharusnya tidak pernah terjadi. */
export function SimulasiTerlaluBanyak() {
  return (
    <div className={styles.kosong}>
      <h2>Simulasi belum bisa dihitung</h2>
      <p>
        Hitungan anggaran berisi lebih dari 16 usulan, lebih banyak daripada yang bisa dicari kombinasi terbaiknya. Admin
        desa perlu mengurangi jumlahnya lebih dulu.
      </p>
      <Link href={RUTE.beranda} className="tombol tombol-kedua">
        Kembali ke halaman utama
      </Link>
    </div>
  );
}
