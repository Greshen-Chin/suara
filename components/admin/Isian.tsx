"use client";

import { useEffect, useState, type ReactNode } from "react";
import { panjang } from "@/lib/usulan-skema";
import styles from "./Admin.module.css";

/** Nilai yang baru dipakai setelah `ms` tanpa perubahan. Untuk pengumuman pembaca layar yang tidak membanjiri saat mengetik. */
export function useDitunda<T>(nilai: T, ms = 600): T {
  const [tunda, setTunda] = useState(nilai);
  useEffect(() => {
    const t = setTimeout(() => setTunda(nilai), ms);
    return () => clearTimeout(t);
  }, [nilai, ms]);
  return tunda;
}

export interface GalatBertaut {
  /** Id kolom yang dituju tautan. */
  id: string;
  pesan: string;
}

/**
 * Ringkasan galat di atas formulir: role="alert" (diumumkan segera), dan tiap galat menaut ke kolomnya.
 * `pesan` adalah kalimat umum; `galat` daftar galat per kolom.
 */
export function RingkasGalat({ pesan, galat, children }: { pesan: string | null; galat: GalatBertaut[]; children?: ReactNode }) {
  if (!pesan && galat.length === 0) return null;
  return (
    <div role="alert" className={styles.pesanGalat}>
      {pesan && <p>{pesan}</p>}
      {galat.length > 0 && (
        <ul>
          {galat.map((g) => (
            <li key={g.id}>
              <a href={`#${g.id}`}>{g.pesan}</a>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

interface KolomAlasanProps {
  id: string;
  /** Nama kolom pada formulir (name). */
  nama: string;
  label: string;
  bantu: ReactNode;
  nilai: string;
  onUbah: (nilai: string) => void;
  maks: number;
  galat: string | null;
  baris?: number;
}

/** Textarea alasan dengan penghitung karakter dan galat di dekat kolomnya. */
export function KolomAlasan({ id, nama, label, bantu, nilai, onUbah, maks, galat, baris = 4 }: KolomAlasanProps) {
  const lebih = panjang(nilai) > maks;
  return (
    <div className={styles.kolom}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={nama}
        rows={baris}
        required
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        aria-invalid={galat ? true : undefined}
        aria-describedby={`${id}-bantu${galat ? ` ${id}-galat` : ""}`}
      />
      <div className={styles.hitungBaris}>
        <p id={`${id}-bantu`} className={styles.petunjuk}>
          {bantu}
        </p>
        <span className={lebih ? `${styles.hitung} ${styles.hitungLebih}` : styles.hitung} aria-hidden="true">
          {panjang(nilai)} / {maks}
        </span>
      </div>
      {galat && (
        <p id={`${id}-galat`} className={styles.galatKolom}>
          {galat}
        </p>
      )}
    </div>
  );
}
