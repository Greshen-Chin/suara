"use client";

import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { BATAS_ADMIN, periksaPagu } from "@/lib/admin-skema";
import { rupiah } from "@/lib/format";
import styles from "./Simulasi.module.css";

interface Props {
  pagu: number;
  paguResmi: number;
  min: number;
  maks: number;
  langkah: number;
  /** "geser" = gerakan terus-menerus (tanpa animasi); selain itu loncatan (batang berpindah dengan animasi). */
  onUbah: (pagu: number, cara: "geser" | "loncat") => void;
}

/** "Rp 300 juta" dipecah supaya "Rp" dan satuan bisa lebih kecil daripada angkanya. */
function pecahRupiah(n: number): { depan: string; angka: string; satuan: string } {
  const bagian = rupiah(n).split(" ");
  if (bagian.length === 3) return { depan: bagian[0], angka: bagian[1], satuan: bagian[2] };
  return { depan: bagian[0], angka: bagian.slice(1).join(" "), satuan: "" };
}

export function KendaliPagu({ pagu, paguResmi, min, maks, langkah, onUbah }: Props) {
  const id = useId();
  const idGeser = `${id}-geser`;
  const idKetik = `${id}-ketik`;
  const idGalat = `${id}-galat`;
  const idBantu = `${id}-bantu`;
  const [ketikan, setKetikan] = useState("");
  const [galat, setGalat] = useState<string | null>(null);

  // Geseran hanya bisa berdiri di kelipatan langkah; pagu yang diketik boleh di antaranya.
  const posisi = Math.min(maks, Math.max(min, Math.round(pagu / langkah) * langkah));
  const besar = pecahRupiah(pagu);
  const sama = pagu === paguResmi;

  function terapkan(e: FormEvent) {
    e.preventDefault();
    const hasil = periksaPagu(ketikan);
    if (!hasil.ok) {
      setGalat(hasil.pesan);
      return;
    }
    setGalat(null);
    setKetikan("");
    onUbah(hasil.nilai, "loncat");
  }

  return (
    <div className={styles.papan} id="kendali-pagu">
      <label htmlFor={idGeser} className={styles.judulKendali}>
        Pagu simulasi
      </label>

      {/* Nilai yang sama diumumkan oleh geseran sendiri (aria-valuetext). <output> sengaja tidak dipakai: ia
          berperan "status" (wilayah langsung) dan akan mengumumkan tiap langkah geseran. */}
      <p className={styles.angkaPagu} aria-hidden="true" data-testid="pagu-besar">
        <span className={styles.satuanBesar}>{besar.depan}</span> {besar.angka}
        {besar.satuan && <span className={styles.satuanBesar}> {besar.satuan}</span>}
      </p>

      <input
        id={idGeser}
        type="range"
        className={styles.geser}
        min={min}
        max={maks}
        step={langkah}
        value={posisi}
        aria-valuetext={rupiah(pagu)}
        style={{ "--isi": `${((posisi - min) / (maks - min)) * 100}%` } as CSSProperties}
        onChange={(e) => onUbah(Number(e.target.value), "geser")}
      />
      <div className={styles.ujungGeser} aria-hidden="true">
        <span>{rupiah(min)}</span>
        <span>{rupiah(maks)}</span>
      </div>

      <form className={styles.ketik} onSubmit={terapkan} noValidate>
        <div className={styles.kolomKetik}>
          <label htmlFor={idKetik}>Atau ketik pagu</label>
          <div className={styles.barisKetik}>
            <input
              id={idKetik}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="mis. 350 juta"
              value={ketikan}
              onChange={(e) => setKetikan(e.target.value)}
              aria-invalid={galat ? true : undefined}
              aria-describedby={`${idBantu}${galat ? ` ${idGalat}` : ""}`}
            />
            <button type="submit" className="tombol tombol-kedua">
              Pakai
            </button>
          </div>
          <p id={idBantu} className={styles.petunjuk}>
            Antara {rupiah(min)} dan {rupiah(BATAS_ADMIN.pagu.maks)}.
          </p>
          {galat && (
            <p id={idGalat} className={styles.galatKolom}>
              {galat}
            </p>
          )}
        </div>
      </form>

      <div className={styles.resmiBaris}>
        {sama ? (
          <p className={styles.petunjuk}>Sama dengan pagu resmi.</p>
        ) : (
          <button type="button" className="tombol tombol-kedua" onClick={() => onUbah(paguResmi, "loncat")}>
            Kembali ke pagu resmi ({rupiah(paguResmi)})
          </button>
        )}
      </div>
    </div>
  );
}
