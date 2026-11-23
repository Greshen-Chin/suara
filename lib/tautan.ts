// Tautan keluar dan rute utama. Satu tempat supaya mudah diganti.

export const RUTE = {
  beranda: "/",
  forum: "/forum",
  peta: "/peta",
  simulasi: "/simulasi",
  keputusan: "/keputusan",
  masuk: "/masuk",
  /**
   * Halaman masuk untuk yang tokennya masih sah tetapi akunnya sudah tidak berlaku (dinonaktifkan atau
   * sesinya dicabut). Parameter ini menghentikan pengalihan /masuk -> /akun di proxy.ts; tanpanya
   * keduanya saling mengalihkan tanpa henti.
   */
  masukSesiBerakhir: "/masuk?sesi=berakhir",
  akun: "/akun",
  admin: "/admin",
} as const;

export const URL_KODE_SUMBER = "https://github.com/Greshen-Chin/suara";

// Isi dengan tautan video demo setelah diunggah. Selama masih null, tautannya tidak
// ditampilkan di footer (lebih baik tidak ada tautan daripada tautan yang tidak ke mana-mana).
export const URL_VIDEO_DEMO: string | null = null;
