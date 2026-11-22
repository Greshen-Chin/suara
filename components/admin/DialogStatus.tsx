"use client";

import { pindahkanStatus } from "@/app/admin/aksi";
import { DialogAlasan } from "@/components/ui/DialogAlasan";
import { STATUS_AKSI_AWAL } from "@/lib/admin-status";
import { BATAS } from "@/lib/usulan-skema";
import { PratinjauDampak } from "./PratinjauDampak";

interface Props {
  id: string;
  statusDibaca: string;
  /** Judul usulan, untuk pembaca layar. */
  judul: string;
}

/** forum -> rejected. Wajib alasan; usulan tetap bisa dibaca warga. */
export function DialogTidakDilanjutkan({ id, statusDibaca, judul }: Props) {
  return (
    <DialogAlasan
      aksi={pindahkanStatus}
      awal={STATUS_AKSI_AWAL}
      tersembunyi={{ id, ke: "rejected", statusDibaca }}
      teksTombol="Tidak dilanjutkan"
      tentang={judul}
      judul="Tidak melanjutkan usulan ini?"
      penjelasan={
        <>
          <p>
            Usulan tidak ikut hitungan anggaran. Usulan tetap bisa dibaca warga, dan alasan Anda tampil di riwayat usulan
            dan di halaman utama.
          </p>
        </>
      }
      bantuAlasan={
        <>
          Tulis {BATAS.alasan.min} sampai {BATAS.alasan.maks} karakter. Warga akan membacanya, jadi sebut apa yang menghalangi usulan ini.
        </>
      }
      teksKirim="Tidak dilanjutkan"
      teksSibuk="Menyimpan…"
    />
  );
}

/** voting -> forum. Wajib alasan; pratinjau dampak tampil selama dialog terbuka. */
export function DialogKembalikan({ id, statusDibaca, judul }: Props) {
  return (
    <DialogAlasan
      aksi={pindahkanStatus}
      awal={STATUS_AKSI_AWAL}
      tersembunyi={{ id, ke: "forum", statusDibaca }}
      teksTombol="Kembalikan ke pembahasan"
      tentang={judul}
      judul="Kembalikan usulan ke pembahasan?"
      penjelasan={
        <p>
          Usulan tidak lagi dihitung dalam anggaran dan nilai urgensinya dikosongkan. Warga bisa membahasnya lagi di forum.
          Alasan Anda tercatat di riwayat usulan dan di halaman utama.
        </p>
      }
      isi={<PratinjauDampak masukan={{ jenis: "keluar", id }} petunjukDiam="" />}
      bantuAlasan={
        <>
          Tulis {BATAS.alasan.min} sampai {BATAS.alasan.maks} karakter, misalnya “Biaya perlu dihitung ulang bersama ketua RW.”
        </>
      }
      teksKirim="Kembalikan"
      teksSibuk="Mengembalikan…"
    />
  );
}
