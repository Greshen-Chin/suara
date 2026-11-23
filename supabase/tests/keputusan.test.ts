// Tes SQL untuk migrasi 0006 (keputusan musyawarah) dan seed_keputusan.sql, dijalankan di PGlite lewat
// `npm test`. Tidak menyentuh database Supabase. Urutan memuat sama dengan yang dijalankan pemilik proyek:
// 0001 -> 0002 -> seed.sql -> 0003 -> 0004 -> akun demo -> seed_forum.sql -> 0005 -> 0006 -> seed_keputusan.sql.
//
// Hampir semua tes berjalan di dalam transaksi yang di-rollback, jadi satu database dipakai bersama dan tiap
// tes mulai dari keadaan yang sama (tanpa memuat ulang skema sebanyak jumlah tes).
//
// Kode kriteria penerimaan (K-xx) ada di docs/prompts/keputusan.md bagian 7.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { kalimatSejalan, uraiHitungan } from "../../lib/keputusan.ts";
import { pilihOptimal, statusUsulan, type Bobot, type Usulan, type Wilayah } from "../../lib/seleksi.ts";
import { buatDatabase, muat, SEBELUM_FORUM, sidikRekomendasi } from "./pglite.ts";

const baseline = JSON.parse(readFileSync(new URL("./baseline-rekomendasi.json", import.meta.url), "utf8")) as {
  jumlahUsulan: number;
  jumlahDukungan: number;
  rekomendasi: unknown;
};

const HASH = "$scrypt$ln=17,r=8,p=1$c2VlZC1ha3Vu$c2VlZC1ha3VuLXRhbnBhLXNhbmRp";
const AKUN = {
  warga: "00000000-0000-4000-8000-0000000000a1", // warga RW 07 nomor 69
  admin: "00000000-0000-4000-8000-0000000000a4",
  admin2: "00000000-0000-4000-8000-0000000000a7",
  nonaktif: "00000000-0000-4000-8000-0000000000a5",
} as const;
const TIDAK_ADA = "00000000-0000-4000-8000-00000000ffff";
const U = (n: number) => `6f1b3d0a-1001-4c8e-9a10-00000000000${n}`;
const PROPOSAL_2026 = (n: number) => `6f1b3d0a-1002-4c8e-9a10-00000000000${n}`;

const ALASAN = "Alasan yang cukup panjang untuk dibaca warga desa.";
const CATATAN = "Musyawarah desa di balai warga, dihadiri perwakilan RT dan RW, berjalan lancar.";
const TANGGAL = "2025-12-20";
const JT = 1_000_000;

type Hasil = Record<string, unknown> & { ok: boolean; kode?: string; bidang?: string };
interface Butir {
  id: string;
  hasil: string;
  alasan?: string | null;
  sumber_dana?: string | null;
}
interface BarisHitungan {
  peringkat: number;
  id: string;
  judul: string;
  nama_singkat: string;
  rw: number;
  biaya: number;
  dukungan: number;
  urgensi: number;
  skor: number;
  status: string;
  terpilih: boolean;
}
interface Hitungan {
  sidik: string;
  pagu: number;
  versi_bobot: number;
  jumlah: number;
  usulan: BarisHitungan[];
}

async function panggil(db: PGlite, sql: string, ...param: unknown[]): Promise<Hasil> {
  const { rows } = await db.query<{ r: Hasil }>(`select ${sql} as r`, param);
  return rows[0].r;
}
async function angka(db: PGlite, sql: string, ...param: unknown[]): Promise<number> {
  const { rows } = await db.query<{ n: number | string | bigint }>(sql, param);
  return Number(rows[0].n);
}
async function baris<T extends Record<string, unknown>>(db: PGlite, sql: string, ...param: unknown[]): Promise<T[]> {
  return (await db.query<T>(sql, param)).rows;
}

/** Jalankan di dalam transaksi lalu batalkan: database kembali persis seperti sebelumnya. */
async function transaksi(db: PGlite, kerja: () => Promise<void>): Promise<void> {
  await db.exec("begin");
  try {
    await kerja();
  } finally {
    await db.exec("rollback");
  }
}

const bacaHitungan = async (db: PGlite): Promise<Hitungan> => (await panggil(db, "sidik_hitungan()")) as unknown as Hitungan;
const idDari = (h: Hitungan, nama: string): string => {
  const u = h.usulan.find((x) => x.nama_singkat === nama);
  assert.ok(u, `usulan ${nama} tidak ada di hitungan`);
  return u.id;
};

/** Mengikuti rekomendasi: yang terpilih disetujui, sisanya dibawa ke periode berikutnya. Tanpa alasan. */
const butirSejalan = (h: Hitungan): Butir[] =>
  h.usulan.map((u) => ({ id: u.id, hasil: u.terpilih ? "disetujui" : "dilanjutkan" }));

interface OpsiTetapkan {
  akun?: string;
  tahun?: number;
  versi?: number;
  sidik?: string;
  tanggal?: string | null;
  catatan?: string;
  butir?: unknown;
}

async function tetapkan(db: PGlite, o: OpsiTetapkan = {}): Promise<Hasil> {
  const tahun = o.tahun ?? 2027;
  const h = await bacaHitungan(db);
  const [p] = await baris<{ versi: number }>(db, "select versi from periode where tahun = $1", tahun);
  const butir = o.butir === undefined ? butirSejalan(h) : o.butir;
  return panggil(
    db,
    "tetapkan_keputusan($1, $2, $3, $4, $5, $6, $7::jsonb)",
    o.akun ?? AKUN.admin,
    tahun,
    o.versi ?? p?.versi ?? 1,
    o.sidik ?? h.sidik,
    o.tanggal === undefined ? TANGGAL : o.tanggal,
    o.catatan ?? CATATAN,
    typeof butir === "string" ? butir : JSON.stringify(butir),
  );
}
const batalkan = (db: PGlite, o: { akun?: string; tahun?: number; alasan?: string } = {}) =>
  panggil(db, "batalkan_penetapan($1, $2, $3)", o.akun ?? AKUN.admin, o.tahun ?? 2027, o.alasan ?? ALASAN);
const selesai = (db: PGlite, proposal: string, status: string, catatan = "Pekerjaan sudah selesai dan dicek bersama perangkat desa.", biaya: number | null = null, akun: string = AKUN.admin) =>
  panggil(db, "tandai_selesai($1, $2, $3, $4, $5)", akun, proposal, status, catatan, biaya);

/** Potret keadaan yang harus pulih persis setelah pembatalan. versi periode sengaja tidak ikut: ia hanya naik. */
async function potret(db: PGlite): Promise<unknown> {
  const proposals = await baris(db, "select id, status, urgency_score, urgency_reason, nama_singkat, rw, disembunyikan_pada from proposals order by id");
  const wilayah = await baris<{ rw: number; anggaran_lalu: string }>(db, "select rw, anggaran_lalu::text from wilayah order by rw");
  const periode = await baris(
    db,
    "select tahun, status, diputuskan_pada, tanggal_musyawarah, catatan, pagu, bobot, ada_rekomendasi, wilayah_sebelum, diputuskan_oleh from periode order by tahun",
  );
  const votes = await angka(db, "select count(*) as n from votes");
  return JSON.parse(JSON.stringify({ proposals, wilayah, periode, votes }));
}

async function siapkan(): Promise<PGlite> {
  const db = await buatDatabase();
  await muat(db, ...SEBELUM_FORUM, "m0004");
  await db.exec(`
    insert into akun (id, nama_pengguna, hash_kata_sandi, peran, warga_id, aktif) values
      ('${AKUN.warga}',    'uji-warga',    '${HASH}', 'warga', (select id from warga where nomor = 69), true),
      ('${AKUN.admin}',    'uji-admin',    '${HASH}', 'admin', null, true),
      ('${AKUN.admin2}',   'uji-admin-2',  '${HASH}', 'admin', null, true),
      ('${AKUN.nonaktif}', 'uji-nonaktif', '${HASH}', 'admin', null, false),
      ('00000000-0000-4000-8000-0000000000a6', 'warga', '${HASH}', 'warga', null, true);
  `);
  await muat(db, "seedForum");
  await muat(db, "m0005");
  await muat(db, "m0006");
  await muat(db, "seedKeputusan");
  return db;
}

const FUNGSI = [
  "hitungan_dengan_status(bigint)",
  "sidik_hitungan()",
  "butir_terurai(jsonb)",
  "skor_teks(numeric)",
  "tetapkan_keputusan(uuid, integer, integer, text, date, text, jsonb)",
  "batalkan_penetapan(uuid, integer, text)",
  "pulihkan_periode(integer, text, text, boolean)",
  "tandai_selesai(uuid, uuid, text, text, bigint)",
];

