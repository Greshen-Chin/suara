import type { Metadata } from "next";
import { Simulasi } from "@/components/simulasi/Simulasi";
import { SimulasiKosong, SimulasiTerlaluBanyak } from "@/components/simulasi/SimulasiKosong";
import styles from "@/components/simulasi/Simulasi.module.css";
import { hitungAwalKetahanan } from "@/lib/ketahanan";
import { BATAS_USULAN_OPTIMAL } from "@/lib/seleksi";
import { rentangPagu } from "@/lib/simulasi";
import { muatSimulasi } from "@/lib/simulasi-data";

const DESKRIPSI =
  "Ubah pagu dan bobot, lalu lihat usulan mana yang terbiayai. Tidak ada yang disimpan, dan rekomendasi resmi tidak berubah.";

export const metadata: Metadata = {
  title: "Simulasi anggaran",
  description: DESKRIPSI,
};

// Halaman ini sengaja memblokir sampai data cache siap (lihat komentar di bawah), jadi bukan navigasi "instan" menurut
// validasi pengembangan Next.js. Itu hanya wawasan di mode dev dan tidak pernah menghalangi build; dimatikan di sini
// supaya peringatannya tidak menyesatkan.
export const instant = false;

// Seperti beranda: data dibaca di tingkat halaman (dari cache yang sama untuk semua pengunjung), TANPA <Suspense>.
// Dengan cacheLife yang sama dengan beranda (stale 30 detik) data tidak ikut App Shell; bila dibungkus <Suspense>,
// isinya dialirkan sesudah shell dan baru ditampilkan oleh skrip, sehingga tanpa JavaScript halamannya tersembunyi.
// Tanpa <Suspense>, HTML pertama sudah memuat rekomendasi resmi, Peta Pagu, tabel per RW, dan kalimat uji ketahanan.
// Keadaan simulasi (pagu, bobot, usulan andaian) dibaca di peramban dari alamat, jadi halamannya tetap sama untuk
// semua pengunjung dan bisa diprerender.
export default async function HalamanSimulasi() {
  const data = await muatSimulasi();
  const { usulan, wilayah, pagu, bobot } = data.dasar;
  // Tanpa kendali (nol usulan, atau terlalu banyak), kalimat "Ubah pagu dan bobot..." tidak ada artinya.
  const bisaDisimulasikan = usulan.length > 0 && usulan.length <= BATAS_USULAN_OPTIMAL;

  return (
    <main id="isi" tabIndex={-1} className={`wadah ${styles.halaman}`}>
      <header className={styles.kepala}>
        <h1>Simulasi anggaran</h1>
        {bisaDisimulasikan && <p className={styles.pengantar}>{DESKRIPSI}</p>}
      </header>
      {usulan.length === 0 ? (
        <SimulasiKosong />
      ) : usulan.length > BATAS_USULAN_OPTIMAL ? (
        <SimulasiTerlaluBanyak />
      ) : (
        // Uji ketahanan untuk keadaan resmi dihitung di sini (beberapa milidetik), supaya kalimatnya sudah ada di
        // HTML pertama dan tidak ada yang melompat setelah hidrasi.
        <Simulasi data={data} awal={hitungAwalKetahanan(usulan, wilayah, pagu, bobot, rentangPagu(usulan, pagu))} />
      )}
    </main>
  );
}
