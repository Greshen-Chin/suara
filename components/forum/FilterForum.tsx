"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LABEL_STATUS_FILTER,
  LABEL_URUTAN,
  STATUS_FILTER,
  URUTAN,
  adaFilterAktif,
  bacaFilter,
  bangunQuery,
  type FilterForum as Filter,
} from "@/lib/forum-filter";
import { KATEGORI, LABEL_KATEGORI } from "@/lib/usulan-skema";
import styles from "./Forum.module.css";

interface Props {
  filter: Filter;
  wilayah: { rw: number; nama: string }[];
}

/**
 * Filter dan urutan sebagai formulir GET: keadaannya hidup di URL, jadi bisa dibagikan dan
 * tombol kembali bekerja. Dengan JavaScript, memilih sebuah nilai langsung menavigasi ke URL
 * kanonik (hanya yang berbeda dari bawaan, lewat bangunQuery) tanpa memuat ulang halaman.
 * Tanpa JavaScript, formulir tetap berfungsi sebagai GET biasa lewat tombol "Terapkan".
 */
export function FilterForum({ filter, wilayah }: Props) {
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  // Jumlah pilihan yang berbeda dari bawaan, ditulis di tombol supaya terlihat meski dilipat.
  const aktif =
    [filter.status !== "semua", filter.rw !== null, filter.kategori !== null, filter.urut !== "terbaru"].filter(Boolean).length;

  function terapkan(form: HTMLFormElement) {
    const nilai = Object.fromEntries(new FormData(form)) as Record<string, string>;
    router.push(`/forum${bangunQuery(bacaFilter(nilai))}`, { scroll: false });
  }

  return (
    <div className={styles.filterBungkus}>
      {/* Di ponsel filter dilipat supaya usulan langsung terlihat. Keadaan awal dilipat sudah
          ada di HTML dari server (tanpa lompatan tata letak saat hidrasi). Tanpa JavaScript,
          <noscript> memaksa formulir terbuka, jadi tidak ada yang terkunci. */}
      <noscript>
        <style>{`.${styles.filter}.${styles.filterTutup}{display:grid !important}.${styles.tombolBuka}{display:none !important}`}</style>
      </noscript>
      <button
        type="button"
        className={`tombol tombol-kedua ${styles.tombolBuka}`}
        aria-expanded={terbuka}
        aria-controls="form-filter"
        onClick={() => setTerbuka((t) => !t)}
      >
        Saring dan urutkan{aktif > 0 ? ` · ${aktif} aktif` : ""}
      </button>
    <form
      id="form-filter"
      action="/forum"
      method="get"
      className={`${styles.filter} ${terbuka ? "" : styles.filterTutup}`}
      aria-label="Saring dan urutkan usulan"
      onChange={(e) => terapkan(e.currentTarget)}
      onSubmit={(e) => {
        e.preventDefault();
        terapkan(e.currentTarget);
      }}
    >
      <div className={`${styles.kolom} ${styles.penuh}`}>
        <label htmlFor="f-status">Status</label>
        <select id="f-status" name="status" defaultValue={filter.status}>
          {STATUS_FILTER.map((s) => (
            <option key={s} value={s}>
              {LABEL_STATUS_FILTER[s]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.kolom}>
        <label htmlFor="f-rw">RW</label>
        <select id="f-rw" name="rw" defaultValue={filter.rw ?? ""}>
          <option value="">Semua</option>
          {wilayah.map((w) => (
            <option key={w.rw} value={w.rw}>
              {w.nama}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.kolom}>
        <label htmlFor="f-kategori">Kategori</label>
        <select id="f-kategori" name="kategori" defaultValue={filter.kategori ?? ""}>
          <option value="">Semua</option>
          {KATEGORI.map((k) => (
            <option key={k} value={k}>
              {LABEL_KATEGORI[k]}
            </option>
          ))}
        </select>
      </div>

      <div className={`${styles.kolom} ${styles.penuh}`}>
        <label htmlFor="f-urut">Urutkan</label>
        <select id="f-urut" name="urut" defaultValue={filter.urut}>
          {URUTAN.map((u) => (
            <option key={u} value={u}>
              {LABEL_URUTAN[u]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.tombolFilter}>
        <button type="submit" className="tombol tombol-kedua">
          Terapkan
        </button>
        {adaFilterAktif(filter) && (
          <Link href="/forum" className={styles.hapus}>
            Hapus filter
          </Link>
        )}
      </div>
    </form>
    </div>
  );
}
