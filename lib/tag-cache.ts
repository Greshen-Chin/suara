// Tag cache Next.js (cacheTag / updateTag). Satu tempat supaya pembaca dan penulis
// data memakai nama yang sama.
//
//   beranda : angka halaman utama (Garis Pagu, wilayah). Berubah saat dukungan pada usulan
//             berstatus 'voting' berubah, atau usulan voting disembunyikan.
//   forum   : daftar forum dan jumlah dukungan/komentar di dalamnya.
//   usulan  : satu usulan beserta komentar dan riwayatnya.
export const TAG = {
  beranda: "beranda",
  forum: "forum",
  usulan: (id: string) => `usulan:${id}`,
} as const;
