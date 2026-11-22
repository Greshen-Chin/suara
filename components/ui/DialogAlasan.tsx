"use client";

import { useActionState, useId, useRef, useState, type ReactNode } from "react";
import type { StatusAlasan } from "@/lib/forum-status";
import { BATAS, panjang } from "@/lib/usulan-skema";
import styles from "./DialogAlasan.module.css";

interface Props<S extends StatusAlasan> {
  /** Server Action. Mengembalikan keadaan baru; hasil "berhasil" menutup dialog. */
  aksi: (sebelum: S, form: FormData) => Promise<S>;
  awal: S;
  /** Nilai tetap yang ikut terkirim bersama formulir (jenis, id, ...), sebagai input tersembunyi. */
  tersembunyi: Record<string, string>;
  teksTombol: string;
  /** Pembeda untuk pembaca layar, mis. "komentar dari Gita, RW 07": menjelaskan tombol mana yang ditekan. */
  tentang?: string;
  /** Kelas tombol pemicu; bawaan tombol berbingkai. */
  kelasTombol?: string;
  judul: string;
  penjelasan: ReactNode;
  teksKirim: string;
  teksSibuk: string;
  /** Aksi berisiko (mis. nonaktifkan akun): tombol kirim memakai warna galat. */
  berisiko?: boolean;
  /** false: dialog konfirmasi tanpa kolom alasan (aksi akun). Fokus awal ke "Batal". */
  perluAlasan?: boolean;
  labelAlasan?: string;
  bantuAlasan?: ReactNode;
  /** Dirender di atas kolom alasan, hanya selama dialog terbuka (mis. pratinjau dampak). */
  isi?: ReactNode;
  /** Dipanggil di dalam aksi saat berhasil, mis. mengarahkan ke daftar dengan pesan konfirmasi. */
  setelahBerhasil?: (hasil: S) => void;
  /**
   * Mengganti isi dialog setelah berhasil (mis. layar kata sandi yang tampil sekali); dialog tetap
   * terbuka sampai pengguna menutupnya, dan keadaannya dibuang saat ditutup. `idJudul` HARUS dipasang
   * pada judul tampilan itu: dialog bernama lewat aria-labelledby ke id tersebut, dan tanpa judul
   * ber-id dialognya kehilangan nama.
   */
  tampilanBerhasil?: (hasil: S, tutup: () => void, idJudul: string) => ReactNode;
}

/**
 * Dialog alasan bersama forum dan admin. `<dialog>` asli dengan showModal(): browser sendiri menjebak
 * fokus di dalamnya, membuat sisa halaman tidak bisa dijangkau, menutupnya dengan Esc, dan
 * mengembalikan fokus ke tombol pemicu saat ditutup. Fokus awal ke kolom alasan (atau ke "Batal"
 * bila tanpa alasan, supaya Enter tidak langsung menjalankan aksi berisiko).
 *
 * Isi formulir dipasang ulang (key) setiap dialog ditutup: tidak ada keadaan, apalagi kata sandi,
 * yang tersisa untuk pembukaan berikutnya.
 */
export function DialogAlasan<S extends StatusAlasan>(props: Props<S>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pemicu = useRef<HTMLButtonElement>(null);
  const [terbuka, setTerbuka] = useState(false);
  const [kunci, setKunci] = useState(0);
  const idJudul = useId();

  function buka() {
    setTerbuka(true);
    dialog.current?.showModal();
    // Dua frame: isi dialog baru terpasang setelah render berikutnya.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("[data-fokus-awal]")?.focus()),
    );
  }

  function tutup() {
    dialog.current?.close();
    pemicu.current?.focus();
  }

  return (
    <>
      <button ref={pemicu} type="button" className={props.kelasTombol ?? `tombol tombol-kedua ${styles.pemicu}`} onClick={buka}>
        {props.teksTombol}
        {props.tentang && <span className="sr-only"> ({props.tentang})</span>}
      </button>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={idJudul}
        onClose={() => {
          setTerbuka(false);
          setKunci((k) => k + 1);
        }}
        onClick={(e) => {
          // Klik pada latar (di luar kotak isi) menutup dialog.
          if (e.target === e.currentTarget) tutup();
        }}
      >
        <IsiDialog key={kunci} {...props} idJudul={idJudul} terbuka={terbuka} tutup={tutup} dialog={dialog} />
      </dialog>
    </>
  );
}

