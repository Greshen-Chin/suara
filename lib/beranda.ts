// Memuat semua data halaman utama sekali jalan, lalu menyimpannya di cache selama 1 menit.
// Datanya sama untuk semua pengunjung, jadi halaman bisa diprerender dan tetap segar.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  getBobotResmi,
  getGreedy,
  getLogTerbaru,
  getPagu,
  getRekomendasi,
  getWilayah,
  type BarisLog,
  type BarisRekomendasi,
  type BarisWilayah,
} from "./data";
import { susunModePagu, type ModePagu } from "./pagu-model";
import { TAG } from "./tag-cache";
import type { Bobot } from "./seleksi";

export const JUMLAH_JEJAK = 3;

export interface DataBeranda {
  pagu: number;
  modeSuara: ModePagu;
  modeRekomendasi: ModePagu;
  wilayah: BarisWilayah[];
  /** Semua usulan berstatus voting (urutan peringkat rekomendasi). */
  usulan: BarisRekomendasi[];
  bobot: Bobot;
  log: BarisLog[];
  /** true bila salah satu data diambil dari cadangan karena database tidak terjangkau. */
  dataContoh: boolean;
}

export async function muatBeranda(): Promise<DataBeranda> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  // Dukungan pada usulan voting mengubah angka di sini. Server Action forum dan admin memanggil
  // updateTag(TAG.beranda), jadi angkanya langsung ikut berubah, tidak menunggu 60 detik.
  cacheTag(TAG.beranda, TAG.pengaturan);

  // Pagu dari database (diubah admin); PAGU_DEFAULT hanya bila database tidak terjangkau.
  const paguBaca = await getPagu();
  const pagu = paguBaca.data;
  const [suara, rekomendasi, wilayah, bobot, log] = await Promise.all([
    getGreedy(pagu, "suara"),
    getRekomendasi(pagu),
    getWilayah(),
    getBobotResmi(),
    getLogTerbaru(JUMLAH_JEJAK),
  ]);

  return {
    pagu,
    modeSuara: susunModePagu("suara", suara.data, wilayah.data, pagu),
    modeRekomendasi: susunModePagu(
      "rekomendasi",
      rekomendasi.data,
      wilayah.data,
      pagu,
    ),
    wilayah: wilayah.data,
    usulan: rekomendasi.data,
    bobot: bobot.data,
    log: log.data,
    dataContoh: [paguBaca, suara, rekomendasi, wilayah, bobot, log].some(
      (h) => h.source === "fallback",
    ),
  };
}
