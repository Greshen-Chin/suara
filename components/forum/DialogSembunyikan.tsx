"use client";

import { useActionState, useRef, useState } from "react";
import { sembunyikanKonten } from "@/app/forum/aksi";
import { STATUS_SEMBUNYIKAN_AWAL, type StatusSembunyikan } from "@/lib/forum-status";
import { BATAS } from "@/lib/usulan-skema";
import styles from "./Detail.module.css";

interface Props {
  jenis: "usulan" | "komentar";
  id: string;
  idUsulan: string;
  /** Tulisan pada tombol, mis. "Sembunyikan usulan". */
  teksTombol: string;
  /** Pembeda untuk pembaca layar, mis. "komentar dari Gita, RW 07". Menjelaskan tombol mana yang ditekan. */
  tentang: string;
  /**
   * Id elemen yang menerima fokus setelah berhasil. Tombol pemicu hilang dari halaman begitu
   * kontennya tersembunyi, jadi fokus tidak boleh dikembalikan ke sana.
   */
  fokusSetelah: string;
}

function fokusBilaSiap(id: string) {
  const mulai = Date.now();
  const coba = () => {
    const el = document.getElementById(id);
    if (el?.dataset.tersembunyi === "true") {
      el.focus();
    } else if (Date.now() - mulai < 4000) {
      setTimeout(coba, 50);
    }
  };
  coba();
}

/**
 * Dialog moderasi memakai <dialog> asli dengan showModal(): browser sendiri menjebak fokus di
 * dalamnya, membuat sisa halaman tidak bisa dijangkau, menutupnya dengan Esc, dan
 * mengembalikan fokus ke tombol pemicu saat ditutup. Alasan wajib diisi dan akan dibaca semua warga.
 */
export function DialogSembunyikan({ jenis, id, idUsulan, teksTombol, tentang, fokusSetelah }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pemicu = useRef<HTMLButtonElement>(null);
  // Menutup dialog dan memindahkan fokus dilakukan DI DALAM aksi, bukan di useEffect: begitu
  // berhasil, komponen ini ikut dilepas (komentarnya berganti jadi jejak), jadi efek tidak sempat jalan.
  const [status, aksi, menunggu] = useActionState(
    async (sebelum: StatusSembunyikan, form: FormData): Promise<StatusSembunyikan> => {
      const hasil = await sembunyikanKonten(sebelum, form);
      if (hasil.hasil === "berhasil") {
        dialog.current?.close();
        fokusBilaSiap(fokusSetelah);
      }
      return hasil;
    },
    STATUS_SEMBUNYIKAN_AWAL,
  );
  const [alasan, setAlasan] = useState("");
  const idJudul = `dialog-judul-${id}`;
  const idAlasan = `dialog-alasan-${id}`;

  function buka() {
    setAlasan("");
    dialog.current?.showModal();
  }

  function tutup() {
    dialog.current?.close();
    pemicu.current?.focus();
  }

  const galat = status.hasil === "galat" ? status : null;

  return (
    <>
      <button ref={pemicu} type="button" className={`tombol tombol-kedua ${styles.tombolModerasi}`} onClick={buka}>
        {teksTombol}
        <span className="sr-only"> ({tentang})</span>
      </button>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={idJudul}
        onClose={() => setAlasan("")}
        onClick={(e) => {
          // Klik pada latar (di luar kotak isi) menutup dialog.
          if (e.target === e.currentTarget) tutup();
        }}
      >
        <form action={aksi} className={styles.dialogIsi} noValidate>
          <input type="hidden" name="jenis" value={jenis} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="usulan" value={idUsulan} />

          <h2 id={idJudul} className={styles.dialogJudul}>
            {jenis === "usulan" ? "Sembunyikan usulan ini?" : "Sembunyikan komentar ini?"}
          </h2>
          <p>
            {jenis === "usulan"
              ? "Usulan tidak akan tampil di daftar dan tidak ikut dihitung dalam anggaran."
              : "Isi komentar tidak akan tampil."}{" "}
            Alasan Anda tercatat di jejak keputusan dan bisa dibaca semua warga.
          </p>

          <div className={styles.kolom}>
            <label htmlFor={idAlasan}>Alasan</label>
            <textarea
              id={idAlasan}
              name="alasan"
              rows={4}
              required
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              aria-invalid={galat?.galatAlasan ? true : undefined}
              aria-describedby={`${idAlasan}-bantu${galat?.galatAlasan ? ` ${idAlasan}-galat` : ""}`}
            />
            <p id={`${idAlasan}-bantu`} className={styles.bantu}>
              Tulis {BATAS.alasan.min} sampai {BATAS.alasan.maks} karakter, misalnya “Berisi tautan promosi yang tidak berkaitan.”
            </p>
            {galat?.galatAlasan && (
              <p id={`${idAlasan}-galat`} className={styles.galatKolom}>
                {galat.galatAlasan}
              </p>
            )}
          </div>

          {galat && !galat.galatAlasan && (
            <p role="alert" className={styles.galatUmum}>
              {galat.pesan}
            </p>
          )}

          <div className={styles.dialogTombol}>
            <button type="button" className="tombol tombol-kedua" onClick={tutup}>
              Batal
            </button>
            <button
              type="submit"
              className="tombol tombol-utama"
              aria-disabled={menunggu || undefined}
              onClick={(e) => {
                if (menunggu) e.preventDefault();
              }}
            >
              {menunggu ? "Menyembunyikan…" : "Sembunyikan"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
