// Pemeriksaan akses halaman dan aksi admin. Hanya untuk server.
//
// Dua pintu, dengan perilaku berbeda atas alasan yang sama dengan lib/auth.ts:
//   periksaAkses : untuk halaman (server component). Belum masuk -> diarahkan ke /masuk (proxy.ts
//                  sudah melakukannya lebih awal untuk navigasi). Sudah masuk tetapi bukan admin ->
//                  dikembalikan, supaya halaman menampilkan "khusus admin desa", bukan redirect diam-diam.
//   sesiAdmin    : untuk Server Action. TIDAK redirect: sesi habis atau peran salah dikembalikan sebagai
//                  galat yang bisa ditampilkan, karena redirect mematahkan klien dan menghilangkan isian.
import "server-only";
import { ambilPengguna, wajibMasuk, type Pengguna } from "./auth";

export type Akses = { status: "admin"; pengguna: Pengguna } | { status: "bukan-admin"; pengguna: Pengguna };

export async function periksaAkses(): Promise<Akses> {
  const pengguna = await wajibMasuk();
  return pengguna.peran === "admin" ? { status: "admin", pengguna } : { status: "bukan-admin", pengguna };
}

export type SesiAdmin =
  | { ok: true; pengguna: Pengguna }
  | { ok: false; kode: "belum_masuk" | "bukan_admin" | "gangguan" };

export async function sesiAdmin(): Promise<SesiAdmin> {
  let pengguna: Pengguna | null;
  try {
    pengguna = await ambilPengguna();
  } catch (err) {
    console.error("Gagal membaca sesi:", err instanceof Error ? err.message : err);
    return { ok: false, kode: "gangguan" };
  }
  if (!pengguna) return { ok: false, kode: "belum_masuk" };
  // Fungsi SQL memeriksa ulang bahwa akun ini admin aktif; ini hanya memberi jawaban lebih cepat.
  if (pengguna.peran !== "admin") return { ok: false, kode: "bukan_admin" };
  return { ok: true, pengguna };
}
