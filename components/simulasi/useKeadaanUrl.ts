"use client";

// Keadaan simulasi yang tinggal di alamat halaman (lib/simulasi-url.ts).
//
// Sumber kebenarannya alamat. useSyncExternalStore membaca `location.search`: saat prerender dan hidrasi nilainya
// "" (keadaan resmi, sama dengan HTML dari server, jadi halaman tetap statis dan tanpa JavaScript tetap terbaca),
// lalu sesudah hidrasi alamat yang sebenarnya. Tombol kembali dan maju (popstate) ikut karena kita langganan.
//
// Geseran harus terasa seketika, sedangkan menulis alamat pada tiap gerakan berat dan memenuhi riwayat. Jadi
// perubahan disimpan dulu sebagai `sunting` (berlaku selama alamatnya belum berubah), lalu alamat ditulis
// dengan history.replaceState setelah 300 ms tanpa perubahan. Setelah ditulis, alamat yang baru menghasilkan
// keadaan yang persis sama (bolak-balik terbukti di lib/simulasi-url.test.ts), jadi `sunting` tidak perlu
// dibersihkan: ia tidak berlaku lagi begitu alamatnya berbeda dari yang ia kenal.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DataSimulasi, KeadaanSimulasi } from "@/lib/simulasi";
import { bacaKeadaan, tulisKeadaan } from "@/lib/simulasi-url";

const PERISTIWA = "suara:simulasi-url";
const TUNDA_TULIS_MS = 300;

function langganan(panggil: () => void): () => void {
  window.addEventListener("popstate", panggil);
  window.addEventListener(PERISTIWA, panggil);
  return () => {
    window.removeEventListener("popstate", panggil);
    window.removeEventListener(PERISTIWA, panggil);
  };
}

const bacaSearch = (): string => window.location.search;
const searchServer = (): string => "";

export interface KeadaanDariUrl {
  keadaan: KeadaanSimulasi;
  /** Ubah keadaan; berlaku seketika, alamat menyusul. */
  ubah: (fn: (k: KeadaanSimulasi) => KeadaanSimulasi) => void;
  /** Usulan di alamat yang tidak bisa dipakai (sudah bukan forum, tersembunyi, atau tidak dikenal). */
  tidakTersedia: number;
  /** Usulan di alamat yang tidak muat karena total usulan sudah 16. */
  terpotong: number;
  /** Alamat lengkap keadaan sekarang, untuk dibagikan. Hanya dipanggil dari penangan klik. */
  alamatBagikan: () => string;
}

export function useKeadaanUrl(data: DataSimulasi): KeadaanDariUrl {
  const search = useSyncExternalStore(langganan, bacaSearch, searchServer);
  const dariUrl = useMemo(() => bacaKeadaan(search, data), [search, data]);
  const [sunting, setSunting] = useState<{ dasar: string; keadaan: KeadaanSimulasi } | null>(null);

  const keadaan = sunting && sunting.dasar === search ? sunting.keadaan : dariUrl.keadaan;

  const ubah = useCallback(
    (fn: (k: KeadaanSimulasi) => KeadaanSimulasi) => {
      setSunting((awal) => ({
        dasar: search,
        keadaan: fn(awal && awal.dasar === search ? awal.keadaan : dariUrl.keadaan),
      }));
    },
    [search, dariUrl],
  );

  useEffect(() => {
    if (!sunting || sunting.dasar !== search) return;
    const tulis = setTimeout(() => {
      const tujuan = tulisKeadaan(sunting.keadaan, data);
      if (window.location.search === tujuan) return;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${tujuan}${window.location.hash}`);
      window.dispatchEvent(new Event(PERISTIWA));
    }, TUNDA_TULIS_MS);
    return () => clearTimeout(tulis);
  }, [sunting, search, data]);

  const alamatBagikan = useCallback(
    () => `${window.location.origin}${window.location.pathname}${tulisKeadaan(keadaan, data)}`,
    [keadaan, data],
  );

  return { keadaan, ubah, tidakTersedia: dariUrl.tidakTersedia, terpotong: dariUrl.terpotong, alamatBagikan };
}

