// Tes SQL untuk halaman /simulasi, dijalankan di PGlite lewat `npm test`. Tidak menyentuh database Supabase.
// Tidak ada migrasi baru; yang dibuktikan di sini:
//   1. Kueri yang dipakai lib/simulasi-data.ts (dituliskan ulang dalam SQL yang setara) mengembalikan data
//      yang membuat simulasi dengan nilai resmi sama dengan rekomendasi_resmi, baris demi baris (S-01).
//   2. Simulasi dengan pagu, bobot, dan usulan forum andaian sama dengan yang DIHASILKAN DATABASE bila
//      keadaan itu benar-benar berlaku: pilih_optimal dengan pagu dan bobot yang sama, dan rekomendasi_resmi
//      setelah usulan forum benar-benar dipindahkan ke voting oleh admin (S-01, S-07).
//   3. Angka halaman utama tetap sama dengan baseline (S-13).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { hitungResmi, hitungSimulasi, keadaanResmi, namaSingkatDari, tambahkan, type DataSimulasi, type KeadaanSimulasi } from "../../lib/simulasi.ts";
import { buatDatabase, muat, SEBELUM_FORUM, sidikRekomendasi } from "./pglite.ts";

const baseline = JSON.parse(readFileSync(new URL("./baseline-rekomendasi.json", import.meta.url), "utf8")) as {
  rekomendasi: unknown;
};

const HASH = "$scrypt$ln=17,r=8,p=1$c2VlZC1ha3Vu$c2VlZC1ha3VuLXRhbnBhLXNhbmRp";
const ADMIN = "00000000-0000-4000-8000-0000000000a4";
const U = (n: number) => `6f1b3d0a-1001-4c8e-9a10-00000000000${n}`;
const LAMPU_GANG = U(1);
const ATAP = U(3);
const ALASAN_URGENSI = "Gang gelap dan berlubang; anak pengajian dan ibu-ibu rawan terjatuh tiap malam.";
const JT = 1_000_000;

async function baris<T extends Record<string, unknown>>(db: PGlite, sql: string, ...param: unknown[]): Promise<T[]> {
  return (await db.query<T>(sql, param)).rows;
}

async function siapkan(): Promise<PGlite> {
  const db = await buatDatabase();
  await muat(db, ...SEBELUM_FORUM, "m0004");
  await db.exec(`
    insert into akun (id, nama_pengguna, hash_kata_sandi, peran, warga_id, aktif) values
      ('${ADMIN}', 'uji-admin', '${HASH}', 'admin', null, true),
      ('00000000-0000-4000-8000-0000000000a6', 'warga', '${HASH}', 'warga', null, true);
  `);
  await muat(db, "seedForum");
  await muat(db, "m0005");
  return db;
}

/**
 * Data yang dibaca lib/simulasi-data.ts, dalam SQL yang setara: voting dari v_usulan (tidak tersembunyi, urut
 * created_at lalu id), forum dari v_forum, wilayah, bobot resmi, dan pagu.
 */