describe("migrasi 0006 dan seed_keputusan", () => {
  let db: PGlite;

  before(async () => {
    db = await siapkan();
  });
  after(async () => {
    await db.close();
  });

  // ---------------------------------------------------------------------------
  describe("K-01 angka halaman utama tidak berubah", () => {
    test("rekomendasi_resmi(300000000) sama persis dengan baseline", async () => {
      assert.deepEqual(JSON.parse(await sidikRekomendasi(db)), baseline.rekomendasi);
    });

    test("tujuh usulan voting, 162 dukungan, empat terpilih", async () => {
      assert.equal(await angka(db, "select count(*) as n from proposals where status = 'voting'"), baseline.jumlahUsulan);
      assert.equal(
        await angka(db, "select count(*) as n from votes v join proposals p on p.id = v.proposal_id where p.status = 'voting'"),
        baseline.jumlahDukungan,
      );
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000) where selected"), 4);
    });

    test("seed hanya menambah empat usulan lampau (done/rejected) dan tidak ada dukungan baru", async () => {
      assert.equal(await angka(db, "select count(*) as n from proposals"), 17);
      assert.equal(await angka(db, "select count(*) as n from proposals where status in ('done', 'rejected')"), 4);
      assert.equal(await angka(db, "select count(*) as n from proposals where status = 'voting'"), 7);
      assert.equal(await angka(db, "select count(*) as n from votes where proposal_id::text like '6f1b3d0a-1002-%'"), 0);
    });

    test("periode: 2026 sudah diputuskan, 2027 berjalan (satu saja)", async () => {
      const r = await baris<{ tahun: number; status: string }>(db, "select tahun, status from periode order by tahun");
      assert.deepEqual(r, [
        { tahun: 2026, status: "diputuskan" },
        { tahun: 2027, status: "berjalan" },
      ]);
    });

    test("anggaran_lalu tetap RW 01 Rp 250 juta, RW 03 Rp 60 juta, RW 07 Rp 0", async () => {
      const r = await baris<{ rw: number; a: string }>(db, "select rw, anggaran_lalu::text as a from wilayah order by rw");
      assert.deepEqual(r, [
        { rw: 1, a: "250000000" },
        { rw: 3, a: "60000000" },
        { rw: 7, a: "0" },
      ]);
    });

    test("seed 2026 cocok dengan anggaran_lalu: jumlah biaya disetujui per RW", async () => {
      const r = await baris<{ rw: number; jumlah: string }>(
        db,
        "select rw, sum(biaya)::text as jumlah from v_keputusan where tahun = 2026 and hasil = 'disetujui' group by rw order by rw",
      );
      assert.deepEqual(r, [
        { rw: 1, jumlah: "250000000" },
        { rw: 3, jumlah: "60000000" },
      ]);
    });

    test("periode 2026 tanpa potret rekomendasi dan tidak bisa dibatalkan", async () => {
      const [p] = await baris<{ ada_rekomendasi: boolean; wilayah_sebelum: unknown }>(db, "select ada_rekomendasi, wilayah_sebelum from periode where tahun = 2026");
      assert.equal(p.ada_rekomendasi, false);
      assert.equal(p.wilayah_sebelum, null);
      const r = await baris<{ peringkat: number | null; skor: string | null; status_rekomendasi: string | null }>(
        db,
        "select peringkat, skor, status_rekomendasi from keputusan where tahun = 2026",
      );
      assert.equal(r.length, 4);
      assert.ok(r.every((x) => x.peringkat === null && x.skor === null && x.status_rekomendasi === null));
      assert.equal((await batalkan(db, { tahun: 2026 })).kode, "tidak_bisa_dibatalkan");
    });

    test("seed aman dijalankan ulang", async () => {
      await transaksi(db, async () => {
        await muat(db, "seedKeputusan");
        assert.equal(await angka(db, "select count(*) as n from keputusan where tahun = 2026"), 4);
        assert.equal(await angka(db, "select count(*) as n from proposals"), 17);
      });
    });

    test("status 'referred' dan jenis log 'decision' diterima database; status lain tetap ditolak", async () => {
      await transaksi(db, async () => {
        await db.exec("update proposals set status = 'referred' where title like 'Gapura%'");
        await db.exec("insert into accountability_logs (log_type, actor, message) values ('decision', 'uji', 'uji')");
      });
      await assert.rejects(db.exec("update proposals set status = 'selesai' where title like 'Gapura%'"), /proposals_status_check/);
      await db.exec("rollback");
      await assert.rejects(db.exec("insert into accountability_logs (log_type, actor, message) values ('lain', 'uji', 'uji')"), /log_type_check/);
      await db.exec("rollback");
    });

    test("'referred' wajib punya urgensi, seperti voting, approved, dan done", async () => {
      await assert.rejects(
        db.exec(`update proposals set status = 'referred', urgency_score = null where id = '${U(1)}'`),
        /proposals_urgensi_wajib_setelah_forum/,
      );
      await db.exec("rollback");
    });
  });

  // ---------------------------------------------------------------------------
  describe("K-02 hak akses", () => {
    test("anon, authenticated, dan public tidak punya hak execute; service_role punya", async () => {
      for (const f of FUNGSI) {
        for (const peran of ["anon", "authenticated", "public"]) {
          const [r] = await baris<{ ok: boolean }>(db, `select has_function_privilege('${peran}', '${f}', 'execute') as ok`);
          assert.equal(r.ok, false, `${peran} masih boleh menjalankan ${f}`);
        }
        const [s] = await baris<{ ok: boolean }>(db, `select has_function_privilege('service_role', '${f}', 'execute') as ok`);
        assert.equal(s.ok, true, `service_role tidak boleh menjalankan ${f}`);
      }
    });

    test("anon benar-benar ditolak memanggil tetapkan_keputusan", async () => {
      await db.exec("set role anon");
      try {
        await assert.rejects(
          db.query("select tetapkan_keputusan($1, 2027, 1, 'x', current_date, 'x', '[]'::jsonb)", [AKUN.admin]),
          /permission denied/,
        );
      } finally {
        await db.exec("reset role");
      }
    });

    test("anon tidak melihat apa pun di tabel dan view baru", async () => {
      await db.exec("set role anon");
      try {
        for (const t of ["periode", "keputusan", "v_periode", "v_keputusan"]) {
          const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from ${t}`);
          assert.equal(rows[0].n, 0, `${t} terbaca oleh anon`);
        }
      } finally {
        await db.exec("reset role");
      }
    });

    test("view publik tidak memuat id akun atau data pribadi", async () => {
      const kolom = await baris<{ column_name: string }>(
        db,
        "select column_name from information_schema.columns where table_name in ('v_periode', 'v_keputusan')",
      );
      for (const { column_name: k } of kolom) assert.doesNotMatch(k, /akun|warga|nomor|hash/, `kolom ${k} tampak pribadi`);
    });

    test("hanya admin aktif: warga, akun tak dikenal, dan admin nonaktif ditolak oleh tiga fungsi", async () => {
      const h = await bacaHitungan(db);
      for (const [akun, kode] of [
        [AKUN.warga, "bukan_admin"],
        [TIDAK_ADA, "akun_tidak_aktif"],
        [AKUN.nonaktif, "akun_tidak_aktif"],
      ] as const) {
        assert.equal((await tetapkan(db, { akun })).kode, kode, `tetapkan oleh ${akun}`);
        assert.equal((await batalkan(db, { akun })).kode, kode, `batalkan oleh ${akun}`);
        assert.equal((await selesai(db, h.usulan[0].id, "approved", undefined, null, akun)).kode, kode, `selesai oleh ${akun}`);
      }
      // Tidak ada yang berubah.
      assert.equal(await angka(db, "select count(*) as n from keputusan where tahun = 2027"), 0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("hitungan dan sidik", () => {
    test("sidik_hitungan memuat pagu, bobot, dan tujuh usulan menurut peringkat", async () => {
      const h = await bacaHitungan(db);
      assert.equal(h.pagu, 300 * JT);
      assert.equal(h.jumlah, 7);
      assert.deepEqual(h.usulan.map((u) => u.peringkat), [1, 2, 3, 4, 5, 6, 7]);
      assert.equal(h.usulan.filter((u) => u.terpilih).length, 4);
      assert.equal(h.usulan[0].nama_singkat, "Talud");
      assert.equal(h.usulan[0].status, "ditunda");
    });

    test("sidik stabil, dan tidak berubah saat dukungan bergerak asalkan rekomendasinya sama", async () => {
      await transaksi(db, async () => {
        const sebelum = await bacaHitungan(db);
        assert.equal((await bacaHitungan(db)).sidik, sebelum.sidik);
        // Satu dukungan tambahan untuk Lampu PJU (warga nomor 1): rekomendasi tetap.
        await db.exec(`insert into votes (proposal_id, warga_id)
                       select p.id, w.id from proposals p, warga w where p.title = 'Lampu PJU jalan setapak RW 07' and w.nomor = 1`);
        const sesudah = await bacaHitungan(db);
        assert.deepEqual(sesudah.usulan.map((u) => u.status), sebelum.usulan.map((u) => u.status));
        assert.equal(sesudah.sidik, sebelum.sidik);
        assert.equal(sesudah.usulan.find((u) => u.nama_singkat === "Lampu PJU")!.dukungan, sebelum.usulan.find((u) => u.nama_singkat === "Lampu PJU")!.dukungan + 1);
      });
    });

    test("sidik berubah bila pagu, versi bobot, atau status rekomendasi berubah", async () => {
      await transaksi(db, async () => {
        const awal = (await bacaHitungan(db)).sidik;
        await db.exec("update pengaturan_anggaran set pagu = 310000000");
        const sidikPagu = (await bacaHitungan(db)).sidik;
        assert.notEqual(sidikPagu, awal);
        await db.exec("update scoring_weights set versi = versi + 1");
        assert.notEqual((await bacaHitungan(db)).sidik, sidikPagu);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("K-06 status rekomendasi sama dengan statusUsulan di TypeScript", () => {
    const KOMBINASI: { pagu: number; bobot: Bobot }[] = [
      { pagu: 300 * JT, bobot: { popularitas: 30, urgensi: 40, pemerataan: 30 } },
      { pagu: 505 * JT, bobot: { popularitas: 30, urgensi: 40, pemerataan: 30 } },
      { pagu: 280 * JT, bobot: { popularitas: 30, urgensi: 40, pemerataan: 30 } },
      { pagu: 300 * JT, bobot: { popularitas: 100, urgensi: 0, pemerataan: 0 } },
      { pagu: 150 * JT, bobot: { popularitas: 0, urgensi: 100, pemerataan: 0 } },
      { pagu: 400 * JT, bobot: { popularitas: 20, urgensi: 20, pemerataan: 60 } },
      { pagu: 100 * JT, bobot: { popularitas: 10, urgensi: 30, pemerataan: 60 } },
      { pagu: 30 * JT, bobot: { popularitas: 30, urgensi: 40, pemerataan: 30 } }, // tidak ada yang muat
      { pagu: 900 * JT, bobot: { popularitas: 50, urgensi: 25, pemerataan: 25 } }, // semua muat
    ];

    for (const { pagu, bobot } of KOMBINASI) {
      test(`pagu Rp ${pagu / JT} juta, bobot ${bobot.popularitas}/${bobot.urgensi}/${bobot.pemerataan}`, async () => {
        await transaksi(db, async () => {
          await db.query("update scoring_weights set w_popularitas = $1, w_urgensi = $2, w_pemerataan = $3", [
            bobot.popularitas,
            bobot.urgensi,
            bobot.pemerataan,
          ]);
          const voting = await baris<{ id: string; title: string; nama_singkat: string; category: string; rw: number; estimated_budget: string; vote_count: number; urgency_score: number }>(
            db,
            `select id, title, nama_singkat, category, rw, estimated_budget::text, vote_count, urgency_score
               from v_usulan where status = 'voting' and disembunyikan_pada is null order by created_at, id`,
          );
          const usulan: Usulan[] = voting.map((u) => ({
            id: u.id, title: u.title, namaSingkat: u.nama_singkat, category: u.category, rw: u.rw,
            estimatedBudget: Number(u.estimated_budget), voteCount: u.vote_count, urgencyScore: u.urgency_score,
          }));
          const wilayah = (await baris<{ rw: number; nama: string; penduduk: number; anggaran_lalu: string }>(db, "select rw, nama, penduduk, anggaran_lalu::text from wilayah order by rw")).map(
            (w): Wilayah => ({ rw: w.rw, nama: w.nama, penduduk: w.penduduk, anggaranLalu: Number(w.anggaran_lalu) }),
          );

          const ts = statusUsulan(pilihOptimal(usulan, wilayah, pagu, bobot), "skor");
          const sql = await baris<{ peringkat: number; id: string; status: string; terpilih: boolean; skor: string }>(
            db,
            "select peringkat, id, status, terpilih, skor::text from hitungan_dengan_status($1)",
            pagu,
          );

          assert.equal(sql.length, ts.length);
          for (const t of ts) {
            const s = sql.find((x) => x.id === t.id);
            assert.ok(s, `usulan ${t.namaSingkat} tidak ada di SQL`);
            assert.equal(s.peringkat, t.peringkat, `peringkat ${t.namaSingkat}`);
            assert.equal(s.status, t.status, `status ${t.namaSingkat}`);
            assert.equal(s.terpilih, t.selected, `terpilih ${t.namaSingkat}`);
            assert.equal(Number(s.skor), t.skor, `skor ${t.namaSingkat}`);
          }
        });
      });
    }

    test("keempat status muncul di salah satu kombinasi (ditunda dan tidak-terpilih benar-benar diuji)", async () => {
      const status = new Set<string>();
      for (const pagu of [300 * JT, 505 * JT, 150 * JT]) {
        for (const r of await baris<{ status: string }>(db, "select status from hitungan_dengan_status($1)", pagu)) status.add(r.status);
      }
      assert.deepEqual([...status].sort(), ["ditunda", "terpilih", "tidak-terpilih"]);
    });
  });

  // ---------------------------------------------------------------------------
  describe("K-03 aturan penetapan ditegakkan di database", () => {
    const gagal = async (o: OpsiTetapkan, kode: string, bidang?: string) => {
      await transaksi(db, async () => {
        const r = await tetapkan(db, o);
        assert.equal(r.ok, false);
        assert.equal(r.kode, kode, JSON.stringify(r));
        if (bidang) assert.equal(r.bidang, bidang, JSON.stringify(r));
        // Tidak ada yang berubah setelah penolakan.
        assert.equal(await angka(db, "select count(*) as n from keputusan where tahun = 2027"), 0);
        assert.equal(await angka(db, "select count(*) as n from proposals where status in ('approved', 'referred')"), 0);
        assert.equal((await baris<{ status: string }>(db, "select status from periode where tahun = 2027"))[0].status, "berjalan");
      });
    };

    test("tahun yang tidak ada", () => gagal({ tahun: 2040 }, "tidak_ditemukan"));
    test("periode yang sudah diputuskan (2026)", () => gagal({ tahun: 2026, versi: 1 }, "sudah_ditetapkan"));
    test("versi periode yang sudah berubah → bentrok", () => gagal({ versi: 99 }, "bentrok"));
    test("sidik yang sudah berubah → hitungan_berubah, memuat keadaan sekarang", async () => {
      await transaksi(db, async () => {
        const r = await tetapkan(db, { sidik: "sidik-lama" });
        assert.equal(r.kode, "hitungan_berubah");
        assert.equal(r.pagu, 300 * JT);
        assert.equal((r.usulan as unknown[]).length, 7);
      });
    });
    test("pagu diubah admin lain sesudah halaman dibuka → hitungan_berubah", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        await db.exec("update pengaturan_anggaran set pagu = pagu + 5000000, versi = versi + 1");
        assert.equal((await tetapkan(db, { sidik: h.sidik })).kode, "hitungan_berubah");
      });
    });
    test("bobot diubah sesudah halaman dibuka → hitungan_berubah", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        await db.exec("update scoring_weights set versi = versi + 1");
        assert.equal((await tetapkan(db, { sidik: h.sidik })).kode, "hitungan_berubah");
      });
    });

    test("tanggal musyawarah: kosong dan di masa depan ditolak, hari ini boleh", async () => {
      await gagal({ tanggal: null }, "tidak_valid", "tanggal");
      const [{ besok }] = await baris<{ besok: string }>(db, "select ((now() at time zone 'Asia/Jakarta')::date + 1)::text as besok");
      await gagal({ tanggal: besok }, "tidak_valid", "tanggal");
      await transaksi(db, async () => {
        const [{ hari_ini }] = await baris<{ hari_ini: string }>(db, "select (now() at time zone 'Asia/Jakarta')::date::text as hari_ini");
        assert.equal((await tetapkan(db, { tanggal: hari_ini })).ok, true);
      });
    });

    test("catatan musyawarah 20–1.000 karakter", async () => {
      await gagal({ catatan: "x".repeat(19) }, "tidak_valid", "catatan");
      await gagal({ catatan: "   " }, "tidak_valid", "catatan");
      await gagal({ catatan: "x".repeat(1001) }, "tidak_valid", "catatan");
      await transaksi(db, async () => {
        assert.equal((await tetapkan(db, { catatan: "x".repeat(20) })).ok, true);
      });
      await transaksi(db, async () => {
        assert.equal((await tetapkan(db, { catatan: "x".repeat(1000) })).ok, true);
      });
    });

    test("butir yang salah bentuk menghasilkan tidak_valid, bukan pengecualian", async () => {
      for (const butir of [
        null,
        "{}",
        '"teks"',
        "42",
        "[1, 2]",
        '[null]',
        '[{"id": 5, "hasil": "disetujui"}]',
        '[{"id": "x", "hasil": 7}]',
        '[{"hasil": "disetujui"}]',
        '[{"id": "6f1b3d0a-1001-4c8e-9a10-000000000001"}]',
        '[{"id": "6f1b3d0a-1001-4c8e-9a10-000000000001", "hasil": "ditolak", "alasan": 12345}]',
        '[{"id": "6f1b3d0a-1001-4c8e-9a10-000000000001", "hasil": "dana_lain", "sumber_dana": {"a": 1}}]',
        JSON.stringify(Array.from({ length: 65 }, () => ({ id: TIDAK_ADA, hasil: "disetujui" }))),
      ]) {
        await transaksi(db, async () => {
          const r = await tetapkan(db, { butir });
          assert.equal(r.kode, "tidak_valid", `butir ${String(butir).slice(0, 60)} → ${JSON.stringify(r)}`);
          assert.equal(r.bidang, "butir");
        });
      }
    });

    test("butir kurang → terlewat; ganda; asing (uuid lain atau bukan uuid)", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const sejalan = butirSejalan(h);
        assert.equal((await tetapkan(db, { butir: sejalan.slice(1) })).sebab, "terlewat");
        assert.equal((await tetapkan(db, { butir: [...sejalan, sejalan[0]] })).sebab, "ganda");
        assert.equal((await tetapkan(db, { butir: [...sejalan.slice(1), sejalan[1]] })).sebab, "ganda");
        assert.equal((await tetapkan(db, { butir: [...sejalan, { id: TIDAK_ADA, hasil: "dilanjutkan" }] })).sebab, "asing");
        assert.equal((await tetapkan(db, { butir: [...sejalan, { id: "bukan-uuid", hasil: "dilanjutkan" }] })).sebab, "asing");
        // Usulan forum (bukan bagian hitungan) tidak boleh ikut diputuskan.
        assert.equal((await tetapkan(db, { butir: [...sejalan, { id: U(2), hasil: "ditolak", alasan: ALASAN }] })).sebab, "asing");
        assert.equal((await tetapkan(db, { butir: [] })).sebab, "terlewat");
      });
    });

    test("butir dengan id huruf besar dibaca sama", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const butir = butirSejalan(h).map((b) => ({ ...b, id: b.id.toUpperCase() }));
        assert.equal((await tetapkan(db, { butir })).ok, true);
      });
    });

    test("hasil yang tidak dikenal ditolak dan menyebut barisnya", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const butir = butirSejalan(h);
        butir[2].hasil = "setuju";
        const r = await tetapkan(db, { butir });
        assert.equal(r.kode, "tidak_valid");
        assert.equal(r.id, butir[2].id);
        assert.equal(r.kolom, "hasil");
      });
    });

    test("alasan wajib: disetujui padahal tidak terpilih; tidak disetujui padahal terpilih; ditolak; dana lain", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const dasar = butirSejalan(h);
        const ubah = (nama: string, p: Partial<Butir>) => dasar.map((b) => (b.id === idDari(h, nama) ? { ...b, ...p } : b));

        // Balai warga tidak terpilih; disetujui tanpa alasan (Jembatan dilanjutkan supaya tidak melebihi pagu).
        const butir = ubah("Balai warga", { hasil: "disetujui" }).map((b) => (b.id === idDari(h, "Jembatan") ? { ...b, hasil: "dilanjutkan", alasan: ALASAN } : b));
        let r = await tetapkan(db, { butir });
        assert.equal(r.kode, "tidak_valid");
        assert.equal(r.id, idDari(h, "Balai warga"));
        assert.equal(r.kolom, "alasan");

        // Drainase terpilih; dilanjutkan tanpa alasan.
        r = await tetapkan(db, { butir: ubah("Drainase", { hasil: "dilanjutkan" }) });
        assert.equal(r.kolom, "alasan");
        assert.equal(r.id, idDari(h, "Drainase"));

        // Ditolak selalu butuh alasan, juga untuk usulan yang tidak terpilih.
        r = await tetapkan(db, { butir: ubah("Gapura", { hasil: "ditolak" }) });
        assert.equal(r.kolom, "alasan");
        assert.equal(r.id, idDari(h, "Gapura"));
        r = await tetapkan(db, { butir: ubah("Gapura", { hasil: "ditolak", alasan: "   " }) });
        assert.equal(r.kolom, "alasan");

        // Dana lain: alasan dan sumber dana.
        r = await tetapkan(db, { butir: ubah("Talud", { hasil: "dana_lain", sumber_dana: "Dana kebencanaan kabupaten" }) });
        assert.equal(r.kolom, "alasan");
        r = await tetapkan(db, { butir: ubah("Talud", { hasil: "dana_lain", alasan: ALASAN }) });
        assert.equal(r.kolom, "sumber_dana");
        assert.equal(r.id, idDari(h, "Talud"));
      });
    });

    test("batas panjang: alasan 20–500, sumber dana 3–80", async () => {
      const h = await bacaHitungan(db);
      const dasar = butirSejalan(h);
      const talud = idDari(h, "Talud");
      const dengan = (p: Partial<Butir>) => dasar.map((b) => (b.id === talud ? { ...b, hasil: "dana_lain", alasan: ALASAN, sumber_dana: "Dana desa", ...p } : b));
      const coba = async (butir: Butir[], kolom?: string) => {
        await transaksi(db, async () => {
          const r = await tetapkan(db, { butir });
          if (kolom) {
            assert.equal(r.kode, "tidak_valid", JSON.stringify(r));
            assert.equal(r.kolom, kolom);
          } else assert.equal(r.ok, true, JSON.stringify(r));
        });
      };
      await coba(dengan({ alasan: "a".repeat(19) }), "alasan");
      await coba(dengan({ alasan: "a".repeat(501) }), "alasan");
      await coba(dengan({ alasan: "a".repeat(20) }));
      await coba(dengan({ alasan: "a".repeat(500) }));
      await coba(dengan({ sumber_dana: "ab" }), "sumber_dana");
      await coba(dengan({ sumber_dana: "s".repeat(81) }), "sumber_dana");
      await coba(dengan({ sumber_dana: "abc" }));
      await coba(dengan({ sumber_dana: "s".repeat(80) }));
      // Alasan opsional yang diisi tetap dibatasi panjangnya (Jalan SDN 03 terpilih, disetujui).
      const jalan = idDari(h, "Jalan SDN 03");
      await coba(dasar.map((b) => (b.id === jalan ? { ...b, alasan: "pendek" } : b)), "alasan");
    });

    test("melebihi pagu ditolak dengan angka kelebihannya", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        // Semua disetujui: 695 juta; pagu 300 juta. Alasan diisi untuk yang tidak terpilih.
        const butir = h.usulan.map((u) => ({ id: u.id, hasil: "disetujui", alasan: u.terpilih ? null : ALASAN }));
        const total = h.usulan.reduce((n, u) => n + u.biaya, 0);
        const r = await tetapkan(db, { butir });
        assert.equal(r.kode, "melebihi_pagu");
        assert.equal(r.terpakai, total);
        assert.equal(r.kelebihan, total - 300 * JT);
      });
    });

    test("tepat sebesar pagu diterima", async () => {
      await transaksi(db, async () => {
        // Pagu Rp 285 juta = total empat usulan terpilih.
        await db.exec("update pengaturan_anggaran set pagu = 285000000, versi = versi + 1");
        const h = await bacaHitungan(db);
        assert.equal(h.usulan.filter((u) => u.terpilih).reduce((n, u) => n + u.biaya, 0), 285 * JT);
        const r = await tetapkan(db);
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.equal(r.sisa, 0);
      });
    });

    test("nol usulan dalam hitungan → tidak_ada_usulan", async () => {
      await transaksi(db, async () => {
        await db.exec("update proposals set status = 'forum', urgency_score = null, urgency_reason = null where status = 'voting'");
        const r = await tetapkan(db, { butir: [] });
        assert.equal(r.kode, "tidak_ada_usulan");
      });
    });

    test("usulan voting yang disembunyikan tidak ikut dihitung dan statusnya tetap", async () => {
      await transaksi(db, async () => {
        const h0 = await bacaHitungan(db);
        const talud = idDari(h0, "Talud");
        await db.query("select sembunyikan($1, 'usulan', $2, $3)", [AKUN.admin, talud, ALASAN]);
        const h = await bacaHitungan(db);
        assert.equal(h.jumlah, 6);
        assert.ok(!h.usulan.some((u) => u.id === talud));
        // Butir untuk usulan tersembunyi dianggap asing.
        assert.equal((await tetapkan(db, { butir: [...butirSejalan(h), { id: talud, hasil: "dilanjutkan" }] })).sebab, "asing");
        const r = await tetapkan(db);
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.equal((await baris<{ status: string }>(db, "select status from proposals where id = $1", talud))[0].status, "voting");
        assert.equal(await angka(db, "select count(*) as n from keputusan where proposal_id = $1", talud), 0);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("K-04 mengikuti rekomendasi sepenuhnya (pagu Rp 300 juta)", () => {
    test("terpakai Rp 285 juta, anggaran_lalu menjadi 0 / 85 juta / 200 juta, periode 2028 terbuka", async () => {
      await transaksi(db, async () => {
        const r = await tetapkan(db);
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.equal(r.terpakai, 285 * JT);
        assert.equal(r.sisa, 15 * JT);
        assert.equal(r.disetujui, 4);
        assert.equal(r.dilanjutkan, 3);
        assert.equal(r.berbeda, 0);
        assert.equal(r.tahun_berikut, 2028);

        const w = await baris<{ rw: number; a: string }>(db, "select rw, anggaran_lalu::text as a from wilayah order by rw");
        assert.deepEqual(w, [
          { rw: 1, a: "0" },
          { rw: 3, a: String(85 * JT) },
          { rw: 7, a: String(200 * JT) },
        ]);

        const p = await baris<{ tahun: number; status: string }>(db, "select tahun, status from periode order by tahun");
        assert.deepEqual(p, [
          { tahun: 2026, status: "diputuskan" },
          { tahun: 2027, status: "diputuskan" },
          { tahun: 2028, status: "berjalan" },
        ]);

        const st = await baris<{ status: string; n: number }>(db, "select status, count(*)::int as n from proposals group by status order by status");
        assert.deepEqual(st, [
          { status: "approved", n: 4 },
          { status: "done", n: 3 },
          { status: "forum", n: 6 },
          { status: "rejected", n: 1 },
          { status: "voting", n: 3 },
        ]);
      });
    });

    test("periode dicatat lengkap: tanggal, catatan, pagu, bobot, pencatat", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        const [p] = await baris<{
          status: string; tanggal_musyawarah: string; catatan: string; pagu: string; bobot: Record<string, number>;
          ada_rekomendasi: boolean; diputuskan_oleh: string; wilayah_sebelum: Record<string, number>; versi: number;
        }>(db, "select status, tanggal_musyawarah::text, catatan, pagu::text, bobot, ada_rekomendasi, diputuskan_oleh, wilayah_sebelum, versi from periode where tahun = 2027");
        assert.equal(p.tanggal_musyawarah, TANGGAL);
        assert.equal(p.catatan, CATATAN);
        assert.equal(p.pagu, String(300 * JT));
        assert.deepEqual(p.bobot, { popularitas: 30, urgensi: 40, pemerataan: 30 });
        assert.equal(p.ada_rekomendasi, true);
        assert.equal(p.diputuskan_oleh, "uji-admin");
        assert.deepEqual(p.wilayah_sebelum, { "1": 250 * JT, "3": 60 * JT, "7": 0 });
        assert.equal(p.versi, 2);
      });
    });

    test("alasan otomatis dari potret angka untuk keputusan yang sejalan dan tanpa alasan tertulis", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        const r = await baris<{ judul: string; hasil: string; alasan: string }>(db, "select judul, hasil, alasan from v_keputusan where tahun = 2027 order by peringkat");
        assert.equal(r.length, 7);
        for (const k of r) {
          assert.match(k.alasan, /^Mengikuti rekomendasi: (belum terbiayai, )?peringkat \d dari 7, skor \d{1,2},\d\.$/, k.alasan);
        }
        assert.match(r.find((k) => k.hasil === "disetujui")!.alasan, /^Mengikuti rekomendasi: peringkat/);
        assert.match(r.find((k) => k.hasil === "dilanjutkan")!.alasan, /^Mengikuti rekomendasi: belum terbiayai, peringkat/);
      });
    });

    test("kalimat otomatis sama persis dengan kalimatSejalan di TypeScript, dan jawaban sidik_hitungan terurai", async () => {
      await transaksi(db, async () => {
        const h = uraiHitungan(await panggil(db, "sidik_hitungan()"));
        assert.equal(h.usulan.length, 7);
        await tetapkan(db);
        for (const u of h.usulan) {
          const [k] = await baris<{ alasan: string }>(db, "select alasan from v_keputusan where proposal_id = $1", u.id);
          assert.equal(k.alasan, kalimatSejalan(u, h.usulan.length), u.namaSingkat);
        }
      });
    });

    test("jejak publik: satu ringkasan (terbaru) dan satu catatan per usulan, memuat nama admin", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        const log = await baris<{ log_type: string; proposal_id: string | null; actor: string; message: string; detail: Record<string, unknown> }>(
          db,
          "select log_type, proposal_id, actor, message, detail from accountability_logs where log_type = 'decision' order by created_at desc, id desc",
        );
        assert.equal(log.length, 8);
        assert.equal(log[0].proposal_id, null, "ringkasan harus paling atas");
        assert.equal(log[0].actor, "uji-admin");
        assert.match(log[0].message, /Tahun Anggaran 2027: 4 disetujui, 0 diajukan ke dana lain, 3 dibawa ke periode berikutnya, 0 ditolak\./);
        assert.match(log[0].message, /Terpakai Rp 285\.000\.000 dari pagu Rp 300\.000\.000, sisa Rp 15\.000\.000\. 0 keputusan berbeda/);
        assert.equal(log[0].detail.terpakai, 285 * JT);
        assert.equal(log.filter((l) => l.proposal_id !== null).length, 7);
        assert.ok(log.every((l) => l.actor === "uji-admin"));
      });
    });
  });

  describe("keputusan yang berbeda dari rekomendasi", () => {
    // Drainase (terpilih) ditolak, Jembatan (terpilih) dilanjutkan, Balai warga (tidak terpilih) disetujui.
    const skenario = (h: Hitungan): Butir[] => {
      const nama = (u: BarisHitungan) => u.nama_singkat;
      return h.usulan.map((u) => {
        switch (nama(u)) {
          case "Drainase": return { id: u.id, hasil: "ditolak", alasan: "Lokasi drainase ternyata di tanah sengketa, jadi tidak bisa dikerjakan tahun ini." };
          case "Jembatan": return { id: u.id, hasil: "dilanjutkan", alasan: "Warga meminta rancangan jembatan diperbaiki lebih dulu bersama dinas." };
          case "Balai warga": return { id: u.id, hasil: "disetujui", alasan: "Balai warga dipakai untuk posyandu dan pertemuan, kerusakan atapnya mendesak." };
          case "Talud": return { id: u.id, hasil: "dana_lain", alasan: "Biaya terlalu besar untuk dana desa dan risikonya tinggi.", sumber_dana: "Dana kebencanaan kabupaten" };
          default: return { id: u.id, hasil: u.terpilih ? "disetujui" : "dilanjutkan" };
        }
      });
    };

    test("beda_dari_rekomendasi, status baru, dan sumber dana", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const r = await tetapkan(db, { butir: skenario(h) });
        assert.equal(r.ok, true, JSON.stringify(r));
        // Jalan 85 + Lampu 40 + Balai 110 = 235 juta.
        assert.equal(r.terpakai, 235 * JT);
        assert.equal(r.disetujui, 3);
        assert.equal(r.dana_lain, 1);
        assert.equal(r.dilanjutkan, 2);
        assert.equal(r.ditolak, 1);
        assert.equal(r.berbeda, 3);

        const k = await baris<{ judul: string; hasil: string; beda_dari_rekomendasi: boolean; sumber_dana: string | null; status_rekomendasi: string }>(
          db,
          "select judul, hasil, beda_dari_rekomendasi, sumber_dana, status_rekomendasi from v_keputusan where tahun = 2027 order by peringkat",
        );
        const beda = k.filter((x) => x.beda_dari_rekomendasi).map((x) => x.hasil).sort();
        assert.deepEqual(beda, ["disetujui", "ditolak", "dilanjutkan"].sort());
        const talud = k.find((x) => x.judul.startsWith("Talud"))!;
        assert.equal(talud.hasil, "dana_lain");
        assert.equal(talud.sumber_dana, "Dana kebencanaan kabupaten");
        assert.equal(talud.beda_dari_rekomendasi, false, "Talud tidak terpilih; tidak disetujui = sejalan");
        assert.equal(k.filter((x) => x.hasil !== "dana_lain").every((x) => x.sumber_dana === null), true);

        const st = await baris<{ title: string; status: string }>(db, "select title, status from proposals where id in (select proposal_id from keputusan where tahun = 2027) order by title");
        const peta = Object.fromEntries(st.map((s) => [s.title.split(" ")[0], s.status]));
        assert.equal(peta.Talud, "referred");
        assert.equal(peta.Normalisasi, "rejected");
        assert.equal(peta.Jembatan, "voting");
        assert.equal(peta.Pengecatan, "approved");

        // anggaran_lalu: hanya yang disetujui; dana_lain tidak dihitung. RW 01 (Balai) 110 juta, RW 03 (Jalan) 85, RW 07 (Lampu) 40.
        const w = await baris<{ rw: number; a: string }>(db, "select rw, anggaran_lalu::text as a from wilayah order by rw");
        assert.deepEqual(w.map((x) => x.a), [String(110 * JT), String(85 * JT), String(40 * JT)]);
      });
    });

    test("ringkasan di v_periode: jumlah tiap hasil, terpakai, dan jumlah yang berbeda", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        await tetapkan(db, { butir: skenario(h) });
        const [p] = await baris<Record<string, unknown>>(db, "select jumlah_disetujui, jumlah_dana_lain, jumlah_dilanjutkan, jumlah_ditolak, jumlah_beda, terpakai::text as terpakai from v_periode where tahun = 2027");
        assert.deepEqual(p, { jumlah_disetujui: 3, jumlah_dana_lain: 1, jumlah_dilanjutkan: 2, jumlah_ditolak: 1, jumlah_beda: 3, terpakai: String(235 * JT) });
      });
    });

    test("alasan tertulis tersimpan apa adanya dan masuk jejak per usulan", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        await tetapkan(db, { butir: skenario(h) });
        const [k] = await baris<{ alasan: string }>(db, "select alasan from v_keputusan where tahun = 2027 and judul like 'Normalisasi%'");
        assert.match(k.alasan, /tanah sengketa/);
        const log = await baris<{ message: string }>(db, "select message from accountability_logs where proposal_id = $1 and log_type = 'decision'", idDari(h, "Talud"));
        assert.equal(log.length, 1);
        assert.match(log[0].message, /diajukan ke dana lain \(Dana kebencanaan kabupaten\)\. Biaya terlalu besar/);
      });
    });

    test("alasan dan sumber dana dipangkas spasinya", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const butir = skenario(h).map((b) => (b.hasil === "dana_lain" ? { ...b, sumber_dana: "   Dana desa  ", alasan: `  ${b.alasan}  ` } : b));
        await tetapkan(db, { butir });
        const [k] = await baris<{ alasan: string; sumber_dana: string }>(db, "select alasan, sumber_dana from v_keputusan where tahun = 2027 and hasil = 'dana_lain'");
        assert.equal(k.sumber_dana, "Dana desa");
        assert.equal(k.alasan, k.alasan.trim());
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("K-05 potret tidak berubah", () => {
    test("dukungan, bobot, dan pagu yang berubah sesudahnya tidak mengubah keputusan yang sudah ditetapkan", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        const baca = () => baris(db, "select tahun, proposal_id, hasil, peringkat, jumlah_usulan, skor::text, status_rekomendasi, biaya::text, dukungan, urgensi, rw, judul, nama_singkat from keputusan order by tahun, id");
        const [periodeSebelum] = await baris(db, "select pagu::text, bobot, wilayah_sebelum from periode where tahun = 2027");
        const sebelum = JSON.stringify(await baca());

        await db.exec(`insert into votes (proposal_id, warga_id)
                       select p.id, w.id from proposals p, warga w where p.title like 'Gapura%' and w.nomor in (61, 62, 63, 64, 65, 66)
                       on conflict do nothing`);
        await db.query("select ubah_pagu($1, 450000000, (select versi from pengaturan_anggaran), $2)", [AKUN.admin, ALASAN]);
        await db.query("select ubah_bobot($1, 60, 20, 20, (select versi from scoring_weights), $2)", [AKUN.admin, ALASAN]);
        await db.exec("update proposals set title = 'Judul diubah sesudahnya' where title like 'Jembatan%'");

        assert.equal(JSON.stringify(await baca()), sebelum);
        assert.deepEqual(await baris(db, "select pagu::text, bobot, wilayah_sebelum from periode where tahun = 2027"), [periodeSebelum]);
      });
    });

    test("potret menyimpan peringkat, skor, status, biaya, dukungan, urgensi, RW, dan judul saat itu", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        await tetapkan(db);
        const k = await baris<{ proposal_id: string; peringkat: number; jumlah_usulan: number; skor: string; status_rekomendasi: string; biaya: string; dukungan: number; urgensi: number; rw: number; judul: string }>(
          db,
          "select proposal_id, peringkat, jumlah_usulan, skor::text, status_rekomendasi, biaya::text, dukungan, urgensi, rw, judul from keputusan where tahun = 2027 order by peringkat",
        );
        assert.equal(k.length, 7);
        for (const [i, u] of h.usulan.entries()) {
          assert.equal(k[i].proposal_id, u.id);
          assert.equal(k[i].peringkat, u.peringkat);
          assert.equal(k[i].jumlah_usulan, 7);
          assert.equal(Number(k[i].skor), u.skor);
          assert.equal(k[i].status_rekomendasi, u.status);
          assert.equal(Number(k[i].biaya), u.biaya);
          assert.equal(k[i].dukungan, u.dukungan);
          assert.equal(k[i].urgensi, u.urgensi);
          assert.equal(k[i].rw, u.rw);
          assert.equal(k[i].judul, u.judul);
        }
      });
    });

    test("v_keputusan mengosongkan judul bila usulannya kelak disembunyikan; potret di tabel tetap utuh", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        await tetapkan(db);
        const drainase = idDari(h, "Drainase");
        await db.query("select sembunyikan($1, 'usulan', $2, $3)", [AKUN.admin, drainase, ALASAN]);
        const [k] = await baris<{ judul: string | null; nama_singkat: string | null }>(db, "select judul, nama_singkat from v_keputusan where proposal_id = $1", drainase);
        assert.equal(k.judul, null);
        assert.equal(k.nama_singkat, null);
        const [t] = await baris<{ judul: string }>(db, "select judul from keputusan where proposal_id = $1", drainase);
        assert.match(t.judul, /Normalisasi drainase/);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("K-08 dua penetapan bersamaan: hanya satu yang berhasil", () => {
    test("yang kedua dengan versi yang sama ditolak dan menyebut siapa dan kapan", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const [{ versi }] = await baris<{ versi: number }>(db, "select versi from periode where tahun = 2027");
        const a = await tetapkan(db, { versi, sidik: h.sidik, akun: AKUN.admin });
        const b = await tetapkan(db, { versi, sidik: h.sidik, akun: AKUN.admin2 });
        assert.equal(a.ok, true);
        assert.equal(b.ok, false);
        assert.equal(b.kode, "sudah_ditetapkan");
        assert.equal(b.oleh, "uji-admin");
        assert.ok(b.pada);
        assert.equal(b.tahun, 2027);
        assert.equal(await angka(db, "select count(*) as n from keputusan where tahun = 2027"), 7);
      });
    });

    test("halaman lama setelah penetapan dibatalkan dan dibuka lagi → bentrok (versi tidak dipakai ulang)", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const [{ versi: lama }] = await baris<{ versi: number }>(db, "select versi from periode where tahun = 2027");
        assert.equal((await tetapkan(db)).ok, true);
        assert.equal((await batalkan(db)).ok, true);
        const [{ versi: baru }] = await baris<{ versi: number }>(db, "select versi from periode where tahun = 2027");
        assert.ok(baru > lama);
        const r = await tetapkan(db, { versi: lama, sidik: h.sidik });
        assert.equal(r.kode, "bentrok");
        assert.equal(r.versi, baru);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("K-07 pembatalan", () => {
    test("batal dalam 24 jam memulihkan semua keadaan persis, juga untuk keputusan yang beragam", async () => {
      await transaksi(db, async () => {
        const sebelum = await potret(db);
        const h = await bacaHitungan(db);
        const butir = h.usulan.map((u): Butir => {
          if (u.nama_singkat === "Drainase") return { id: u.id, hasil: "ditolak", alasan: ALASAN };
          if (u.nama_singkat === "Talud") return { id: u.id, hasil: "dana_lain", alasan: ALASAN, sumber_dana: "Dana kebencanaan kabupaten" };
          return { id: u.id, hasil: u.terpilih ? "disetujui" : "dilanjutkan" };
        });
        const t = await tetapkan(db, { butir });
        assert.equal(t.ok, true, JSON.stringify(t));
        assert.notDeepEqual(await potret(db), sebelum);

        const r = await batalkan(db);
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.equal(r.dipulihkan, 5); // Drainase (ditolak), Talud (dana lain), Jalan, Jembatan, Lampu (disetujui)
        assert.deepEqual(await potret(db), sebelum);
        assert.equal(await angka(db, "select count(*) as n from periode where tahun = 2028"), 0);
      });
    });

    test("catatan lama tidak dihapus: keputusan ditandai batal, dan pembatalan masuk jejak publik", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        assert.equal((await batalkan(db, { alasan: "Hasil rapat ternyata keliru dicatat." })).ok, true);
        assert.equal(await angka(db, "select count(*) as n from keputusan where tahun = 2027"), 7);
        assert.equal(await angka(db, "select count(*) as n from keputusan where tahun = 2027 and dibatalkan_pada is not null"), 7);
        assert.equal(await angka(db, "select count(*) as n from v_keputusan where tahun = 2027"), 0);
        const [p] = await baris<{ status: string; jumlah_disetujui: number; terpakai: string }>(db, "select status, jumlah_disetujui, terpakai::text from v_periode where tahun = 2027");
        assert.deepEqual(p, { status: "berjalan", jumlah_disetujui: 0, terpakai: "0" });

        const [ringkasan] = await baris<{ message: string; detail: Record<string, unknown>; actor: string }>(
          db,
          "select message, detail, actor from accountability_logs where proposal_id is null and detail->>'aksi' = 'batal'",
        );
        assert.match(ringkasan.message, /Penetapan keputusan Tahun Anggaran 2027 dibatalkan\. Alasan: Hasil rapat ternyata keliru dicatat\./);
        assert.equal(ringkasan.detail.catatan_lama, CATATAN);
        assert.equal(ringkasan.actor, "uji-admin");
        // Catatan penetapannya sendiri juga masih ada di jejak.
        assert.equal(await angka(db, "select count(*) as n from accountability_logs where log_type = 'decision' and proposal_id is null"), 2);
      });
    });

    test("bisa ditetapkan lagi setelah dibatalkan, dengan keputusan baru dan catatan lama tetap tersimpan", async () => {
      await transaksi(db, async () => {
        assert.equal((await tetapkan(db)).ok, true);
        assert.equal((await batalkan(db)).ok, true);
        const r = await tetapkan(db);
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.equal(await angka(db, "select count(*) as n from keputusan where tahun = 2027"), 14);
        assert.equal(await angka(db, "select count(*) as n from v_keputusan where tahun = 2027"), 7);
        assert.deepEqual(
          (await baris<{ anggaran_lalu: string }>(db, "select anggaran_lalu::text from wilayah order by rw")).map((x) => x.anggaran_lalu),
          ["0", String(85 * JT), String(200 * JT)],
        );
      });
    });

    test("lewat 24 jam → ditolak", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        await db.exec("update periode set diputuskan_pada = now() - interval '25 hours' where tahun = 2027");
        const r = await batalkan(db);
        assert.equal(r.kode, "lewat_batas");
        assert.equal((await baris<{ status: string }>(db, "select status from periode where tahun = 2027"))[0].status, "diputuskan");
      });
    });

    test("tepat sebelum 24 jam masih boleh", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        await db.exec("update periode set diputuskan_pada = now() - interval '23 hours 59 minutes' where tahun = 2027");
        assert.equal((await batalkan(db)).ok, true);
      });
    });

    test("sudah ada usulan yang 'done' → ditolak, juga untuk yang diajukan ke dana lain", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const jalan = idDari(h, "Jalan SDN 03");
        await tetapkan(db);
        assert.equal((await selesai(db, jalan, "approved")).ok, true);
        assert.equal((await batalkan(db)).kode, "sudah_dikerjakan");
        assert.equal((await baris<{ status: string }>(db, "select status from proposals where id = $1", jalan))[0].status, "done");
      });
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const talud = idDari(h, "Talud");
        const butir = butirSejalan(h).map((b) => (b.id === talud ? { ...b, hasil: "dana_lain", alasan: ALASAN, sumber_dana: "Dana kebencanaan kabupaten" } : b));
        await tetapkan(db, { butir });
        assert.equal((await selesai(db, talud, "referred")).ok, true);
        assert.equal((await batalkan(db)).kode, "sudah_dikerjakan");
      });
    });

    test("hanya penetapan terakhir yang bisa dibatalkan", async () => {
      await transaksi(db, async () => {
        assert.equal((await tetapkan(db)).ok, true);
        // 2028: tiga usulan yang dibawa ke periode ini; semuanya dilanjutkan lagi.
        const h = await bacaHitungan(db);
        assert.equal(h.jumlah, 3);
        const t2 = await tetapkan(db, { tahun: 2028, butir: h.usulan.map((u) => ({ id: u.id, hasil: u.terpilih ? "disetujui" : "dilanjutkan" })) });
        assert.equal(t2.ok, true, JSON.stringify(t2));
        assert.equal((await batalkan(db, { tahun: 2027 })).kode, "bukan_terakhir");
        assert.equal((await batalkan(db, { tahun: 2028 })).ok, true);
        // Sesudah 2028 dibatalkan, 2027 kembali menjadi yang terakhir.
        assert.equal((await batalkan(db, { tahun: 2027 })).ok, true);
      });
    });

    test("periode yang belum diputuskan atau tidak ada tidak bisa dibatalkan", async () => {
      assert.equal((await batalkan(db, { tahun: 2027 })).kode, "tidak_bisa_dibatalkan");
      assert.equal((await batalkan(db, { tahun: 2040 })).kode, "tidak_ditemukan");
    });

    test("alasan pembatalan 10–500 karakter", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        assert.equal((await batalkan(db, { alasan: "pendek" })).bidang, "alasan");
        assert.equal((await batalkan(db, { alasan: "x".repeat(501) })).bidang, "alasan");
        assert.equal((await batalkan(db, { alasan: "x".repeat(10) })).ok, true);
      });
    });

    test("batas 16 voting: pembatalan ditolak bila periode baru sudah menerima terlalu banyak usulan", async () => {
      await transaksi(db, async () => {
        await tetapkan(db);
        // 3 usulan 'dilanjutkan' sudah di hitungan. Tambah 10 lagi: 13. Pembatalan mengembalikan 4: 17 > 16.
        await db.exec(`
          insert into proposals (title, nama_singkat, description, category, estimated_budget, status, source, rw, urgency_score, urgency_reason)
          select 'Usulan tambahan nomor ' || n, 'Tambahan ' || n, 'Usulan tambahan untuk menguji batas hitungan anggaran.', 'infrastruktur', 5000000, 'voting', 'musrenbang', 1, 5, 'Uji batas.'
            from generate_series(1, 10) n`);
        const r = await batalkan(db);
        assert.equal(r.kode, "batas_voting");
        assert.equal(r.jumlah, 17);
        assert.equal(r.batas, 16);
        assert.equal((await baris<{ status: string }>(db, "select status from periode where tahun = 2027"))[0].status, "diputuskan");

        // Jalan keluar: kembalikan satu usulan ke pembahasan, lalu batalkan.
        await db.exec("update proposals set status = 'forum', urgency_score = null, urgency_reason = null where title = 'Usulan tambahan nomor 1'");
        assert.equal((await batalkan(db)).ok, true);
        assert.equal(await angka(db, "select count(*) as n from proposals where status = 'voting' and disembunyikan_pada is null"), 16);
      });
    });

    test("usulan tersembunyi yang dikembalikan tidak dihitung dalam batas 16", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        await tetapkan(db);
        await db.query("select sembunyikan($1, 'usulan', $2, $3)", [AKUN.admin, idDari(h, "Drainase"), ALASAN]);
        const r = await batalkan(db);
        assert.equal(r.ok, true);
        assert.equal(r.dipulihkan, 3);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("menandai selesai", () => {
    test("approved → done dengan catatan dan biaya realisasi; referred → done tanpa biaya", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const talud = idDari(h, "Talud");
        const jalan = idDari(h, "Jalan SDN 03");
        const butir = butirSejalan(h).map((b) => (b.id === talud ? { ...b, hasil: "dana_lain", alasan: ALASAN, sumber_dana: "Dana kebencanaan kabupaten" } : b));
        await tetapkan(db, { butir });

        const a = await selesai(db, jalan, "approved", "Jalan sudah diaspal dan dicek bersama ketua RW.", 83_500_000);
        assert.equal(a.ok, true, JSON.stringify(a));
        const [p] = await baris<{ status: string; catatan_selesai: string; biaya_realisasi: string; selesai_pada: string }>(db, "select status, catatan_selesai, biaya_realisasi::text, selesai_pada::text from proposals where id = $1", jalan);
        assert.equal(p.status, "done");
        assert.equal(p.catatan_selesai, "Jalan sudah diaspal dan dicek bersama ketua RW.");
        assert.equal(p.biaya_realisasi, "83500000");
        assert.ok(p.selesai_pada);

        const b = await selesai(db, talud, "referred");
        assert.equal(b.ok, true, JSON.stringify(b));
        const [q] = await baris<{ status: string; biaya_realisasi: string | null }>(db, "select status, biaya_realisasi::text from proposals where id = $1", talud);
        assert.deepEqual(q, { status: "done", biaya_realisasi: null });

        const [l] = await baris<{ message: string; actor: string; log_type: string }>(db, "select message, actor, log_type from accountability_logs where proposal_id = $1 order by id desc limit 1", jalan);
        assert.equal(l.log_type, "status_change");
        assert.match(l.message, /selesai dikerjakan\. Biaya realisasi Rp 83\.500\.000\. Catatan: Jalan sudah diaspal/);
        assert.equal(l.actor, "uji-admin");

        // v_keputusan membawa status dan catatan selesai ke halaman publik.
        const [v] = await baris<{ status_sekarang: string; catatan_selesai: string; biaya_realisasi: string }>(db, "select status_sekarang, catatan_selesai, biaya_realisasi::text from v_keputusan where proposal_id = $1", jalan);
        assert.equal(v.status_sekarang, "done");
        assert.equal(v.biaya_realisasi, "83500000");
      });
    });

    test("aturan: catatan 10–500, biaya positif, status dibaca harus cocok, hanya approved dan referred", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const jalan = idDari(h, "Jalan SDN 03");
        const gapura = idDari(h, "Gapura");
        await tetapkan(db);

        assert.equal((await selesai(db, jalan, "approved", "pendek")).bidang, "catatan");
        assert.equal((await selesai(db, jalan, "approved", "x".repeat(501))).bidang, "catatan");
        assert.equal((await selesai(db, jalan, "approved", undefined, 0)).bidang, "biaya_realisasi");
        assert.equal((await selesai(db, jalan, "approved", undefined, -5)).bidang, "biaya_realisasi");
        assert.equal((await selesai(db, jalan, "voting")).kode, "bentrok");
        assert.equal((await selesai(db, jalan, "referred")).kode, "bentrok");
        // Gapura 'dilanjutkan' tetap voting: belum ada yang bisa "selesai".
        const g = await selesai(db, gapura, "voting");
        assert.equal(g.kode, "transisi_tidak_diizinkan");
        assert.equal((await selesai(db, U(1), "forum")).kode, "transisi_tidak_diizinkan");
        assert.equal((await selesai(db, TIDAK_ADA, "approved")).kode, "tidak_ditemukan");
        // Dua kali: yang kedua tahu statusnya sudah berubah.
        assert.equal((await selesai(db, jalan, "approved")).ok, true);
        assert.equal((await selesai(db, jalan, "approved")).kode, "bentrok");
        assert.equal((await baris<{ status: string }>(db, "select status from proposals where id = $1", jalan))[0].status, "done");
      });
    });

    test("usulan yang disembunyikan tidak bisa ditandai selesai", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const jalan = idDari(h, "Jalan SDN 03");
        await tetapkan(db);
        await db.query("select sembunyikan($1, 'usulan', $2, $3)", [AKUN.admin, jalan, ALASAN]);
        assert.equal((await selesai(db, jalan, "approved")).kode, "disembunyikan");
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("aturan dukungan dan transisi lain tidak berubah", () => {
    test("usulan 'referred' dan 'approved' menolak dukungan (ditutup), seperti sebelumnya", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const talud = idDari(h, "Talud");
        const jalan = idDari(h, "Jalan SDN 03");
        const butir = butirSejalan(h).map((b) => (b.id === talud ? { ...b, hasil: "dana_lain", alasan: ALASAN, sumber_dana: "Dana kebencanaan kabupaten" } : b));
        await tetapkan(db, { butir });
        assert.equal((await panggil(db, "dukung_usulan($1, $2)", AKUN.warga, talud)).kode, "ditutup");
        assert.equal((await panggil(db, "dukung_usulan($1, $2)", AKUN.warga, jalan)).kode, "ditutup");
        assert.equal((await panggil(db, "batal_dukung($1, $2)", AKUN.warga, talud)).kode, "ditutup");
        // 'dilanjutkan' tetap voting, jadi dukungan tetap terbuka.
        const gapura = idDari(h, "Gapura");
        assert.equal((await panggil(db, "dukung_usulan($1, $2)", AKUN.warga, gapura)).ok, true);
      });
    });

    test("pindahkan_status tidak bisa menyentuh usulan yang sudah diputuskan", async () => {
      await transaksi(db, async () => {
        const h = await bacaHitungan(db);
        const jalan = idDari(h, "Jalan SDN 03");
        await tetapkan(db);
        const r = await panggil(db, "pindahkan_status($1, $2, 'forum', 'approved', null, null, null, $3)", AKUN.admin, jalan, ALASAN);
        assert.equal(r.kode, "transisi_tidak_diizinkan");
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("constraint tabel", () => {
    test("keputusan: ditolak dan dana_lain wajib beralasan, dana_lain wajib bersumber, satu keputusan aktif per usulan", async () => {
      const kolom = "tahun, proposal_id, hasil, alasan, sumber_dana, biaya, judul";
      await assert.rejects(db.exec(`insert into keputusan (${kolom}) values (2027, '${U(1)}', 'ditolak', null, null, 1, 'x')`), /keputusan_ditolak_beralasan/);
      await db.exec("rollback");
      await assert.rejects(db.exec(`insert into keputusan (${kolom}) values (2027, '${U(1)}', 'dana_lain', '${ALASAN}', null, 1, 'x')`), /keputusan_dana_lain_lengkap/);
      await db.exec("rollback");
      await assert.rejects(db.exec(`insert into keputusan (${kolom}) values (2027, '${U(1)}', 'selesai', null, null, 1, 'x')`), /hasil_check/);
      await db.exec("rollback");
      await assert.rejects(
        db.exec(`insert into keputusan (${kolom}) values (2026, '${PROPOSAL_2026(1)}', 'disetujui', null, null, 1, 'x')`),
        /keputusan_satu_per_usulan/,
      );
      await db.exec("rollback");
    });

    test("paling banyak satu periode berjalan", async () => {
      await assert.rejects(db.exec("insert into periode (tahun, status) values (2030, 'berjalan')"), /periode_satu_berjalan/);
      await db.exec("rollback");
    });

    test("periode yang diputuskan wajib lengkap", async () => {
      await assert.rejects(db.exec("insert into periode (tahun, status) values (2030, 'diputuskan')"), /periode_diputuskan_utuh/);
      await db.exec("rollback");
    });
  });
});

describe("demo_pulihkan_periode.sql", () => {
  let db: PGlite;
  before(async () => {
    db = await siapkan();
  });
  after(async () => {
    await db.close();
  });

  test("memulihkan penetapan yang sudah lewat 24 jam, sama persis dengan pembatalan biasa", async () => {
    await transaksi(db, async () => {
      const sebelum = await potret(db);
      assert.equal((await tetapkan(db)).ok, true);
      await db.exec("update periode set diputuskan_pada = now() - interval '5 days' where tahun = 2027");
      assert.equal((await batalkan(db)).kode, "lewat_batas");

      await muat(db, "pulihkanPeriode");
      assert.deepEqual(await potret(db), sebelum);
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000) where selected"), 4);
      const [l] = await baris<{ actor: string; message: string }>(db, "select actor, message from accountability_logs where proposal_id is null and detail->>'aksi' = 'batal'");
      assert.equal(l.actor, "pemilik proyek");
      assert.match(l.message, /Pemulihan data demo/);
    });
  });

  test("tetap menolak bila sudah ada usulan yang selesai (hasilnya ok:false, tidak ada yang berubah)", async () => {
    await transaksi(db, async () => {
      const h = await bacaHitungan(db);
      await tetapkan(db);
      await selesai(db, idDari(h, "Jalan SDN 03"), "approved");
      await db.exec("update periode set diputuskan_pada = now() - interval '5 days' where tahun = 2027");
      const sebelum = await potret(db);
      await muat(db, "pulihkanPeriode");
      assert.deepEqual(await potret(db), sebelum);
    });
  });
});
