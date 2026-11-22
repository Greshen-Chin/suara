"use client";

import { aturAktif, aturUlangSandi } from "@/app/admin/aksi";
import { DialogAlasan } from "@/components/ui/DialogAlasan";
import { STATUS_AKSI_AWAL } from "@/lib/admin-status";
import { LayarSandi } from "./LayarSandi";

/**
 * Atur ulang kata sandi: dialog konfirmasi tanpa alasan (perubahan akun masuk jejak admin tertutup,
 * bukan jejak publik). Hasilnya, kata sandi baru, tampil sekali di dalam dialog yang sama.
 */
export function DialogAturUlangSandi({ id, nama }: { id: string; nama: string }) {
  return (
    <DialogAlasan
      aksi={aturUlangSandi}
      awal={STATUS_AKSI_AWAL}
      tersembunyi={{ id }}
      teksTombol="Atur ulang kata sandi"
      tentang={nama}
      perluAlasan={false}
      judul="Atur ulang kata sandi?"
      penjelasan={
        <>
          <p>
            <strong>{nama}</strong> akan keluar dari semua perangkat dan harus masuk dengan kata sandi baru.
          </p>
          <p>Kata sandi baru dibuat sekarang dan tampil sekali. Serahkan langsung ke warga; ia diminta menggantinya saat masuk.</p>
        </>
      }
      teksKirim="Atur ulang"
      teksSibuk="Mengatur ulang…"
      tampilanBerhasil={(hasil, tutup, idJudul) =>
        hasil.rahasia ? (
          <LayarSandi
            idJudul={idJudul}
            namaPengguna={hasil.rahasia.namaPengguna}
            kataSandi={hasil.rahasia.kataSandi}
            judul="Kata sandi diatur ulang."
            selesai={{ teks: "Selesai", aksi: tutup }}
          />
        ) : null
      }
    />
  );
}

/** Nonaktifkan atau aktifkan kembali. Menonaktifkan berisiko: tombolnya memakai warna galat, fokus awal di "Batal". */
export function DialogAturAktif({ id, nama, aktif }: { id: string; nama: string; aktif: boolean }) {
  return (
    <DialogAlasan
      aksi={aturAktif}
      awal={STATUS_AKSI_AWAL}
      tersembunyi={{ id, aktif: String(!aktif) }}
      teksTombol={aktif ? "Nonaktifkan" : "Aktifkan kembali"}
      tentang={nama}
      kelasTombol={aktif ? "tombol tombol-kedua" : "tombol tombol-kedua"}
      perluAlasan={false}
      berisiko={aktif}
      judul={aktif ? `Nonaktifkan akun ${nama}?` : `Aktifkan kembali akun ${nama}?`}
      penjelasan={
        aktif ? (
          <>
            <p>Pemilik akun akan keluar dari semua perangkat dan tidak bisa masuk sampai Anda mengaktifkannya kembali.</p>
            <p>Dukungan dan komentar yang sudah ada tetap tersimpan dan tetap tampil.</p>
          </>
        ) : (
          <p>Pemilik akun bisa masuk lagi dengan kata sandinya yang sekarang. Kalau ia lupa, atur ulang kata sandinya.</p>
        )
      }
      teksKirim={aktif ? "Nonaktifkan akun" : "Aktifkan kembali"}
      teksSibuk="Menyimpan…"
    />
  );
}
