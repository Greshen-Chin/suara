"use server";

// Server Action untuk saran urgensi dari AI. Dipanggil dari komponen klien (bukan lewat <form>), jadi
// mengembalikan hasil bertipe, seperti cekNamaPengguna di app/admin/aksi.ts. TIDAK mengubah apa pun yang
// tampil ke publik: saran hanya tersimpan sebagai bahan, dan baru "dibuka" saat admin memasukkan usulan.
//
// Tiap panggilan memeriksa sendiri: sesi admin, id sah, dan bahwa admin sudah memilih nilainya (nilai itu tidak
// dipakai di sini selain sebagai bukti bahwa pilihan datang lebih dulu). Fungsi SQL memeriksa admin dan batas lagi.
import { sesiAdmin } from "@/lib/admin-akses";
import { galatSaran, mintaSaran, saranAktif } from "@/lib/saran-urgensi-server";
import type { HasilSaranUi } from "@/lib/saran-urgensi-tipe";
import { adalahUuid } from "@/lib/usulan-skema";

export async function mintaSaranUrgensi(idUsulan: string, nilaiPilihan: number): Promise<HasilSaranUi> {
  if (!saranAktif()) return galatSaran("nonaktif");
  if (typeof idUsulan !== "string" || !adalahUuid(idUsulan)) return galatSaran("tidak_berlaku");
  // Admin harus memilih nilainya sendiri lebih dulu (ditegakkan di sini dan di tombol).
  if (!Number.isInteger(nilaiPilihan) || nilaiPilihan < 1 || nilaiPilihan > 10) return galatSaran("urgensi_kosong");

  const sesi = await sesiAdmin();
  if (!sesi.ok) return { ...galatSaran(sesi.kode === "belum_masuk" ? "belum_masuk" : sesi.kode === "bukan_admin" ? "bukan_admin" : "gangguan"), perluMasuk: sesi.kode === "belum_masuk" };

  try {
    return await mintaSaran(sesi.pengguna.id, idUsulan);
  } catch (err) {
    console.error("Permintaan saran gagal:", err instanceof Error ? err.name : "tidak diketahui");
    return galatSaran("gangguan");
  }
}
