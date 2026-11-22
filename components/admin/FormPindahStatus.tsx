"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { pindahkanStatus } from "@/app/admin/aksi";
import { BATAS_ADMIN, periksaNamaSingkat, periksaUrgensi } from "@/lib/admin-skema";
import { STATUS_AKSI_AWAL } from "@/lib/admin-status";
import { RUBRIK_URGENSI, label, rubrikUntuk } from "@/lib/urgensi";
import { BATAS } from "@/lib/usulan-skema";
import { KolomAlasan, RingkasGalat, type GalatBertaut } from "./Isian";
import { PratinjauDampak } from "./PratinjauDampak";
import styles from "./Admin.module.css";

interface Props {
  id: string;
  /** Status yang dibaca halaman; fungsi SQL menolak bila sudah berubah (admin lain lebih dulu). */
  statusDibaca: string;
  /** Nama singkat yang sudah ada pada usulan; admin bisa mengubahnya. */
  namaSingkatAwal: string;
  /**
   * Tempat saran urgensi dari AI, nanti. Saat ini TIDAK dirender sama sekali (tanpa label, tanpa
   * "segera hadir"): fiturnya belum berjalan, dan klaim di antarmuka hanya boleh ada bila fiturnya
   * benar-benar ada. Diletakkan sebagai baris pertama di dalam kelompok urgensi, jadi saran bisa
   * ditambahkan tanpa mengubah tata letak. Admin tetap yang memutuskan: saran hanya bahan.
   */
  saranUrgensi?: ReactNode;
}

/** "Masukkan ke hitungan anggaran": urgensi 1-10 dengan alasan tertulis, nama singkat, dan pratinjau dampak. */
export function FormPindahStatus({ id, statusDibaca, namaSingkatAwal, saranUrgensi }: Props) {
  const [status, aksi, menunggu] = useActionState(pindahkanStatus, STATUS_AKSI_AWAL);
  const [urgensi, setUrgensi] = useState("");
  const [alasan, setAlasan] = useState("");
  const [singkat, setSingkat] = useState(namaSingkatAwal);

  const nilaiUrgensi = periksaUrgensi(urgensi);
  const singkatValid = periksaNamaSingkat(singkat).ok;
  const tingkat = nilaiUrgensi.ok ? rubrikUntuk(nilaiUrgensi.nilai) : null;

  const galatUrgensi = status.galatKolom.urgensi ?? null;
  const galatAlasan = status.galatKolom.alasanUrgensi ?? null;
  const galatSingkat = status.galatKolom.namaSingkat ?? null;
  const galat: GalatBertaut[] = [
    ...(galatUrgensi ? [{ id: "urgensi-1", pesan: galatUrgensi }] : []),
    ...(galatAlasan ? [{ id: "alasan-urgensi", pesan: galatAlasan }] : []),
    ...(galatSingkat ? [{ id: "nama-singkat", pesan: galatSingkat }] : []),
  ];

  return (
    <form action={aksi} className={styles.form} noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ke" value="voting" />
      <input type="hidden" name="statusDibaca" value={statusDibaca} />

      {status.hasil === "galat" && (
        <RingkasGalat pesan={status.pesan} galat={galat}>
          {status.perluMasuk && (
            <p>
              <Link href={`/masuk?lanjut=${encodeURIComponent(`/admin/usulan/${id}`)}`}>Masuk lagi</Link>. Isian Anda tetap di
              layar.
            </p>
          )}
          {status.pesan?.includes("Muat ulang") && (
            <p>
              <Link href={`/admin/usulan/${id}`}>Muat ulang halaman ini</Link>
            </p>
          )}
        </RingkasGalat>
      )}

      {/* key: lihat catatan yang sama di AlurBuatAkun. Setelah galat dari server, tombol radio dipasang ulang
          supaya pilihan urgensi yang terlihat tetap sama dengan yang tersimpan di state (dan dikirim). */}
      <fieldset key={status.nomor} className={styles.urgensi}>
        <legend>Urgensi, 1 sampai 10</legend>
        {saranUrgensi}
        <p className={styles.petunjuk} id="urgensi-bantu">
          Pilih tingkat yang paling cocok, lalu angkanya. Gunakan rubrik yang sama untuk semua usulan.
        </p>
        <div className={styles.urgensiPilihan} aria-describedby="urgensi-bantu">
          {Array.from({ length: BATAS_ADMIN.urgensi.maks }, (_, i) => i + 1).map((n) => (
            <label key={n}>
              <input
                id={`urgensi-${n}`}
                type="radio"
                name="urgensi"
                value={n}
                checked={urgensi === String(n)}
                onChange={() => setUrgensi(String(n))}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <ul className={styles.rubrik} aria-label="Rubrik urgensi">
          {RUBRIK_URGENSI.map((t) => (
            <li key={t.dari} className={tingkat?.dari === t.dari ? styles.aktifRubrik : undefined}>
              <span className={styles.rentang}>{label(t)}</span>
              <span>
                {t.ringkas}
                <small>{t.jelas}</small>
              </span>
            </li>
          ))}
        </ul>
        {galatUrgensi && <p className={styles.galatKolom}>{galatUrgensi}</p>}
      </fieldset>

      <KolomAlasan
        id="alasan-urgensi"
        nama="alasanUrgensi"
        label="Alasan urgensi"
        bantu={`Tulis ${BATAS_ADMIN.alasanUrgensi.min} sampai ${BATAS_ADMIN.alasanUrgensi.maks} karakter: kenapa nilainya segitu. Alasan ini tampil di halaman usulan dan di jejak keputusan, dan bisa dibaca semua warga.`}
        nilai={alasan}
        onUbah={setAlasan}
        maks={BATAS_ADMIN.alasanUrgensi.maks}
        galat={galatAlasan}
      />

      <div className={styles.kolom}>
        <label htmlFor="nama-singkat">Nama singkat (label di batang anggaran)</label>
        <input
          id="nama-singkat"
          name="namaSingkat"
          type="text"
          autoComplete="off"
          maxLength={BATAS.namaSingkat.maks * 2}
          value={singkat}
          onChange={(e) => setSingkat(e.target.value)}
          aria-invalid={galatSingkat ? true : undefined}
          aria-describedby={`nama-singkat-bantu${galatSingkat ? " nama-singkat-galat" : ""}`}
        />
        <p id="nama-singkat-bantu" className={styles.petunjuk}>
          {BATAS.namaSingkat.min} sampai {BATAS.namaSingkat.maks} karakter, misalnya “Lampu PJU”. Kosongkan untuk memakai judul usulan.
        </p>
        {galatSingkat && (
          <p id="nama-singkat-galat" className={styles.galatKolom}>
            {galatSingkat}
          </p>
        )}
      </div>

      <PratinjauDampak
        masukan={nilaiUrgensi.ok && singkatValid ? { jenis: "masuk", id, urgensi, namaSingkat: singkat } : null}
        petunjukDiam="Pratinjau tampil begitu Anda memilih nilai urgensi."
      />

      <div className={styles.tombolBaris}>
        <button
          type="submit"
          className="tombol tombol-utama"
          aria-disabled={menunggu || undefined}
          onClick={(e) => {
            if (menunggu) e.preventDefault();
          }}
        >
          {menunggu ? "Memasukkan…" : "Masukkan ke hitungan anggaran"}
        </button>
        {menunggu && <span className={styles.sibuk}>Menyimpan dan memperbarui halaman publik…</span>}
      </div>
    </form>
  );
}
