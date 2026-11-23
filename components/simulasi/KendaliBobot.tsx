"use client";

import { useId, type CSSProperties } from "react";
import { LABEL_BOBOT, PENJELASAN_BOBOT } from "@/lib/admin-skema";
import {
  KUNCI_BOBOT,
  LANGKAH_BOBOT,
  PRESET_BOBOT,
  bobotPreset,
  samaBobot,
  type KunciBobot,
} from "@/lib/bobot-simulasi";
import type { Bobot } from "@/lib/seleksi";
import styles from "./Simulasi.module.css";

interface Props {
  bobot: Bobot;
  bobotResmi: Bobot;
  /** Menggeser satu bobot; dua lainnya dibagi ulang oleh pemanggil (geserBobot). */
  onGeser: (kunci: KunciBobot, nilai: number) => void;
  /** Preset mengisi ketiga geseran sekaligus. */
  onPreset: (bobot: Bobot) => void;
}

function IkonCentang() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}

export function KendaliBobot({ bobot, bobotResmi, onGeser, onPreset }: Props) {
  const id = useId();

  return (
    <div className={styles.papan}>
      <p className={styles.petunjuk}>
        Tiga geseran selalu berjumlah 100: menggeser satu mengubah dua yang lain.
      </p>

      <div className={styles.preset} role="group" aria-label="Pilihan cepat">
        {PRESET_BOBOT.map((p) => {
          const nilai = bobotPreset(p, bobotResmi);
          const aktif = samaBobot(bobot, nilai);
          return (
            <button
              key={p.kunci}
              type="button"
              className={`tombol tombol-kedua ${aktif ? styles.presetAktif : ""}`}
              aria-pressed={aktif}
              onClick={() => onPreset(nilai)}
            >
              {aktif && <IkonCentang />}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className={styles.daftarBobot}>
        {KUNCI_BOBOT.map((k) => {
          const idGeser = `${id}-${k}`;
          return (
            <div key={k} className={styles.barisBobot}>
              <div className={styles.kepalaBobot}>
                <label htmlFor={idGeser}>{LABEL_BOBOT[k]}</label>
                <span className={styles.nilaiBobot} aria-hidden="true">
                  {bobot[k]}
                </span>
              </div>
              <input
                id={idGeser}
                type="range"
                className={styles.geser}
                min={0}
                max={100}
                step={LANGKAH_BOBOT}
                value={bobot[k]}
                aria-describedby={`${idGeser}-bantu`}
                style={{ "--isi": `${bobot[k]}%` } as CSSProperties}
                onChange={(e) => onGeser(k, Number(e.target.value))}
              />
              <p id={`${idGeser}-bantu`} className={styles.petunjuk}>
                {PENJELASAN_BOBOT[k]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
