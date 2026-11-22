// Rubrik urgensi: pegangan admin supaya penilaian antarusulan konsisten. Urgensi (1-10) adalah
// satu dari tiga komponen skor dan satu-satunya yang dinilai manusia, jadi tanpa rubrik dua usulan
// yang setara bisa mendapat nilai berjauhan hanya karena dinilai pada hari yang berbeda.
//
// Rentangnya sengaja empat tingkat, bukan sepuluh: admin memilih tingkat dulu, lalu angka di dalamnya.

export interface TingkatUrgensi {
  dari: number;
  sampai: number;
  /** Judul pendek, dibaca di samping pilihan angka. */
  ringkas: string;
  /** Satu kalimat penjelas. */
  jelas: string;
}

export const RUBRIK_URGENSI: readonly TingkatUrgensi[] = [
  {
    dari: 1,
    sampai: 3,
    ringkas: "Bisa menunggu periode berikutnya",
    jelas: "Mempercantik atau merawat tampilan. Layanan dasar dan keselamatan warga tidak terganggu.",
  },
  {
    dari: 4,
    sampai: 6,
    ringkas: "Mengganggu kegiatan sehari-hari",
    jelas: "Warga masih bisa beraktivitas, tetapi dengan susah payah atau sering terhambat.",
  },
  {
    dari: 7,
    sampai: 8,
    ringkas: "Merugikan banyak warga bila ditunda",
    jelas: "Kerugian terjadi setiap hari atau setiap musim, dan dirasakan banyak warga.",
  },
  {
    dari: 9,
    sampai: 10,
    ringkas: "Menyangkut keselamatan",
    jelas: "Ada risiko cedera atau kehilangan nyawa. 10 untuk bahaya yang paling dekat dan paling berat.",
  },
];

export function rubrikUntuk(nilai: number): TingkatUrgensi | null {
  return RUBRIK_URGENSI.find((t) => nilai >= t.dari && nilai <= t.sampai) ?? null;
}

export const label = (t: TingkatUrgensi): string => (t.dari === t.sampai ? `${t.dari}` : `${t.dari}–${t.sampai}`);
