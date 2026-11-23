"use client";

import { useEffect, useState } from "react";
import { batalkanPenetapan, tandaiSelesai } from "@/app/admin/aksi";
import { DialogAlasan } from "@/components/ui/DialogAlasan";
import { STATUS_AKSI_AWAL } from "@/lib/admin-status";
import { BATAS, sisaWaktuBatal, teksSisaWaktu } from "@/lib/keputusan";
import { namaPeriode } from "@/lib/keputusan-kalimat";
import { hapusDraf } from "@/lib/keputusan-draf";
import styles from "./LembarKerja.module.css";
import adm from "./Admin.module.css";

/** Batalkan penetapan terakhir. Alasan wajib dan tercatat di jejak keputusan yang bisa dibaca semua warga. */
export function DialogBatalPenetapan({ tahun }: { tahun: number }) {
  return (
    <DialogAlasan
      aksi={batalkanPenetapan}
      awal={STATUS_AKSI_AWAL}
      tersembunyi={{ tahun: String(tahun) }}
      teksTombol="Batalkan penetapan"
      tentang={namaPeriode(tahun)}
      judul={`Batalkan penetapan ${namaPeriode(tahun)}?`}
      penjelasan={
        <>
          <p>
            Semua usulan dari penetapan ini kembali ke hitungan anggaran, anggaran periode lalu tiap RW dipulihkan ke angka
            sebelum penetapan, dan periode berikutnya ditutup lagi. Catatan penetapan lama tidak dihapus: ia ditandai batal.
          </p>
          <p>Pembatalan dan alasannya tampil di jejak keputusan yang bisa dibaca semua warga.</p>
        </>
      }
      bantuAlasan={
        <>
          Tulis {BATAS.alasanBatal.min} sampai {BATAS.alasanBatal.max} karakter, misalnya “Hasil rapat salah dicatat; rapat ulang
          dijadwalkan.”
        </>
      }
      labelAlasan="Alasan pembatalan"
      teksKirim="Batalkan penetapan"
      teksSibuk="Membatalkan…"
      berisiko
    />
  );
}

function BiayaRealisasi() {
  return (
    <div className={`${adm.kolom} ${styles.kolomDialog}`}>
      <label htmlFor="biaya-realisasi">Biaya realisasi (boleh dikosongkan)</label>
      <input id="biaya-realisasi" name="biayaRealisasi" type="text" inputMode="text" autoComplete="off" />
      <p className={adm.petunjuk}>Jumlah yang benar-benar dikeluarkan, misalnya 83.500.000 atau 83,5 juta.</p>
    </div>
  );
}

/** approved/referred -> done. Catatan wajib; biaya realisasi opsional. */
export function DialogTandaiSelesai({ id, statusDibaca, judul }: { id: string; statusDibaca: string; judul: string }) {
  return (
    <DialogAlasan
      aksi={tandaiSelesai}
      awal={STATUS_AKSI_AWAL}
      tersembunyi={{ id, statusDibaca }}
      teksTombol="Tandai selesai"
      tentang={judul}
      judul="Tandai usulan ini selesai dikerjakan?"
      penjelasan={
        <p>
          Usulan tampil sebagai selesai di forum dan di halaman keputusan, lengkap dengan catatan dan biaya realisasinya. Setelah
          ada usulan yang selesai, penetapan periodenya tidak bisa dibatalkan lagi.
        </p>
      }
      isi={<BiayaRealisasi />}
      labelAlasan="Catatan penyelesaian"
      bantuAlasan={<>Tulis {BATAS.catatanSelesai.min} sampai {BATAS.catatanSelesai.max} karakter: apa yang selesai dan siapa yang memeriksanya.</>}
      teksKirim="Tandai selesai"
      teksSibuk="Menyimpan…"
    />
  );
}

/**
 * Sisa waktu untuk membatalkan. Diperbarui tiap menit dan SENGAJA bukan wilayah live: penghitung yang mengumumkan
 * tiap detik (atau menit) akan mengganggu pembaca layar. Nilai awal dari server supaya hidrasi cocok.
 */
export function SisaWaktuBatal({ diputuskanPada, sekarangAwal }: { diputuskanPada: string; sekarangAwal: string }) {
  const [sekarang, setSekarang] = useState(() => new Date(sekarangAwal));
  useEffect(() => {
    const t = setInterval(() => setSekarang(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return <span>Bisa dibatalkan, {teksSisaWaktu(sisaWaktuBatal(diputuskanPada, sekarang))}.</span>;
}

/** Membuang draf lembar kerja setelah penetapan berhasil (draf hanya hidup di perangkat ini). */
export function HapusDrafSetelahTetap({ tahun }: { tahun: number }) {
  useEffect(() => {
    try {
      hapusDraf(window.localStorage, tahun);
    } catch {
      // Penyimpanan tidak tersedia: tidak ada draf yang perlu dibuang.
    }
  }, [tahun]);
  return null;
}
