// Jenis catatan di jejak keputusan (accountability_logs.log_type) beserta labelnya. Satu tempat
// untuk halaman utama, riwayat usulan, dan riwayat di halaman admin. Murni, tanpa "server-only".

/**
 * 'moderation': admin menyembunyikan atau menampilkan kembali usulan atau komentar.
 * 'budget_change': pagu diubah (migrasi 0005).
 */
export const JENIS_LOG = [
  "weight_change",
  "status_change",
  "selection",
  "note",
  "moderation",
  "budget_change",
] as const;
export type JenisLog = (typeof JENIS_LOG)[number];

export const LABEL_JENIS_LOG: Record<JenisLog, string> = {
  weight_change: "Bobot diubah",
  status_change: "Status berubah",
  selection: "Rekomendasi dihitung",
  note: "Catatan",
  moderation: "Moderasi",
  budget_change: "Pagu diubah",
};
