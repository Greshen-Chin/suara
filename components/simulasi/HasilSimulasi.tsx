"use client";

import type { RefObject } from "react";
import { PerbandinganPagu } from "@/components/anggaran/PerbandinganPagu";
import { PaguBar } from "@/components/landing/PaguBar";
import { useDitunda } from "@/components/ui/useDitunda";
import { rupiah } from "@/lib/format";
import type { ModePagu } from "@/lib/pagu-model";
import type { HasilBanding } from "@/lib/pratinjau";
import styles from "./Simulasi.module.css";

interface Props {
  /** Akar animasi FLIP: hanya batang besar ini di dalamnya (dua batang di satu halaman butuh akar terpisah). */
  akar: RefObject<HTMLDivElement | null>;
  pagu: number;
  paguResmi: number;
  /** Rekomendasi pada keadaan simulasi, dan rekomendasi resmi. */
  mode: ModePagu;
  modeResmi: ModePagu;
  banding: HasilBanding;
  /** Kalimat hasil ("4 dari 7 usulan terbiayai. Sisa pagu Rp 15 juta."). */
  ringkasan: string;
  /** Kalimat apa yang berubah dibanding resmi; kosong bila keadaannya sama dengan resmi. */
  perubahan: readonly string[];
  samaDenganResmi: boolean;
  andaian: ReadonlySet<string>;
}

export function HasilSimulasi({ akar, pagu, paguResmi, mode, modeResmi, banding, ringkasan, perubahan, samaDenganResmi, andaian }: Props) {
  // Satu-satunya wilayah langsung di halaman: ringkasan + apa yang berubah, diumumkan sekali setelah geseran
  // berhenti 0,8 detik. Bukan tiap langkah geseran.
  const diumumkan = useDitunda(`${ringkasan} ${perubahan[0] ?? ""}`.trim(), 800);

  return (
    <div className={styles.hasil}>
      <p className={styles.ringkasanHasil}>{ringkasan}</p>
      <p role="status" className="sr-only">
        {diumumkan}
      </p>

      <div ref={akar} className={styles.batangBesar}>
        <PaguBar pagu={pagu} mode={mode} skalaBulat potongNama />
      </div>

      <div className={styles.dibanding}>
        <h3 className={styles.judulKecil}>Yang berubah dari rekomendasi resmi</h3>
        {samaDenganResmi ? (
          <p>Sama dengan rekomendasi resmi.</p>
        ) : (
          <>
            <ul className={styles.kalimatPerubahan}>
              {perubahan.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
            <PerbandinganPagu
              hasil={{ sekarang: modeResmi, sesudah: mode, paguSekarang: paguResmi, paguSesudah: pagu, banding }}
              labelSebelum="Rekomendasi resmi"
              labelSesudah="Simulasi Anda"
              batang="sebelum"
              labelBatangSebelum={`Pembagian pagu resmi ${rupiah(paguResmi)}`}
              skalaBulat
              teksBelumDihitung="Belum dihitung"
              labelDaftar="Usulan yang berubah dari rekomendasi resmi"
              penanda={(b) => (andaian.has(b.id) ? <span className={styles.andaian}>andaian</span> : null)}
            />
          </>
        )}
      </div>
    </div>
  );
}
