// Kata untuk status siklus usulan. Murni, supaya komponen StatusSiklus dan unduhan CSV memakai kata yang sama.

/** Siklus usulan: forum -> voting -> approved / referred / rejected -> done (approved dan referred). */
export const TEKS_SIKLUS: Record<string, string> = {
  forum: "Sedang dibahas",
  voting: "Masuk hitungan anggaran",
  approved: "Disetujui",
  rejected: "Ditolak",
  referred: "Diajukan ke dana lain",
  done: "Selesai",
};

/** Kata untuk status yang tidak dikenal: status mentah tidak pernah sampai ke layar sebagai "undefined". */
export const teksSiklus = (status: string | null | undefined): string => (status ? (TEKS_SIKLUS[status] ?? "Status tidak dikenal") : "");
