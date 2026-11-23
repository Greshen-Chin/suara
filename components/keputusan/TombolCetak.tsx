"use client";

import { useSyncExternalStore } from "react";

/** Mencetak halaman ini: lembar A4 untuk papan pengumuman balai desa (gaya cetak di Keputusan.module.css dan globals.css). */
export function TombolCetak() {
  return (
    <button type="button" className="tombol tombol-utama" onClick={() => window.print()}>
      Cetak ringkasan
    </button>
  );
}

const tanpaLangganan = () => () => {};

/** Alamat halaman ini, untuk catatan kaki hasil cetak. Kosong di server dan saat hidrasi, lalu terisi di peramban. */
export function AlamatHalaman() {
  const alamat = useSyncExternalStore(
    tanpaLangganan,
    () => window.location.href,
    () => "",
  );
  return <span>{alamat}</span>;
}
