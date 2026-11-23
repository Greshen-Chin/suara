"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cariKutipan } from "@/lib/saran-urgensi";
import styles from "./Saran.module.css";

interface Konteks {
  /** Kutipan yang sedang disorot di isi usulan (null: tidak ada). */
  kutipan: string | null;
  sorot: (kutipan: string | null) => void;
}

const Kosong: Konteks = { kutipan: null, sorot: () => {} };
const KonteksSaran = createContext<Konteks>(Kosong);

/**
 * Menghubungkan catatan pinggir (di formulir) dengan isi usulan (di bagian lain halaman): memilih kutipan di satu
 * tempat menyorotnya di tempat lain. Hanya dipasang halaman admin bila fitur aktif.
 */
export function SaranProvider({ children }: { children: ReactNode }) {
  const [kutipan, setKutipan] = useState<string | null>(null);
  const nilai = useMemo(() => ({ kutipan, sorot: setKutipan }), [kutipan]);
  return <KonteksSaran.Provider value={nilai}>{children}</KonteksSaran.Provider>;
}

export const useSorotKutipan = () => useContext(KonteksSaran);

/**
 * Isi usulan. Tanpa SaranProvider (fitur mati) hasilnya paragraf biasa. Dengan provider, kutipan yang dipilih di
 * catatan pinggir dibungkus <mark> (bisa difokus dengan keyboard), dan dilompati ke tampilan.
 */
export function IsiUsulanSorot({ teks, className }: { teks: string; className?: string }) {
  const { kutipan } = useSorotKutipan();
  const penanda = useRef<HTMLElement>(null);
  const posisi = useMemo(() => (kutipan ? cariKutipan(teks, kutipan) : null), [teks, kutipan]);

  useEffect(() => {
    if (!posisi || !penanda.current) return;
    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    penanda.current.scrollIntoView({ block: "center", behavior: kurangiGerak ? "auto" : "smooth" });
  }, [posisi]);

  if (!posisi) return <p className={className}>{teks}</p>;
  return (
    <p className={className}>
      {teks.slice(0, posisi.awal)}
      <mark ref={penanda} className={styles.sorot} tabIndex={-1} id="kutipan-sorot">
        {teks.slice(posisi.awal, posisi.akhir)}
      </mark>
      {teks.slice(posisi.akhir)}
    </p>
  );
}