async function bacaData(db: PGlite): Promise<DataSimulasi> {
  const voting = await baris<{
    id: string; title: string; nama_singkat: string | null; category: string; rw: number;
    estimated_budget: string; vote_count: number; urgency_score: number; created_at: Date;
  }>(
    db,
    `select id, title, nama_singkat, category, rw, estimated_budget::text, vote_count, urgency_score, created_at
       from v_usulan
      where status = 'voting' and disembunyikan_pada is null and rw is not null and urgency_score is not null
      order by created_at, id`,
  );
  const forum = await baris<{
    id: string; title: string; nama_singkat: string | null; category: string; rw: number;
    estimated_budget: string; vote_count: number; created_at: Date;
  }>(
    db,
    `select id, title, nama_singkat, category, rw, estimated_budget::text, vote_count, created_at
       from v_forum where status = 'forum' and rw is not null order by created_at, id`,
  );
  const wilayah = await baris<{ rw: number; nama: string; penduduk: number; anggaran_lalu: string }>(
    db,
    "select rw, nama, penduduk, anggaran_lalu::text from wilayah order by rw",
  );
  const [w] = await baris<{ w_popularitas: string; w_urgensi: string; w_pemerataan: string }>(
    db,
    "select w_popularitas::text, w_urgensi::text, w_pemerataan::text from scoring_weights",
  );
  const [s] = await baris<{ pagu: string }>(db, "select pagu::text from pengaturan_anggaran");

  return {
    dasar: {
      usulan: voting.map((u) => ({
        id: u.id,
        title: u.title,
        namaSingkat: namaSingkatDari(u.nama_singkat, u.title),
        category: u.category,
        rw: u.rw,
        estimatedBudget: Number(u.estimated_budget),
        voteCount: u.vote_count,
        urgencyScore: u.urgency_score,
        dibuat: u.created_at.toISOString(),
      })),
      wilayah: wilayah.map((r) => ({ rw: r.rw, nama: r.nama, penduduk: r.penduduk, anggaranLalu: Number(r.anggaran_lalu) })),
      pagu: Number(s.pagu),
      bobot: { popularitas: Number(w.w_popularitas), urgensi: Number(w.w_urgensi), pemerataan: Number(w.w_pemerataan) },
    },
    forum: forum.map((u) => ({
      id: u.id,
      title: u.title,
      namaSingkat: namaSingkatDari(u.nama_singkat, u.title),
      category: u.category,
      rw: u.rw,
      estimatedBudget: Number(u.estimated_budget),
      voteCount: u.vote_count,
      dibuat: u.created_at.toISOString(),
    })),
    dataCadangan: false,
  };
}

interface BarisSql {
  peringkat: number;
  id: string;
  selected: boolean;
  skor: number;
  totalBerjalan: number;
}

const bacaBaris = async (db: PGlite, sql: string, ...param: unknown[]): Promise<BarisSql[]> =>
  (await baris<{ peringkat: number; id: string; selected: boolean; skor: string; total_berjalan: string }>(db, sql, ...param)).map((r) => ({
    peringkat: r.peringkat,
    id: r.id,
    selected: r.selected,
    skor: Number(r.skor),
    totalBerjalan: Number(r.total_berjalan),
  }));

function samaBarisDemiBaris(db: BarisSql[], ts: { id: string; peringkat: number; selected: boolean; skor: number; totalBerjalan: number }[], nama: string) {
  assert.equal(ts.length, db.length, `${nama}: jumlah usulan`);
  db.forEach((b, i) => {
    assert.equal(ts[i].id, b.id, `${nama}: urutan ${i + 1}`);
    assert.equal(ts[i].peringkat, b.peringkat, `${nama}: peringkat ${i + 1}`);
    assert.equal(ts[i].selected, b.selected, `${nama}: terpilih ${b.id}`);
    assert.ok(Math.abs(ts[i].skor - b.skor) <= 0.00011, `${nama}: skor ${ts[i].skor} vs ${b.skor}`);
    assert.equal(ts[i].totalBerjalan, b.totalBerjalan, `${nama}: total berjalan ${b.id}`);
  });
}

