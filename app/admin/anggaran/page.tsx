import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormBobot } from "@/components/admin/FormBobot";
import { FormPagu } from "@/components/admin/FormPagu";
import { Kerangka } from "@/components/admin/Kerangka";
import { KhususAdmin } from "@/components/admin/KhususAdmin";
import { RiwayatKeputusan } from "@/components/admin/RiwayatKeputusan";
import styles from "@/components/admin/Admin.module.css";
import { periksaAkses } from "@/lib/admin-akses";
import { bacaLogKeputusan, bacaPengaturan } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Admin · Anggaran" };

export default function HalamanAnggaran() {
  return (
    <Suspense fallback={<Kerangka judul="anggaran" />}>
      <IsiAnggaran />
    </Suspense>
  );
}

async function IsiAnggaran() {
  await connection();
  const akses = await periksaAkses();
  if (akses.status !== "admin") return <KhususAdmin />;
  const admin = akses.pengguna;

  const [pengaturan, riwayat] = await Promise.all([
    bacaPengaturan(admin),
    bacaLogKeputusan(admin, { jenis: ["budget_change", "weight_change"], batas: 20 }),
  ]);

  return (
    <>
      <header className={styles.kepala}>
        <h1>Anggaran</h1>
        <p>
          Pagu dan bobot menentukan usulan mana yang terbiayai. Setiap perubahan butuh alasan tertulis, dan tercatat di
          jejak keputusan yang bisa dibaca semua warga.
        </p>
      </header>

      <section className={styles.seksi} aria-labelledby="judul-pagu">
        <h2 id="judul-pagu">Pagu</h2>
        <FormPagu pagu={pengaturan.pagu} versi={pengaturan.versiPagu} />
      </section>

      <section className={styles.seksi} aria-labelledby="judul-bobot">
        <h2 id="judul-bobot">Bobot penilaian</h2>
        <p className={styles.penjelas}>
          Skor tiap usulan menggabungkan tiga hal, masing-masing 0 sampai 10, menurut bobot di bawah. Jumlah bobot harus
          tepat 100.
        </p>
        <FormBobot bobot={pengaturan.bobot} versi={pengaturan.versiBobot} />
      </section>

      <section className={styles.seksi} aria-labelledby="judul-riwayat">
        <h2 id="judul-riwayat">Riwayat perubahan pagu dan bobot</h2>
        <RiwayatKeputusan log={riwayat} kosong="Belum ada perubahan pagu atau bobot yang tercatat." />
      </section>
    </>
  );
}