function IsiDialog<S extends StatusAlasan>({
  aksi,
  awal,
  tersembunyi,
  judul,
  penjelasan,
  teksKirim,
  teksSibuk,
  berisiko,
  perluAlasan = true,
  labelAlasan = "Alasan",
  bantuAlasan,
  isi,
  setelahBerhasil,
  tampilanBerhasil,
  idJudul,
  terbuka,
  tutup,
  dialog,
}: Props<S> & {
  idJudul: string;
  terbuka: boolean;
  tutup: () => void;
  dialog: React.RefObject<HTMLDialogElement | null>;
}) {
  const [alasan, setAlasan] = useState("");
  const idAlasan = useId();

  // Menutup dialog dilakukan DI DALAM aksi, bukan di useEffect: begitu berhasil, pemanggil bisa
  // saja melepas komponen ini (baris berubah, halaman berganti), jadi efek tidak sempat jalan.
  // Di dalam, keadaan diperlakukan sebagai StatusAlasan (bentuk minimal yang dipakai dialog); tipe S
  // dari pemanggil dipulihkan di pintu keluar (tampilanBerhasil, setelahBerhasil).
  const jalankan = aksi as unknown as (sebelum: StatusAlasan, form: FormData) => Promise<StatusAlasan>;
  const [status, kirim, menunggu] = useActionState(async (sebelum: StatusAlasan, form: FormData): Promise<StatusAlasan> => {
    const hasil = await jalankan(sebelum, form);
    if (hasil.hasil === "berhasil") {
      if (!tampilanBerhasil) dialog.current?.close();
      setelahBerhasil?.(hasil as S);
    }
    return hasil;
  }, awal as StatusAlasan);

  if (status.hasil === "berhasil" && tampilanBerhasil) {
    return <div className={styles.isi}>{tampilanBerhasil(status as S, tutup, idJudul)}</div>;
  }

  const galat = status.hasil === "galat" ? status : null;
  const lebih = panjang(alasan) > BATAS.alasan.maks;

  return (
    <form action={kirim} className={styles.isi} noValidate>
      {Object.entries(tersembunyi).map(([nama, nilai]) => (
        <input key={nama} type="hidden" name={nama} value={nilai} />
      ))}

      <h2 id={idJudul} className={styles.judul}>
        {judul}
      </h2>
      <div className={styles.penjelasan}>{penjelasan}</div>

      {terbuka && isi}

      {perluAlasan && (
        <div className={styles.kolom}>
          <label htmlFor={idAlasan}>{labelAlasan}</label>
          <textarea
            id={idAlasan}
            name="alasan"
            rows={4}
            required
            data-fokus-awal
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            aria-invalid={galat?.galatAlasan ? true : undefined}
            aria-describedby={`${idAlasan}-bantu${galat?.galatAlasan ? ` ${idAlasan}-galat` : ""}`}
          />
          <div className={styles.bantuBaris}>
            <p id={`${idAlasan}-bantu`} className={styles.bantu}>
              {bantuAlasan ?? `Tulis ${BATAS.alasan.min} sampai ${BATAS.alasan.maks} karakter.`}
            </p>
            <span className={lebih ? `${styles.hitung} ${styles.hitungLebih}` : styles.hitung} aria-hidden="true">
              {panjang(alasan)} / {BATAS.alasan.maks}
            </span>
          </div>
          {galat?.galatAlasan && (
            <p id={`${idAlasan}-galat`} className={styles.galatKolom}>
              {galat.galatAlasan}
            </p>
          )}
        </div>
      )}

      {galat && !galat.galatAlasan && (
        <p role="alert" className={styles.galatUmum}>
          {galat.pesan}
        </p>
      )}

      <div className={styles.baris}>
        <button type="button" className="tombol tombol-kedua" onClick={tutup} data-fokus-awal={perluAlasan ? undefined : ""}>
          Batal
        </button>
        <button
          type="submit"
          className={berisiko ? `tombol ${styles.berisiko}` : "tombol tombol-utama"}
          aria-disabled={menunggu || undefined}
          onClick={(e) => {
            if (menunggu) e.preventDefault();
          }}
        >
          {menunggu ? teksSibuk : teksKirim}
        </button>
      </div>
    </form>
  );
}
