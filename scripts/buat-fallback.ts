// Membuat lib/fallback-forum.json: data cadangan forum yang dipakai saat database tidak
// terjangkau. Isinya DIAMBIL dari seed (seed.sql + seed_forum.sql) yang dijalankan di
// PGlite, jadi tidak pernah menyimpang dari yang dilihat warga di database sungguhan.
//
//   npm run fallback:buat
//
// Id ketujuh usulan voting disamakan dengan lib/fallback-data.json (id di seed.sql acak
// tiap dijalankan, sedangkan data cadangan butuh id tetap).
import { readFileSync, writeFileSync } from "node:fs";
import { buatDatabase, muat, SEMUA } from "../supabase/tests/pglite.ts";

type Baris = Record<string, unknown>;
const ANGKA = new Set(["suara_per_1000", "estimated_budget", "vote_count", "jumlah_komentar", "penduduk", "rw", "pengusul_rw", "penulis_rw", "id_log"]);

/** bigint -> number, Date -> ISO, numeric (teks) -> number untuk kolom angka yang dikenal. */
function bersihkan(baris: Baris): Baris {
  const hasil: Baris = {};
  for (const [k, v] of Object.entries(baris)) {
    if (typeof v === "bigint") hasil[k] = Number(v);
    else if (v instanceof Date) hasil[k] = v.toISOString();
    else if (typeof v === "string" && ANGKA.has(k)) hasil[k] = Number(v);
    else hasil[k] = v;
  }
  return hasil;
}

const asli = JSON.parse(readFileSync(new URL("../lib/fallback-data.json", import.meta.url), "utf8")) as {
  usulan_voting: { id: string; title: string }[];
};
const idTetap = new Map(asli.usulan_voting.map((u) => [u.title, u.id]));

const db = await buatDatabase();
await muat(db, ...SEMUA);

const usulanDb = (await db.query<Baris>("select * from v_usulan order by created_at desc, id")).rows.map(bersihkan);
const idLama = new Map<string, string>(); // id acak di seed -> id tetap
for (const u of usulanDb) {
  const tetap = idTetap.get(String(u.title));
  if (tetap) {
    idLama.set(String(u.id), tetap);
    u.id = tetap;
  }
}
const petakan = (id: unknown) => (id == null ? id : (idLama.get(String(id)) ?? id));

const komentar = (
  await db.query<Baris>("select * from v_komentar order by created_at, id")
).rows.map(bersihkan).map((k) => ({ ...k, proposal_id: petakan(k.proposal_id) }));

const log = (
  await db.query<Baris>("select * from accountability_logs where proposal_id is not null order by created_at, id")
).rows.map(bersihkan).map((l) => ({ ...l, proposal_id: petakan(l.proposal_id) }));

const keluaran = { dibuat: new Date().toISOString(), usulan: usulanDb, komentar, log };
writeFileSync(new URL("../lib/fallback-forum.json", import.meta.url), JSON.stringify(keluaran, null, 2) + "\n");
console.log(`lib/fallback-forum.json: ${usulanDb.length} usulan, ${komentar.length} komentar, ${log.length} catatan`);
await db.close();
