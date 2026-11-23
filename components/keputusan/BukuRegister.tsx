"use client";

import { useMemo, useState } from "react";
import type { BarisLog } from "@/lib/data";
import { waktuRelatif } from "@/lib/waktu";
import styles from "./BukuRegister.module.css";

interface Props {
  logList: BarisLog[];
}

const FILTER_OPTIONS = [
  { id: "semua", label: "Semua Jejak" },
  { id: "status_change", label: "Perubahan Status" },
  { id: "weight_change", label: "Bobot Musyawarah" },
  { id: "budget_change", label: "Pagu Anggaran" },
  { id: "selection", label: "Rekomendasi Seleksi" },
  { id: "note", label: "Catatan Desa" },
];

function formatTipe(tipe: string): { label: string; kelas: string } {
  switch (tipe) {
    case "status_change":
      return { label: "Status Berubah", kelas: styles.tipeStatus };
    case "weight_change":
      return { label: "Bobot Diubah", kelas: styles.tipeBobot };
    case "budget_change":
      return { label: "Pagu Diubah", kelas: styles.tipeAnggaran };
    case "selection":
      return { label: "Seleksi Dihitung", kelas: styles.tipeSeleksi };
    case "note":
      return { label: "Catatan Resmi", kelas: styles.tipeModerasi };
    default:
      return { label: tipe.replace("_", " "), kelas: styles.tipeUmum };
  }
}

export function BukuRegister({ logList }: Props) {
  const [filterAktif, setFilterAktif] = useState<string>("semua");
  const [bukaDetail, setBukaDetail] = useState<Record<number, boolean>>({});

  const logs = useMemo(() => {
    if (filterAktif === "semua") return logList;
    return logList.filter((l) => l.log_type === filterAktif);
  }, [logList, filterAktif]);

  function toggleDetail(id: number) {
    setBukaDetail((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      {/* Filter Chips Bar */}
      <nav className={styles.filterBar} aria-label="Filter Jejak Keputusan">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterAktif(f.id)}
            className={`${styles.chipFilter} ${filterAktif === f.id ? styles.chipFilterAktif : ""}`}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {/* Timeline Register */}
      {logs.length === 0 ? (
        <div className={styles.kosong}>
          <p>Belum ada catatan jejak untuk kategori ini.</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {logs.map((item) => {
            const { label, kelas } = formatTipe(item.log_type);
            const adaDetail =
              item.detail &&
              typeof item.detail === "object" &&
              Object.keys(item.detail).length > 0;
            const isBuka = Boolean(bukaDetail[item.id]);

            return (
              <article key={item.id} className={styles.kartuLog}>
                <div className={styles.kartuHeader}>
                  <span className={`${styles.badgeTipe} ${kelas}`}>{label}</span>
                  <time className={styles.waktuLog} dateTime={item.created_at}>
                    {waktuRelatif(item.created_at)}
                  </time>
                </div>

                <p className={styles.pesanLog}>{item.message}</p>

                <div className={styles.metaLog}>
                  <span>
                    Dicatat oleh: <strong>{item.actor}</strong>
                  </span>
                  <span>ID #{item.id}</span>
                </div>

                {adaDetail && (
                  <div className={styles.detailToggle}>
                    <button
                      type="button"
                      onClick={() => toggleDetail(item.id)}
                      className={styles.tombolDetail}
                    >
                      {isBuka ? "▲ Sembunyikan detail rincian" : "▼ Lihat rincian parameter"}
                    </button>
                    {isBuka && (
                      <pre className={styles.detailJson}>
                        {JSON.stringify(item.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
