// Tag cache Next.js (cacheTag / updateTag). Satu tempat supaya pembaca dan penulis
// data memakai nama yang sama.
//
//   beranda    : angka halaman utama (Garis Pagu, wilayah). Berubah saat dukungan pada usulan
//                berstatus 'voting' berubah, usulan voting disembunyikan, atau admin mengubah
//                pagu, bobot, atau status usulan.
//   forum      : daftar forum dan jumlah dukungan/komentar di dalamnya.
//   usulan     : satu usulan beserta komentar dan riwayatnya.
//   pengaturan : pagu dan bobot resmi. Dibaca beranda dan forum; hanya diubah halaman admin.
export const TAG = {
  beranda: "beranda",
  forum: "forum",
  pengaturan: "pengaturan",
  usulan: (id: string) => `usulan:${id}`,
} as const;
