"use client";

import { tampilkanKembali } from "@/app/admin/aksi";
import { DialogAlasan } from "@/components/ui/DialogAlasan";
import { STATUS_AKSI_AWAL } from "@/lib/admin-status";
import { BATAS } from "@/lib/usulan-skema";

interface Props {
  jenis: "usulan" | "komentar";
  id: string;
  /** Id usulan terkait: dipakai untuk menyegarkan halamannya. Untuk usulan, sama dengan `id`. */
  idUsulan: string;
  /** Usulan voting yang ditampilkan kembali akan dihitung lagi dalam anggaran. */
  voting?: boolean;
  /** Pembeda untuk pembaca layar. */
  tentang: string;
}

/** Kebalikan "Sembunyikan": alasan wajib, tercatat di jejak keputusan publik sebagai moderasi. */
export function DialogTampilkan({ jenis, id, idUsulan, voting = false, tentang }: Props) {
  return (
    <DialogAlasan
      aksi={tampilkanKembali}
      awal={STATUS_AKSI_AWAL}
      tersembunyi={{ jenis, id, usulan: idUsulan }}
      teksTombol="Tampilkan kembali"
      tentang={tentang}
      judul={jenis === "usulan" ? "Tampilkan kembali usulan ini?" : "Tampilkan kembali komentar ini?"}
      penjelasan={
        <p>
          {jenis === "usulan"
            ? "Usulan tampil lagi di daftar forum."
            : "Isi komentar tampil lagi untuk semua warga."}{" "}
          {voting && "Usulan ini juga kembali dihitung dalam anggaran. "}
          Alasan Anda tercatat di jejak keputusan dan bisa dibaca semua warga.
        </p>
      }
      bantuAlasan={
        <>
          Tulis {BATAS.alasan.min} sampai {BATAS.alasan.maks} karakter, misalnya “Setelah dibaca ulang, tidak melanggar aturan.”
        </>
      }
      teksKirim="Tampilkan kembali"
      teksSibuk="Menampilkan…"
    />
  );
}