describe("simulasi terhadap database", () => {
  let db: PGlite;

  before(async () => {
    db = await siapkan();
  });
  after(async () => {
    await db.close();
  });

  const SQL_RESMI = "select peringkat, id, selected, skor::text, total_berjalan::text from rekomendasi_resmi($1) order by peringkat";
  const SQL_OPTIMAL = "select peringkat, id, selected, skor::text, total_berjalan::text from pilih_optimal($1, $2, $3, $4) order by peringkat";

  test("S-13: rekomendasi_resmi(300000000) sama persis dengan baseline (angka beranda tidak berubah)", async () => {
    assert.deepEqual(JSON.parse(await sidikRekomendasi(db)), baseline.rekomendasi);
  });

  test("data yang dibaca: 7 usulan voting, 6 usulan forum, pagu Rp 300 juta, bobot 30/40/30", async () => {
    const data = await bacaData(db);
    assert.equal(data.dasar.usulan.length, 7);
    assert.equal(data.forum.length, 6);
    assert.equal(data.dasar.pagu, 300 * JT);
    assert.deepEqual(data.dasar.bobot, { popularitas: 30, urgensi: 40, pemerataan: 30 });
    assert.equal(data.dasar.wilayah.length, 3);
  });

  test("S-01: keadaan resmi sama dengan rekomendasi_resmi(300000000), baris demi baris", async () => {
    const data = await bacaData(db);
    const h = hitungSimulasi(data, keadaanResmi(data), hitungResmi(data));
    samaBarisDemiBaris(await bacaBaris(db, SQL_RESMI, "300000000"), h.hasil, "resmi");
    assert.equal(h.terbiayai, 4);
    assert.equal(h.sisa, 15 * JT);
    assert.equal(h.banding.berubah.length, 0);
  });

  test("S-01: pagu dan bobot yang diubah sama dengan pilih_optimal dengan argumen yang sama", async () => {
    const data = await bacaData(db);
    const resmi = hitungResmi(data);
    const kasus: [string, number, [number, number, number]][] = [
      ["bobot 100/0/0", 300, [100, 0, 0]],
      ["bobot 10/80/10", 300, [10, 80, 10]],
      ["bobot 10/30/60", 300, [10, 30, 60]],
      ["bobot 20/60/20, pagu 350", 350, [20, 60, 20]],
      ["pagu 505", 505, [30, 40, 30]],
      ["pagu 450, bobot 70/10/20", 450, [70, 10, 20]],
      ["pagu 250, bobot 0/0/100", 250, [0, 0, 100]],
      ["pagu 30", 30, [30, 40, 30]],
      ["pagu 800", 800, [30, 40, 30]],
    ];
    for (const [nama, pagu, [p, u, m]] of kasus) {
      const keadaan: KeadaanSimulasi = { pagu: pagu * JT, bobot: { popularitas: p, urgensi: u, pemerataan: m }, tambah: [] };
      const h = hitungSimulasi(data, keadaan, resmi);
      samaBarisDemiBaris(await bacaBaris(db, SQL_OPTIMAL, String(pagu * JT), p, u, m), h.hasil, nama);
    }
  });

  test("S-07: beberapa usulan forum andaian sama dengan hasil database setelah semuanya benar-benar dimasukkan admin", async () => {
    const data = await bacaData(db);
    let keadaan = keadaanResmi(data);
    keadaan = tambahkan(data, keadaan, LAMPU_GANG, 8);
    keadaan = tambahkan(data, keadaan, ATAP, 6);
    assert.equal(keadaan.tambah.length, 2);
    const simulasi = hitungSimulasi(data, keadaan, hitungResmi(data));

    // Dua usulan itu benar-benar dimasukkan admin ke hitungan anggaran, dengan urgensi yang sama.
    for (const [id, urgensi] of [[LAMPU_GANG, 8], [ATAP, 6]] as const) {
      const { rows } = await db.query<{ r: { ok: boolean } }>(
        "select pindahkan_status($1, $2, 'voting', 'forum', $3, $4, null, null) as r",
        [ADMIN, id, urgensi, ALASAN_URGENSI],
      );
      assert.equal(rows[0].r.ok, true, `memasukkan ${id}`);
    }
    samaBarisDemiBaris(await bacaBaris(db, SQL_RESMI, "300000000"), simulasi.hasil, "dua usulan forum");
    assert.equal(simulasi.jumlah, 9);
    assert.equal((await bacaBaris(db, SQL_RESMI, "300000000")).length, 9);
  });

  test("usulan forum yang disembunyikan atau sudah berpindah status tidak lagi ada di daftar yang bisa ditambahkan", async () => {
    // LAMPU_GANG dan ATAP sudah voting dari tes sebelumnya.
    const data = await bacaData(db);
    assert.ok(!data.forum.some((f) => f.id === LAMPU_GANG || f.id === ATAP));
    assert.equal(data.forum.length, 4);
    const sebelum = data.forum.length;
    const { rows } = await db.query<{ r: { ok: boolean } }>(
      "select sembunyikan($1, 'usulan', $2, 'Alasan yang cukup panjang untuk dibaca warga.') as r",
      [ADMIN, U(4)],
    );
    assert.equal(rows[0].r.ok, true);
    assert.equal((await bacaData(db)).forum.length, sebelum - 1);
  });
});
