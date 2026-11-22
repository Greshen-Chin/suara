"use client";

import { useRouter } from "next/navigation";
import { sembunyikanKonten } from "@/app/forum/aksi";
import { DialogAlasan } from "@/components/ui/DialogAlasan";
import { urlBerhasil } from "@/lib/admin-pesan";
import { STATUS_SEMBUNYIKAN_AWAL } from "@/lib/forum-status";
import { BATAS } from "@/lib/usulan-skema";

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
  fokusSetelah?: string;
  /**
   * Halaman admin: alih-alih memindahkan fokus, kembali ke daftar ini dengan pesan konfirmasi
   * (mis. "/admin/moderasi").
   */
  daftarSetelah?: string;
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
 * Moderasi forum: menyembunyikan usulan atau komentar dengan alasan wajib yang akan dibaca semua
 * warga. Dialognya dialog alasan bersama (components/ui/DialogAlasan.tsx), dipakai juga halaman admin.
 */
export function DialogSembunyikan({ jenis, id, idUsulan, teksTombol, tentang, fokusSetelah, daftarSetelah }: Props) {
  const router = useRouter();
  return (
    <DialogAlasan
      aksi={sembunyikanKonten}
      awal={STATUS_SEMBUNYIKAN_AWAL}
      tersembunyi={{ jenis, id, usulan: idUsulan }}
      teksTombol={teksTombol}
      tentang={tentang}
      judul={jenis === "usulan" ? "Sembunyikan usulan ini?" : "Sembunyikan komentar ini?"}
      penjelasan={
        <p>
          {jenis === "usulan"
            ? "Usulan tidak akan tampil di daftar dan tidak ikut dihitung dalam anggaran."
            : "Isi komentar tidak akan tampil."}{" "}
          Alasan Anda tercatat di jejak keputusan dan bisa dibaca semua warga.
        </p>
      }
      bantuAlasan={
        <>
          Tulis {BATAS.alasan.min} sampai {BATAS.alasan.maks} karakter, misalnya “Berisi tautan promosi yang tidak berkaitan.”
        </>
      }
      teksKirim="Sembunyikan"
      teksSibuk="Menyembunyikan…"
      setelahBerhasil={() => {
        // Tombol pemicu hilang begitu kontennya tersembunyi, jadi fokus berpindah ke tempat yang masih ada.
        if (daftarSetelah) router.replace(urlBerhasil(daftarSetelah, "sembunyi", id));
        else if (fokusSetelah) fokusBilaSiap(fokusSetelah);
      }}
    />
  );
}
