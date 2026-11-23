"use client";

import { useEffect, useId, useState } from "react";
import { hitungPratinjauAdmin, type MasukanPratinjau } from "@/app/admin/pratinjau";
import { PerbandinganPagu } from "@/components/anggaran/PerbandinganPagu";
import type { HasilPratinjau } from "@/lib/pratinjau";
import styles from "./Pratinjau.module.css";

const TUNDA_MS = 300;
const LAMBAT_MS = 4000;

type Keadaan =
  | { jenis: "diam" }
  | { jenis: "memuat"; lambat: boolean; sebelumnya: HasilPratinjau | null }
  | { jenis: "siap"; hasil: HasilPratinjau }
  | { jenis: "gagal"; pesan: string };

/**
 * Memanggil Server Action pratinjau setiap kali `masukan` berubah, dengan jeda 300 ms (tidak membanjiri
 * server saat mengetik) dan hanya hasil permintaan TERAKHIR yang dipakai: hasil permintaan lama yang
 * datang terlambat dibuang. Tidak pernah memblokir: bila gagal atau lambat, formulir tetap bisa disimpan.
 */
function usePratinjau(masukan: MasukanPratinjau | null): Keadaan {
  const kunci = masukan ? JSON.stringify(masukan) : null;
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: "diam" });

  useEffect(() => {
    if (kunci === null) return;
    // Setiap perubahan masukan memasang ulang efek ini dan menandai permintaan sebelumnya kedaluwarsa:
    // jawabannya, bila datang terlambat, dibuang.
    let kedaluwarsa = false;
    const masihTerkini = () => !kedaluwarsa;

    let lambat: ReturnType<typeof setTimeout> | undefined;
    const tunda = setTimeout(() => {
      setKeadaan((k) => ({
        jenis: "memuat",
        lambat: false,
        sebelumnya: k.jenis === "siap" ? k.hasil : k.jenis === "memuat" ? k.sebelumnya : null,
      }));
      lambat = setTimeout(() => {
        if (masihTerkini()) setKeadaan((k) => (k.jenis === "memuat" ? { ...k, lambat: true } : k));
      }, LAMBAT_MS);

      hitungPratinjauAdmin(JSON.parse(kunci) as MasukanPratinjau)
        .then((h) => {
          if (!masihTerkini()) return;
          setKeadaan(h.ok ? { jenis: "siap", hasil: h.hasil } : { jenis: "gagal", pesan: h.pesan });
        })
        .catch(() => {
          if (masihTerkini()) {
            setKeadaan({ jenis: "gagal", pesan: "Pratinjau belum bisa dihitung. Anda tetap bisa menyimpan." });
          }
        })
        .finally(() => clearTimeout(lambat));
    }, TUNDA_MS);

    return () => {
      kedaluwarsa = true;
      clearTimeout(tunda);
      clearTimeout(lambat);
    };
  }, [kunci]);

  return kunci === null ? { jenis: "diam" } : keadaan;
}

/**
 * Pratinjau dampak: akibat sebuah keputusan pada Garis Pagu SEBELUM keputusan itu berlaku. Dua batang
 * ("Sekarang" dan "Sesudah disimpan") memakai komponen batang yang sama dengan halaman utama, diikuti
 * usulan yang berubah status. Komponen INI terikat ke halaman admin (memanggil Server Action admin dan
 * labelnya khusus keputusan yang akan disimpan). Yang bisa dipakai ulang adalah tampilan perbandingannya,
 * PerbandinganPagu (components/anggaran), yang juga dipakai halaman /simulasi.
 *
 * `masukan` null = isiannya belum valid; yang tampil hanya `petunjukDiam`.
 */
export function PratinjauDampak({ masukan, petunjukDiam }: { masukan: MasukanPratinjau | null; petunjukDiam: string }) {
  const idJudul = useId();
  const keadaan = usePratinjau(masukan);
  const hasil = keadaan.jenis === "siap" ? keadaan.hasil : keadaan.jenis === "memuat" ? keadaan.sebelumnya : null;
  const menghitung = keadaan.jenis === "memuat";

  return (
    <section className={styles.pratinjau} aria-labelledby={idJudul} aria-busy={menghitung}>
      <h3 id={idJudul} className={styles.judul}>
        Pratinjau dampak
      </h3>

      {/* Satu wilayah status yang diumumkan dengan sopan: hanya berisi hasil akhir (bukan "Menghitung…"),
          jadi pembaca layar tidak dibanjiri saat admin mengetik: jeda 300 ms ditambah waktu hitung. */}
      <div role="status" className={styles.diumumkan}>
        {keadaan.jenis === "siap" && (
          <>
            <p className={styles.ringkasan}>{keadaan.hasil.ringkasan}</p>
            {keadaan.hasil.perpindahan && <p>{keadaan.hasil.perpindahan}</p>}
          </>
        )}
        {keadaan.jenis === "gagal" && <p className={styles.gagal}>{keadaan.pesan}</p>}
      </div>

      {keadaan.jenis === "diam" && <p className={styles.ket}>{petunjukDiam}</p>}
      {menghitung && (
        <p className={styles.ket} aria-hidden="true">
          {keadaan.lambat ? "Pratinjau belum bisa dihitung. Anda tetap bisa menyimpan." : "Menghitung pratinjau…"}
        </p>
      )}

      {hasil && <PerbandinganPagu hasil={hasil} labelSebelum="Sekarang" labelSesudah="Sesudah disimpan" lama={menghitung} />}
    </section>
  );
}
