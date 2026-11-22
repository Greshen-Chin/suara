"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { rupiah } from "@/lib/format";
import { labelRw } from "@/lib/pratinjau";
import type { UsulanForum } from "@/lib/simulasi";
import { RUBRIK_URGENSI, label, rubrikUntuk } from "@/lib/urgensi";
import { RUTE } from "@/lib/tautan";
import styles from "./Simulasi.module.css";

export interface BarisAndaian {
  id: string;
  nama: string;
  rw: number;
  biaya: number;
  urgensi: number;
  /** "Dengan urgensi 8, ... berada di peringkat 4 dari 8: Terbiayai." */
  kalimat: string;
}

interface Props {
  /** Usulan forum yang belum ditambahkan. */
  tersedia: readonly UsulanForum[];
  ditambah: readonly BarisAndaian[];
  /** true bila total usulan sudah 16: tombol tambah diganti penjelasan. */
  penuh: boolean;
  /** Nilai urgensi awal pada pilihan (5, sama dengan yang dibawa tautan dari forum). */
  urgensiAwal: number;
  onTambah: (id: string, urgensi: number) => void;
  onUbahUrgensi: (id: string, urgensi: number) => void;
  onLepas: (id: string) => void;
}

const NILAI_URGENSI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function TambahUsulan({ tersedia, ditambah, penuh, urgensiAwal, onTambah, onUbahUrgensi, onLepas }: Props) {
  const id = useId();
  const [pilihan, setPilihan] = useState("");
  const [urgensi, setUrgensi] = useState(urgensiAwal);
  const [galat, setGalat] = useState<string | null>(null);
  const tingkat = rubrikUntuk(urgensi);

  function tambah() {
    if (pilihan === "") {
      setGalat("Pilih satu usulan dulu.");
      return;
    }
    setGalat(null);
    onTambah(pilihan, urgensi);
    setPilihan("");
  }

  return (
    <div className={styles.tambah}>
      <p className={styles.paragrafIsi}>
        Usulan yang masih dibahas di forum belum ikut dihitung. Tambahkan satu untuk melihat posisinya kalau ia masuk
        hitungan, dengan urgensi yang Anda andaikan. Nilai urgensi sungguhan tetap dinilai admin.
      </p>

      {penuh ? (
        <p className={styles.penjelasan} role="note">
          {ditambah.length === 0
            ? "Hitungan anggaran sudah berisi 16 usulan, batas pencarian kombinasi terbaik, jadi tidak ada yang bisa ditambahkan."
            : "Sudah ada 16 usulan dalam hitungan, batas pencarian kombinasi terbaik. Lepas satu usulan andaian bila ingin menggantinya dengan yang lain."}
        </p>
      ) : tersedia.length === 0 ? (
        <p className={styles.penjelasan} role="note">
          Tidak ada usulan forum lain yang bisa ditambahkan. <Link href={RUTE.forum}>Lihat forum warga</Link>.
        </p>
      ) : (
        <div className={styles.formTambah}>
          <div className={styles.kolomIsian}>
            <label htmlFor={`${id}-usulan`}>Usulan dari forum</label>
            <select
              id={`${id}-usulan`}
              value={pilihan}
              onChange={(e) => {
                setPilihan(e.target.value);
                setGalat(null);
              }}
              aria-invalid={galat ? true : undefined}
              aria-describedby={galat ? `${id}-galat` : undefined}
            >
              <option value="">Pilih usulan…</option>
              {tersedia.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.namaSingkat} · {labelRw(f.rw)} · {rupiah(f.estimatedBudget)}
                </option>
              ))}
            </select>
            {galat && (
              <p id={`${id}-galat`} className={styles.galatKolom}>
                {galat}
              </p>
            )}
          </div>

          <fieldset className={styles.urgensi}>
            <legend>Urgensi yang Anda andaikan</legend>
            <div className={styles.angkaUrgensi}>
              {NILAI_URGENSI.map((n) => (
                <label key={n} className={styles.pilihUrgensi}>
                  <input type="radio" name={`${id}-urgensi`} value={n} checked={urgensi === n} onChange={() => setUrgensi(n)} />
                  <span>{n}</span>
                </label>
              ))}
            </div>
            <ul className={styles.rubrik} aria-label="Arti tiap tingkat urgensi">
              {RUBRIK_URGENSI.map((t) => (
                <li key={t.dari} data-aktif={tingkat?.dari === t.dari}>
                  <span className={styles.rentangRubrik}>{label(t)}</span>
                  <span>
                    {t.ringkas}
                    <small>{t.jelas}</small>
                  </span>
                </li>
              ))}
            </ul>
          </fieldset>

          <div>
            <button type="button" className="tombol tombol-utama" onClick={tambah}>
              Tambahkan ke simulasi
            </button>
          </div>
        </div>
      )}

      {ditambah.length > 0 && (
        <ul className={styles.daftarAndaian} aria-label="Usulan forum yang ditambahkan ke simulasi">
          {ditambah.map((a) => (
            <li key={a.id} className={styles.andaianBaris}>
              <div className={styles.andaianKepala}>
                <span className={styles.namaAndaian}>
                  {a.nama} <span className={styles.andaian}>andaian</span>
                </span>
                <span className={styles.metaAndaian}>
                  {labelRw(a.rw)} · {rupiah(a.biaya)}
                </span>
              </div>
              <div className={styles.andaianAksi}>
                <label htmlFor={`${id}-u-${a.id}`} className={styles.labelKecil}>
                  Urgensi andaian
                </label>
                <select id={`${id}-u-${a.id}`} value={a.urgensi} onChange={(e) => onUbahUrgensi(a.id, Number(e.target.value))}>
                  {NILAI_URGENSI.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button type="button" className="tombol tombol-kedua" onClick={() => onLepas(a.id)}>
                  <span className="sr-only">Lepas {a.nama} dari simulasi</span>
                  <span aria-hidden="true">Lepas</span>
                </button>
              </div>
              <p className={styles.kalimatAndaian}>{a.kalimat}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
