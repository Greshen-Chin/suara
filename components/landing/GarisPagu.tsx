"use client";

import { useState } from "react";
import Link from "next/link";
import { rupiah, ribuan } from "@/lib/format";
import type { ModePagu } from "@/lib/pagu-model";
import styles from "./GarisPagu.module.css";

interface Props {
  pagu: number;
  modeSuara: ModePagu;
  modeRekomendasi: ModePagu;
}

function dialokasikan(pagu: number, mode: ModePagu) {
  return pagu - mode.tata.sisa.rupiah;
}

export function GarisPagu({ pagu, modeSuara, modeRekomendasi }: Props) {
  const [pilihan, setPilihan] = useState<"suara" | "rekomendasi">("rekomendasi");
  const mode = pilihan === "rekomendasi" ? modeRekomendasi : modeSuara;
  const opsi = [
    { id: "suara" as const, label: "Suara terbanyak", data: modeSuara, penjelas: "Urut berdasarkan jumlah dukungan." },
    { id: "rekomendasi" as const, label: "Rekomendasi SUARA", data: modeRekomendasi, penjelas: "Pertimbangkan dukungan, urgensi, dan pemerataan." },
  ];

  return (
    <section id="perbandingan" aria-labelledby="judul-pagu" className={`wadah ${styles.bagian}`}>
      <div className={styles.kepala}>
        <div>
          <p className={styles.kicker}>Satu pagu, dua cara memilih</p>
          <h2 id="judul-pagu">Bagaimana anggaran dialokasikan?</h2>
          <p>Bandingkan hasilnya lalu periksa usulan yang masuk. Keduanya memakai pagu resmi {rupiah(pagu)}.</p>
        </div>
        <Link href="/simulasi" className={styles.simulasi}>Coba skenario lain <span aria-hidden="true">↗</span></Link>
      </div>

      <div className={styles.perbandingan} role="group" aria-label="Pilih cara alokasi anggaran">
        {opsi.map(({ id, label, data, penjelas }) => {
          const terpakai = dialokasikan(pagu, data);
          return <button key={id} type="button" aria-pressed={pilihan === id}
            className={`${styles.pilihan} ${pilihan === id ? styles.aktif : ""}`}
            onClick={() => setPilihan(id)}>
            <span className={styles.judulOpsi}>{label}</span>
            <span className={styles.penjelasOpsi}>{penjelas}</span>
            <span className={styles.hasilOpsi}><strong>{data.terpilih.length} usulan</strong><span>{rupiah(terpakai)} dialokasikan</span></span>
            <span className={styles.track} aria-hidden="true"><span style={{ width: `${100 - data.tata.sisa.lebar}%` }} /></span>
            <span className={styles.sisa}>Sisa {rupiah(data.tata.sisa.rupiah)}</span>
          </button>;
        })}
      </div>

      <div className={styles.rincian}>
        <div className={styles.rincianKepala}>
          <div>
            <p className={styles.kicker}>Hasil yang sedang dilihat</p>
            <h3>{pilihan === "rekomendasi" ? "Usulan dalam rekomendasi" : "Usulan menurut suara terbanyak"}</h3>
            <p className={styles.ringkasan} aria-live="polite">{mode.ringkasan}</p>
          </div>
          <span className={styles.belumFinal}>Rekomendasi, bukan keputusan akhir</span>
        </div>
        {mode.terpilih.length > 0 ? <ol className={styles.daftar}>
          {mode.terpilih.map((item, index) => <li key={item.id} className={styles.baris}>
            <span className={styles.nomor}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.usulan}>
              <Link href={`/forum/${item.id}`}>{item.judul}</Link>
              <span>{item.rw} · {ribuan(item.suara)} dukungan</span>
            </div>
            <span className={styles.urgensi}>Urgensi {item.urgensi}/10</span>
            <strong className={styles.biaya}>{rupiah(item.biaya)}</strong>
          </li>)}
        </ol> : <p className={styles.kosong}>Belum ada usulan yang muat dalam pagu ini.</p>}
        <details className={styles.belum}>
          <summary>Usulan belum terbiayai <span>{mode.tidakTerbiayai.length} usulan · lihat alasan</span></summary>
          {mode.tidakTerbiayai.length > 0 ? <ul className={styles.daftar}>
            {mode.tidakTerbiayai.map((item) => {
              const alasan = mode.ditunda.find((p) => p.id === item.id);
              return <li key={item.id} className={styles.barisBelum}>
                <div className={styles.usulan}>
                  <Link href={`/forum/${item.id}`}>{item.judul}</Link>
                  <span>{item.rw} · {rupiah(item.biaya)} · {item.status === "ditunda" ? "Ditunda" : "Tidak terpilih"}</span>
                </div>
                <p>{alasan ? alasan.paragraf.join(" ") :
                  item.biaya > mode.tata.sisa.rupiah
                    ? `Biayanya melebihi sisa pagu ${rupiah(mode.tata.sisa.rupiah)}.`
                    : "Tidak masuk hasil pemilihan dengan metode ini."}</p>
              </li>;
            })}
          </ul> : <p className={styles.kosong}>Semua usulan masuk pagu.</p>}
        </details>
      </div>
    </section>
  );
}
