"use client";

import { useState, type RefObject } from "react";
import { PerbandinganPagu } from "@/components/anggaran/PerbandinganPagu";
import { PaguBar } from "@/components/landing/PaguBar";
import { useDitunda } from "@/components/ui/useDitunda";
import { rupiah } from "@/lib/format";
import type { ModePagu } from "@/lib/pagu-model";
import type { HasilBanding } from "@/lib/pratinjau";
import { mintaPenjelasanRekomendasi } from "@/app/simulasi/aksi";
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
  bobot?: { popularitas: number; urgensi: number; pemerataan: number };
}

export function HasilSimulasi({
  akar,
  pagu,
  paguResmi,
  mode,
  modeResmi,
  banding,
  ringkasan,
  perubahan,
  samaDenganResmi,
  andaian,
  bobot,
}: Props) {
  // Satu-satunya wilayah langsung di halaman: ringkasan + apa yang berubah, diumumkan sekali setelah geseran
  // berhenti 0,8 detik. Bukan tiap langkah geseran.
  const diumumkan = useDitunda(`${ringkasan} ${perubahan[0] ?? ""}`.trim(), 800);

  const [statusAi, setStatusAi] = useState<"idle" | "memuat" | "sukses" | "gagal">("idle");
  const [penjelasan, setPenjelasan] = useState<string | null>(null);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);

  const tanganiMintaPenjelasan = async () => {
    setStatusAi("memuat");
    setPesanGalat(null);

    const terpilih = mode.terpilih.map((t) => ({
      judul: t.judul || t.nama,
      wilayah: t.rw,
      biaya: t.biaya,
      dukungan: t.suara,
      urgensi: t.urgensi,
    }));

    const ditunda = mode.tidakTerbiayai.map((t) => ({
      judul: t.judul || t.nama,
      wilayah: t.rw,
      biaya: t.biaya,
      dukungan: t.suara,
      urgensi: t.urgensi,
    }));

    try {
      const res = await mintaPenjelasanRekomendasi({
        pagu,
        bobot,
        terpilih,
        ditunda,
      });

      if (res.ok && res.penjelasan) {
        setPenjelasan(res.penjelasan);
        setStatusAi("sukses");
      } else {
        setPesanGalat(res.pesan || "Gagal memperoleh penjelasan dari AI.");
        setStatusAi("gagal");
      }
    } catch {
      setPesanGalat("Terjadi gangguan koneksi saat meminta penjelasan AI.");
      setStatusAi("gagal");
    }
  };

  return (
    <div className={styles.hasil}>
      <p className={styles.ringkasanHasil}>{ringkasan}</p>
      <p role="status" className="sr-only">
        {diumumkan}
      </p>

      <div ref={akar} className={styles.batangBesar}>
        <PaguBar pagu={pagu} mode={mode} skalaBulat potongNama />
      </div>

      <div className={styles.kotakPenjelasanAi}>
        <div className={styles.kepalaAi}>
          <div className={styles.labelAi}>
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              <path d="M5 3v4" />
              <path d="M19 17v4" />
              <path d="M3 5h4" />
              <path d="M17 19h4" />
            </svg>
            <strong>Penjelasan Rekomendasi (AI)</strong>
          </div>
          <button
            type="button"
            className={styles.tombolMintaAi}
            onClick={tanganiMintaPenjelasan}
            disabled={statusAi === "memuat"}
            aria-busy={statusAi === "memuat"}
          >
            {statusAi === "memuat" ? (
              <>
                <span className={styles.pemutar} aria-hidden="true" />
                <span>Menganalisis...</span>
              </>
            ) : (
              <span>{penjelasan ? "Perbarui Penjelasan" : "✨ Minta Penjelasan AI"}</span>
            )}
          </button>
        </div>

        {penjelasan && (
          <div className={styles.isiPenjelasanAi}>
            <p className={styles.teksPenjelasanAi}>{penjelasan}</p>
            <span className={styles.catatanAi}>
              Dianalisis oleh Vertex AI via VM GCP berdasarkan pagu {rupiah(pagu)} dan kombinasi bobot aktif.
            </span>
          </div>
        )}

        {pesanGalat && (
          <div className={styles.galatAi} role="alert">
            <p>{pesanGalat}</p>
          </div>
        )}
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
