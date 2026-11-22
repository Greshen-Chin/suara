// Format waktu untuk forum: "3 hari lalu", "22 November 2026", "20 detik".

const MENIT = 60;
const JAM = 3600;
const HARI = 86_400;

/**
 * Umur sejak `iso` dalam bahasa sehari-hari. Selalu membulat ke bawah dan memilih satuan
 * terbesar yang sudah penuh: 47 jam adalah "1 hari lalu", bukan "2 hari lalu".
 */
export function waktuRelatif(iso: string, sekarang: Date = new Date()): string {
  const selisih = Math.floor((sekarang.getTime() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(selisih)) return "";
  if (selisih < MENIT) return "baru saja";
  if (selisih < JAM) return `${Math.floor(selisih / MENIT)} menit lalu`;
  if (selisih < HARI) return `${Math.floor(selisih / JAM)} jam lalu`;
  const hari = Math.floor(selisih / HARI);
  if (hari === 1) return "kemarin";
  if (hari < 7) return `${hari} hari lalu`;
  if (hari < 30) return `${Math.floor(hari / 7)} minggu lalu`;
  if (hari < 365) return `${Math.floor(hari / 30)} bulan lalu`;
  return `${Math.floor(hari / 365)} tahun lalu`;
}

const TANGGAL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const TANGGAL_JAM = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

export const tanggalPanjang = (iso: string): string => TANGGAL.format(new Date(iso));
export const tanggalDanJam = (iso: string): string => `${TANGGAL_JAM.format(new Date(iso))} WIB`.replace(".", ":");

/** Lama menunggu untuk pesan batas laju: 20 -> "20 detik", 90 -> "2 menit", 4000 -> "2 jam". */
export function lamaTunggu(detik: number): string {
  const d = Math.max(1, Math.ceil(detik));
  if (d < MENIT) return `${d} detik`;
  const menit = Math.ceil(d / MENIT);
  if (menit < 60) return `${menit} menit`;
  return `${Math.ceil(d / JAM)} jam`;
}
