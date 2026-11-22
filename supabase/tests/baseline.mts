// Menangkap hasil rekomendasi_resmi(300000000) dari migrasi 0001-0003 + seed.sql SAJA,
// sebelum migrasi forum. Hasilnya disimpan di baseline-rekomendasi.json dan dipakai
// forum.test.ts untuk membuktikan angka halaman utama tidak berubah.
//
// Jalankan sekali (hanya bila skor atau seed.sql memang sengaja diubah):
//   node supabase/tests/baseline.mts
import { writeFileSync } from "node:fs";
import { buatDatabase, muat, SEBELUM_FORUM, sidikRekomendasi } from "./pglite.ts";

const db = await buatDatabase();
await muat(db, ...SEBELUM_FORUM);

const sidik = await sidikRekomendasi(db);
const { rows } = await db.query<{ n: number; total: number }>(
  "select count(*)::int as n, (select count(*)::int from votes) as total from proposals",
);
const keluaran = {
  catatan:
    "Hasil rekomendasi_resmi(300000000) dari 0001-0003 + seed.sql, sebelum migrasi 0004.",
  jumlahUsulan: rows[0].n,
  jumlahDukungan: rows[0].total,
  rekomendasi: JSON.parse(sidik),
};
const tujuan = new URL("./baseline-rekomendasi.json", import.meta.url);
writeFileSync(tujuan, JSON.stringify(keluaran, null, 2) + "\n");
console.log(`ditulis: ${tujuan.pathname}`);
console.log(`usulan=${keluaran.jumlahUsulan} dukungan=${keluaran.jumlahDukungan}`);
console.log(keluaran.rekomendasi.map((r: { peringkat: number; nama_singkat: string; skor: string; selected: boolean }) =>
  `${r.peringkat}. ${r.nama_singkat} skor=${r.skor} ${r.selected ? "terpilih" : "-"}`).join("\n"));
await db.close();
