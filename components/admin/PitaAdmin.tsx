import { ambilPenggunaUntukBaca } from "@/lib/auth";
import { IkonPerisai } from "./IkonPerisai";
import { NavAdmin } from "./NavAdmin";
import styles from "./Admin.module.css";

/**
 * Penanda mode admin yang tenang dan selalu terlihat, ditambah navigasi antarbagian. Membaca sesi,
 * jadi dibungkus Suspense oleh pemakainya (layout), sehingga kerangka halaman tetap bisa diprerender.
 * Hanya tampil untuk admin: yang lain melihat halaman "khusus admin desa" tanpa pita.
 */
export async function PitaAdmin() {
  const pengguna = await ambilPenggunaUntukBaca();
  if (!pengguna || pengguna.peran !== "admin") return null;
  return (
    <>
      <div className={styles.pita}>
        <p className={`wadah ${styles.pitaIsi}`}>
          <span className={styles.cap}>
            <IkonPerisai />
            Mode admin desa
          </span>
          <span className={styles.pitaKet}>
            masuk sebagai <strong>{pengguna.nama}</strong>. Perubahan di sini berdampak ke halaman publik.
          </span>
        </p>
      </div>
      <NavAdmin />
    </>
  );
}

/** Kerangka selama sesi dibaca: tinggi sama dengan pita dan navigasi sebenarnya, tanpa lompatan. */
export function KerangkaPita() {
  return (
    <>
      <div className={styles.pitaKerangka} aria-hidden="true" />
      <div className={styles.navKerangka} aria-hidden="true" />
    </>
  );
}
