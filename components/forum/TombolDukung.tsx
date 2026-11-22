"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { batalDukungUsulan, dukungUsulan } from "@/app/forum/aksi";
import { penjelasanDukungan, type KeadaanDukungan } from "@/lib/aturan-dukungan";
import { desimal, ribuan } from "@/lib/format";
import { RUTE } from "@/lib/tautan";
import styles from "./TombolDukung.module.css";

interface Props {
  idUsulan: string;
  /** Hanya untuk label pembaca layar: tombol di daftar perlu tahu usulan mana yang didukung. */
  judul: string;
  jumlah: number;
  didukung: boolean;
  /** Dukungan per 1.000 penduduk RW, bila RW-nya diketahui. */
  per1000: number | null;
  keadaan: KeadaanDukungan;
  /** Alamat tujuan setelah masuk, mis. "/forum?status=voting#u-abc". */
  lanjut: string;
}

interface Tampilan {
  jumlah: number;
  didukung: boolean;
}

/**
 * Jumlah dukungan dan tombolnya, dalam satu komponen supaya angkanya ikut berubah seketika
 * (useOptimistic). Bila server menolak, angka kembali sendiri dan pesannya tampil di bawah
 * tombol. Keadaan yang tidak memperbolehkan mendukung (admin, belum tertaut, ditutup, data
 * cadangan) diganti penjelasan, bukan tombol yang mati tanpa alasan.
 */
export function TombolDukung({ idUsulan, judul, jumlah, didukung, per1000, keadaan, lanjut }: Props) {
  const router = useRouter();
  const [tampil, setTampil] = useOptimistic<Tampilan, Tampilan>({ jumlah, didukung }, (_lama, baru) => baru);
  const [menunggu, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState("");
  // Angka bergerak hanya sebagai jawaban atas aksi warga, bukan saat halaman dimuat.
  const [sudahBeraksi, setSudahBeraksi] = useState(false);

  function tekan() {
    if (menunggu) return; // aria-disabled, bukan disabled: fokus keyboard tidak lepas
    const target = !tampil.didukung;
    setGalat(null);
    setSudahBeraksi(true);
    mulai(async () => {
      setTampil({ jumlah: tampil.jumlah + (target ? 1 : -1), didukung: target });
      const hasil = await (target ? dukungUsulan(idUsulan) : batalDukungUsulan(idUsulan));
      if (!hasil.ok) {
        if (hasil.kode === "belum_masuk") {
          router.push(`${RUTE.masuk}?lanjut=${encodeURIComponent(lanjut)}`);
          return;
        }
        setGalat(hasil.pesan);
        setKabar("");
        return;
      }
      setKabar(
        hasil.didukung
          ? `Dukungan ditambahkan. Sekarang ${ribuan(hasil.jumlah)} dukungan.`
          : `Dukungan dibatalkan. Sekarang ${ribuan(hasil.jumlah)} dukungan.`,
      );
    });
  }

  const penjelasan = penjelasanDukungan(keadaan);

  return (
    <div className={styles.bungkus}>
    <div className={styles.dukung}>
      <p className={styles.angka}>
        <span key={tampil.jumlah} className={`${styles.jumlah} ${sudahBeraksi ? styles.berubah : ""}`}>
          {ribuan(tampil.jumlah)}
        </span>
        <span className={styles.satuan}>dukungan</span>
        {per1000 !== null && (
          <span className={styles.per}>{desimal(per1000)} per 1.000 penduduk RW</span>
        )}
      </p>

      {keadaan.jenis === "perlu-masuk" && (
        <Link
          href={`${RUTE.masuk}?lanjut=${encodeURIComponent(lanjut)}`}
          className={styles.tautanMasuk}
        >
          Masuk untuk mendukung
          <span className="sr-only">, usulan {judul}</span>
        </Link>
      )}

      {keadaan.jenis === "bisa" && (
        <button
          type="button"
          className={`tombol ${styles.tombol} ${tampil.didukung ? "tombol-utama" : "tombol-kedua"}`}
          aria-pressed={tampil.didukung}
          aria-disabled={menunggu || undefined}
          onClick={tekan}
        >
          {tampil.didukung && <IkonCentang />}
          {tampil.didukung ? "Didukung" : "Dukung"}
          <span className="sr-only"> usulan {judul}</span>
        </button>
      )}

      {penjelasan && <p className={styles.penjelasan}>{penjelasan}</p>}

      <p role="status" className="sr-only">
        {kabar}
      </p>
      {galat && (
        <p role="alert" className={styles.galat}>
          {galat}
        </p>
      )}
    </div>
    </div>
  );
}

function IkonCentang() {
  return (
    <svg
      className={styles.ikon}
      viewBox="0 0 16 16"
      width={16}
      height={16}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}
