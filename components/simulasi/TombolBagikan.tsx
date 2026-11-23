"use client";

import { useId, useState } from "react";
import styles from "./Simulasi.module.css";

interface Props {
  /** Alamat lengkap keadaan sekarang, dibaca saat tombol ditekan (bukan saat dirender). */
  alamat: () => string;
}

type Keadaan = { jenis: "diam" } | { jenis: "disalin" } | { jenis: "dibagikan" } | { jenis: "manual"; alamat: string };

/**
 * Tautan simulasi: navigator.share bila ada (ponsel), jatuh ke salin ke papan klip, dan bila itu pun gagal,
 * alamatnya ditampilkan di kolom untuk disalin dengan tangan. Hasilnya diumumkan lewat satu wilayah status.
 */
export function TombolBagikan({ alamat }: Props) {
  const id = useId();
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: "diam" });

  async function bagikan() {
    const url = alamat();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Simulasi anggaran SUARA", url });
        setKeadaan({ jenis: "dibagikan" });
        return;
      } catch (err) {
        // Warga menutup lembar bagikan: bukan galat, dan tidak perlu menyalin diam-diam.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setKeadaan({ jenis: "disalin" });
    } catch {
      setKeadaan({ jenis: "manual", alamat: url });
    }
  }

  return (
    <div className={styles.bagikan}>
      <button type="button" className="tombol tombol-utama" onClick={bagikan}>
        Bagikan simulasi ini
      </button>
      <div role="status" className={styles.statusBagikan}>
        {keadaan.jenis === "disalin" && "Tautan disalin. Siapa pun yang membukanya melihat simulasi yang sama."}
        {keadaan.jenis === "dibagikan" && "Tautan dibagikan."}
      </div>
      {keadaan.jenis === "manual" && (
        <div className={styles.kolomIsian}>
          <label htmlFor={`${id}-alamat`}>Tautan belum bisa disalin otomatis. Salin dari kolom ini:</label>
          <input
            id={`${id}-alamat`}
            type="text"
            readOnly
            value={keadaan.alamat}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
