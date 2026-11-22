"use client";

import { useRef, useState } from "react";
import { rupiah } from "@/lib/format";
import type { ModePagu } from "@/lib/pagu-model";
import { KenapaDitunda } from "./KenapaDitunda";
import { PaguBar } from "./PaguBar";
import { PaguSwitch } from "./PaguSwitch";
import { PaguTidakTerbiayai } from "./PaguTidakTerbiayai";
import { usePaguFlip } from "./usePaguFlip";
import styles from "./GarisPagu.module.css";

interface Props {
  pagu: number;
  modeSuara: ModePagu;
  modeRekomendasi: ModePagu;
}

/**
 * Garis Pagu: satu-satunya elemen interaktif di halaman utama. Data kedua mode dihitung
 * di server dan diterima lewat props; komponen ini hanya menampilkan dan menganimasikan.
 * Posisi awal sakelar: Suara terbanyak, supaya masalahnya terlihat lebih dulu.
 */
export function GarisPagu({ pagu, modeSuara, modeRekomendasi }: Props) {
  const [rekomendasi, setRekomendasi] = useState(false);
  const akar = useRef<HTMLDivElement>(null);
  const { tangkap } = usePaguFlip(akar, rekomendasi);

  const mode = rekomendasi ? modeRekomendasi : modeSuara;

  function ubah(nilai: boolean) {
    if (nilai === rekomendasi) return;
    tangkap();
    setRekomendasi(nilai);
  }

  return (
    <div ref={akar} className={styles.papan}>
      <div className={styles.kepala}>
        <h2 className={styles.judul}>Pagu {rupiah(pagu)}: siapa yang kebagian?</h2>
        <PaguSwitch rekomendasi={rekomendasi} onUbah={ubah} />
      </div>

      <p className={styles.ringkasan} aria-live="polite">
        {mode.ringkasan}
      </p>

      <PaguBar pagu={pagu} mode={mode} />
      <PaguTidakTerbiayai item={mode.tidakTerbiayai} />
      <KenapaDitunda penjelasan={mode.ditunda} />
    </div>
  );
}
