// Perpindahan status usulan yang tersedia di halaman admin. Penentu sebenarnya adalah fungsi SQL
// pindahkan_status (supabase/migrations/0005_admin.sql); ini hanya untuk menentukan tombol apa
// yang ditampilkan dan menolak lebih awal.
//
// Yang SENGAJA tidak ada: voting -> approved/referred/rejected dan approved/referred -> done. Itu penetapan
// hasil musyawarah dan penandaan selesai, di halaman Keputusan (/admin/keputusan), karena butuh periode anggaran.

export type StatusTujuan = "voting" | "forum" | "rejected";

const TRANSISI: Readonly<Record<string, readonly StatusTujuan[]>> = {
  forum: ["voting", "rejected"],
  voting: ["forum"],
};

/** Tujuan yang boleh dari status ini; kosong bila tidak ada yang tersedia di halaman admin. */
export function transisiTersedia(dari: string): readonly StatusTujuan[] {
  return TRANSISI[dari] ?? [];
}

export function bolehPindah(dari: string, ke: string): ke is StatusTujuan {
  return transisiTersedia(dari).includes(ke as StatusTujuan);
}

export function adalahStatusTujuan(nilai: unknown): nilai is StatusTujuan {
  return nilai === "voting" || nilai === "forum" || nilai === "rejected";
}

export const LABEL_TRANSISI: Record<StatusTujuan, string> = {
  voting: "Masukkan ke hitungan anggaran",
  rejected: "Tidak dilanjutkan",
  forum: "Kembalikan ke pembahasan",
};

/** Mengapa tidak ada tombol untuk status ini. Dipakai bila transisiTersedia kosong. */
export function keteranganTanpaAksi(status: string, tersembunyi: boolean): string {
  if (tersembunyi) {
    return "Usulan ini disembunyikan, jadi statusnya tidak bisa diubah. Tampilkan kembali dulu di Moderasi.";
  }
  switch (status) {
    case "rejected":
      return "Usulan ini sudah tidak dilanjutkan. Alasannya tercatat di riwayat usulan.";
    case "approved":
    case "referred":
      return "Usulan ini sudah diputuskan musyawarah. Menandainya selesai dikerjakan dilakukan di halaman Keputusan.";
    case "done":
      return "Usulan ini sudah diputuskan musyawarah dan sudah selesai dikerjakan.";
    default:
      return "Tidak ada perpindahan status yang tersedia untuk usulan ini.";
  }
}

/** Status siklus yang sama dengan StatusSiklus, tetapi "rejected" tanpa urgensi dibaca "Tidak dilanjutkan". */
export function teksStatusAdmin(status: string, urgensi: number | null): string | undefined {
  return status === "rejected" && urgensi === null ? "Tidak dilanjutkan" : undefined;
}
