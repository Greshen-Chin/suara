"use client";

import { useId, useState, type CSSProperties } from "react";
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

function IkonTerkunci() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IkonTerbuka() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

export function KendaliBobot({ bobot, bobotResmi, onGeser, onPreset }: Props) {
  const id = useId();
  const [terkunci, setTerkunci] = useState<Record<KunciBobot, boolean>>({
    popularitas: false,
    urgensi: false,
    pemerataan: false,
  });

  function toggleKunci(k: KunciBobot) {
    setTerkunci((prev) => {
      if (prev[k]) {
        return { ...prev, [k]: false };
      }
      const jumlahTerkunci = Object.values(prev).filter(Boolean).length;
      if (jumlahTerkunci >= 2) {
        // Maksimal 2 yang terkunci agar ada ruang untuk bergerak
        return prev;
      }
      return { ...prev, [k]: true };
    });
  }

  function handleGeser(k: KunciBobot, nilaiBaru: number) {
    if (terkunci[k]) return;

    const kLain = KUNCI_BOBOT.filter((item) => item !== k);
    const k1 = kLain[0];
    const k2 = kLain[1];

    const k1Locked = terkunci[k1];
    const k2Locked = terkunci[k2];

    // Jika dua bobot lainnya dikunci, bobot ini tidak bisa berubah
    if (k1Locked && k2Locked) {
      return;
    }

    // Jika satu bobot lain dikunci, maka hanya bobot ketiga yang menyerap selisih
    if (k1Locked && !k2Locked) {
      const valK1 = bobot[k1];
      const maksK = 100 - valK1;
      const step = LANGKAH_BOBOT;
      const clampedK = Math.min(maksK, Math.max(0, Math.round(nilaiBaru / step) * step));
      const valK2 = 100 - valK1 - clampedK;
      onPreset({
        ...bobot,
        [k]: clampedK,
        [k1]: valK1,
        [k2]: valK2,
      });
      return;
    }

    if (k2Locked && !k1Locked) {
      const valK2 = bobot[k2];
      const maksK = 100 - valK2;
      const step = LANGKAH_BOBOT;
      const clampedK = Math.min(maksK, Math.max(0, Math.round(nilaiBaru / step) * step));
      const valK1 = 100 - valK2 - clampedK;
      onPreset({
        ...bobot,
        [k]: clampedK,
        [k2]: valK2,
        [k1]: valK1,
      });
      return;
    }

    // Jika tidak ada yang dikunci: pembagian proporsional standar
    onGeser(k, nilaiBaru);
  }

  return (
    <div className={styles.papan}>
      <p className={styles.petunjuk}>
        Tiga geseran selalu berjumlah 100. Kunci nilai untuk menahan satu bobot saat menggeser yang lain.
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
              onClick={() => {
                setTerkunci({ popularitas: false, urgensi: false, pemerataan: false });
                onPreset(nilai);
              }}
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
          const isLocked = terkunci[k];
          return (
            <div key={k} className={styles.barisBobot}>
              <div className={styles.kepalaBobot}>
                <div className={styles.labelGrup}>
                  <label htmlFor={idGeser}>{LABEL_BOBOT[k]}</label>
                  <button
                    type="button"
                    className={`${styles.tombolKunci} ${isLocked ? styles.tombolKunciAktif : ""}`}
                    onClick={() => toggleKunci(k)}
                    title={isLocked ? `Buka kunci ${LABEL_BOBOT[k]}` : `Kunci nilai ${LABEL_BOBOT[k]}`}
                    aria-label={isLocked ? `Buka kunci ${LABEL_BOBOT[k]}` : `Kunci ${LABEL_BOBOT[k]}`}
                    aria-pressed={isLocked}
                  >
                    {isLocked ? <IkonTerkunci /> : <IkonTerbuka />}
                  </button>
                </div>
                <div className={styles.nilaiGrup}>
                  {isLocked && <span className={styles.badgeKunci}>Terkunci</span>}
                  <span className={styles.nilaiBobot} aria-hidden="true">
                    {bobot[k]}
                  </span>
                </div>
              </div>
              <input
                id={idGeser}
                type="range"
                className={styles.geser}
                min={0}
                max={100}
                step={LANGKAH_BOBOT}
                value={bobot[k]}
                disabled={isLocked}
                aria-disabled={isLocked}
                aria-describedby={`${idGeser}-bantu`}
                style={{ "--isi": `${bobot[k]}%` } as CSSProperties}
                onChange={(e) => handleGeser(k, Number(e.target.value))}
              />
              <p id={`${idGeser}-bantu`} className={styles.petunjuk}>
                {isLocked ? `Terkunci di ${bobot[k]}%. Tidak akan bergeser saat nilai lain diubah.` : PENJELASAN_BOBOT[k]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
