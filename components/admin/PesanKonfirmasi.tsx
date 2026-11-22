import Link from "next/link";
import { susunPesanBerhasil, type Berhasil } from "@/lib/admin-pesan";
import { RUTE } from "@/lib/tautan";
import { PesanBerhasil } from "./PesanBerhasil";

/** Kode yang `id`-nya adalah id usulan, jadi riwayat usulan bisa ditautkan langsung. */
const ID_USULAN = new Set(["voting", "tidak-dilanjutkan", "kembali"]);

/**
 * Konfirmasi setelah aksi berhasil, dengan kalimat yang menyebut DI MANA jejaknya bisa dilihat, dan
 * tautan ke halaman publik yang terdampak: "Tersimpan. Jejaknya tampil di halaman utama dan di riwayat usulan."
 * Perubahan akun tidak menyebut jejak publik: catatannya tertutup (hanya terlihat admin).
 */
export function PesanKonfirmasi({ berhasil, nama }: { berhasil: Berhasil; nama: string | null }) {
  const p = susunPesanBerhasil(berhasil, nama);
  return (
    <PesanBerhasil>
      <strong>{p.ringkas}</strong>
      {p.jejak ? (
        <p>
          Tersimpan. Jejaknya tampil di <Link href={RUTE.beranda}>halaman utama</Link> dan di{" "}
          {ID_USULAN.has(berhasil.kode) ? (
            <Link href={`${RUTE.forum}/${berhasil.id}`}>riwayat usulan</Link>
          ) : (
            "riwayat usulan yang bersangkutan"
          )}
          .
        </p>
      ) : (
        <p>Tersimpan. Perubahan ini tercatat di jejak admin untuk akun ini, yang hanya terlihat oleh admin.</p>
      )}
    </PesanBerhasil>
  );
}
