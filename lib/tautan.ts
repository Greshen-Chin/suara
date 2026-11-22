// Tautan keluar dan rute utama. Satu tempat supaya mudah diganti.

export const RUTE = {
  beranda: "/",
  forum: "/forum",
  simulasi: "/simulasi",
  keputusan: "/keputusan",
  masuk: "/masuk",
  akun: "/akun",
} as const;

export const URL_KODE_SUMBER = "https://github.com/Greshen-Chin/suara";

// Isi dengan tautan video demo setelah diunggah. Selama masih null, tautannya tidak
// ditampilkan di footer (lebih baik tidak ada tautan daripada tautan yang tidak ke mana-mana).
export const URL_VIDEO_DEMO: string | null = null;
