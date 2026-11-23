// Tes SQL untuk migrasi 0007 (saran urgensi dari AI), dijalankan di PGlite lewat `npm test`. Tidak menyentuh
// database Supabase. Urutan memuat sama dengan yang dijalankan pemilik proyek:
// 0001 -> 0002 -> seed.sql -> 0003 -> 0004 -> akun demo -> seed_forum.sql -> 0005 -> 0006 -> seed_keputusan.sql -> 0007.
//
// Tes berjalan di dalam transaksi yang di-rollback, jadi satu database dipakai bersama.
// Kode kriteria (A-xx) ada di docs/prompts/saran-urgensi.md bagian 9.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { buatDatabase, muat, SEBELUM_FORUM, sidikRekomendasi } from "./pglite.ts";

const baseline = JSON.parse(readFileSync(new URL("./baseline-rekomendasi.json", import.meta.url), "utf8")) as {
  jumlahUsulan: number;
  jumlahDukungan: number;
  rekomendasi: unknown;
};

const HASH = "$scrypt$ln=17,r=8,p=1$c2VlZC1ha3Vu$c2VlZC1ha3VuLXRhbnBhLXNhbmRp";
const AKUN = {
  warga: "00000000-0000-4000-8000-0000000000a1",
  admin: "00000000-0000-4000-8000-0000000000a4",
  admin2: "00000000-0000-4000-8000-0000000000a7",
  nonaktif: "00000000-0000-4000-8000-0000000000a5",
} as const;
const TIDAK_ADA = "00000000-0000-4000-8000-00000000ffff";
const MODEL = "model-uji";
const VERSI = "1";
const ALASAN = "Alasan urgensi yang cukup panjang untuk dibaca warga desa.";

type Hasil = Record<string, unknown> & { ok: boolean; kode?: string; bidang?: string };

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
async function transaksi(db: PGlite, kerja: () => Promise<void>): Promise<void> {
  await db.exec("begin");
  try {
    await kerja();
  } finally {
    await db.exec("rollback");
  }
}

async function siapkan(): Promise<PGlite> {
  const db = await buatDatabase();
  await muat(db, ...SEBELUM_FORUM, "m0004");
  await db.exec(`
    insert into akun (id, nama_pengguna, hash_kata_sandi, peran, warga_id, aktif) values
      ('${AKUN.warga}',    'uji-warga',    '${HASH}', 'warga', (select id from warga where nomor = 69), true),
      ('${AKUN.admin}',    'uji-admin',    '${HASH}', 'admin', null, true),
      ('${AKUN.admin2}',   'uji-admin-2',  '${HASH}', 'admin', null, true),
      ('${AKUN.nonaktif}', 'uji-nonaktif', '${HASH}', 'admin', null, false);
  `);
  await muat(db, "seedForum", "m0005", "m0006", "seedKeputusan", "m0007");
  return db;
}

const SARAN = {
  nilai: 7,
  keyakinan: "sedang",
  alasan: [{ teks: "Jalan gelap setiap malam dan membahayakan.", kutipan: "gelap" }],
  pertanyaan: ["Apakah sudah ada yang cedera?"],
};

describe("migrasi 0007: saran urgensi", () => {
  let db: PGlite;
  let forumId: string; // usulan warga berstatus forum, bisa dinilai
  let votingId: string;

  before(async () => {
    db = await siapkan();
    forumId = (await baris<{ id: string }>(db, "select id from proposals where status = 'forum' and source = 'forum' and rw is not null and disembunyikan_pada is null order by id limit 1"))[0].id;
    votingId = (await baris<{ id: string }>(db, "select id from proposals where status = 'voting' order by id limit 1"))[0].id;
  });
  after(async () => {
    await db.close();
  });

  const ambil = (akun: string, proposal: string, model = MODEL, versi = VERSI) =>
    panggil(db, "ambil_jatah_saran($1, $2, $3, $4)", akun, proposal, model, versi);
  const simpan = (akun: string, panggilan: string, proposal: string, sidik: string, o: Partial<typeof SARAN> & { nilai?: number } = {}) =>
    panggil(
      db,
      "simpan_saran($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)",
      akun, panggilan, proposal, sidik,
      o.nilai ?? SARAN.nilai, o.keyakinan ?? SARAN.keyakinan,
      JSON.stringify(o.alasan ?? SARAN.alasan), JSON.stringify(o.pertanyaan ?? SARAN.pertanyaan),
      MODEL, VERSI, 1234,
    );
  /** ambil + simpan; mengembalikan id saran. */
  async function buatSaran(akun: string = AKUN.admin, proposal = forumId): Promise<{ saranId: string; sidik: string }> {
    const a = await ambil(akun, proposal);
    assert.equal(a.ok, true, JSON.stringify(a));
    const s = await simpan(akun, a.panggilan_id as string, proposal, a.sidik as string);
    assert.equal(s.ok, true, JSON.stringify(s));
    return { saranId: (s.saran as { id: string }).id, sidik: a.sidik as string };
  }
  const pindah = (proposal: string, o: { ke?: string; dibaca?: string; urgensi?: number; saran?: string | null; akun?: string; alasanKeputusan?: string } = {}) =>
    panggil(
      db,
      "pindahkan_status($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      o.akun ?? AKUN.admin, proposal, o.ke ?? "voting", o.dibaca ?? "forum", o.urgensi ?? 8, ALASAN, null, o.alasanKeputusan ?? null, o.saran ?? null,
    );

  // -------------------------------------------------------------------------
  describe("A-14 angka halaman utama tidak berubah", () => {
    test("baseline sama persis, tidak ada saran, dan hitungan tidak bergeser", async () => {
      assert.deepEqual(JSON.parse(await sidikRekomendasi(db)), baseline.rekomendasi);
      assert.equal(await angka(db, "select count(*) as n from proposals where status = 'voting'"), baseline.jumlahUsulan);
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000) where selected"), 4);
      assert.equal(await angka(db, "select count(*) as n from saran_urgensi"), 0);
      assert.equal(await angka(db, "select count(*) as n from panggilan_ai"), 0);
      assert.equal(await angka(db, "select count(*) as n from v_usulan where saran_nilai is not null"), 0);
    });

    test("view lain yang bergantung pada v_usulan tetap ada dan utuh", async () => {
      assert.equal(await angka(db, "select count(*) as n from v_forum"), 17);
      assert.equal(await angka(db, "select count(*) as n from v_admin_usulan"), 17);
      assert.equal(await angka(db, "select count(*) as n from v_keputusan"), 4);
    });
  });

  // -------------------------------------------------------------------------
  describe("hak akses dan bentuk", () => {
    const FUNGSI = [
      "sidik_isi_usulan(text, text, text)",
      "ambil_jatah_saran(uuid, uuid, text, text, integer, integer)",
      "simpan_saran(uuid, uuid, uuid, text, integer, text, jsonb, jsonb, text, text, integer)",
      "catat_gagal_saran(uuid, uuid, text, boolean, integer)",
      "pindahkan_status(uuid, uuid, text, text, integer, text, text, text, uuid)",
    ];

    test("anon dan authenticated tidak boleh menjalankan fungsi baru; service_role boleh", async () => {
      for (const f of FUNGSI) {
        for (const peran of ["anon", "authenticated", "public"]) {
          const { rows } = await db.query<{ ok: boolean }>(`select has_function_privilege('${peran}', '${f}', 'execute') as ok`);
          assert.equal(rows[0].ok, false, `${peran} bisa menjalankan ${f}`);
        }
        const { rows } = await db.query<{ ok: boolean }>(`select has_function_privilege('service_role', '${f}', 'execute') as ok`);
        assert.equal(rows[0].ok, true, `service_role tidak bisa menjalankan ${f}`);
      }
    });

    test("tabel baru: RLS aktif tanpa satu pun policy", async () => {
      for (const t of ["saran_urgensi", "panggilan_ai"]) {
        const { rows } = await db.query<{ rls: boolean }>(`select relrowsecurity as rls from pg_class where relname = '${t}'`);
        assert.equal(rows[0].rls, true, t);
        assert.equal(await angka(db, `select count(*) as n from pg_policies where tablename = '${t}'`), 0, t);
      }
    });

    test("hanya satu pindahkan_status: versi 8 argumen sudah dihapus", async () => {
      assert.equal(await angka(db, "select count(*) as n from pg_proc where proname = 'pindahkan_status'"), 1);
    });

    test("v_usulan: kolom baru di ujung dan tidak memuat id akun", async () => {
      const kolom = (await baris<{ column_name: string }>(db, "select column_name from information_schema.columns where table_name = 'v_usulan' order by ordinal_position")).map((k) => k.column_name);
      assert.deepEqual(kolom.slice(-4), ["saran_nilai", "saran_keyakinan", "saran_alasan", "saran_model"]);
      assert.ok(!kolom.some((k) => k.includes("akun") || k.includes("dibuat_oleh") || k.includes("sidik")));
    });

    test("sidik berubah bila judul, deskripsi, atau kategori berubah", async () => {
      const a = (await panggil(db, "to_jsonb(sidik_isi_usulan('a','b','c'))")) as unknown as string;
      assert.equal(a, (await panggil(db, "to_jsonb(sidik_isi_usulan('a','b','c'))")) as unknown as string);
      for (const lain of ["('x','b','c')", "('a','x','c')", "('a','b','x')"]) {
        assert.notEqual(a, (await panggil(db, `to_jsonb(sidik_isi_usulan${lain})`)) as unknown as string);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("ambil_jatah_saran", () => {
    test("hanya admin aktif", async () => {
      await transaksi(db, async () => {
        assert.equal((await ambil(AKUN.warga, forumId)).kode, "bukan_admin");
        assert.equal((await ambil(AKUN.nonaktif, forumId)).kode, "akun_tidak_aktif");
        assert.equal((await ambil(TIDAK_ADA, forumId)).kode, "akun_tidak_aktif");
        assert.equal(await angka(db, "select count(*) as n from panggilan_ai"), 0);
      });
    });

    test("usulan tidak ada, disembunyikan, sudah voting, atau dari musyawarah: ditolak tanpa menghabiskan jatah", async () => {
      await transaksi(db, async () => {
        assert.equal((await ambil(AKUN.admin, TIDAK_ADA)).kode, "tidak_ditemukan");
        assert.equal((await ambil(AKUN.admin, votingId)).kode, "transisi_tidak_diizinkan");
        await db.query("update proposals set source = 'musrenbang' where id = $1", [forumId]);
        assert.equal((await ambil(AKUN.admin, forumId)).kode, "transisi_tidak_diizinkan");
        await db.query("update proposals set source = 'forum', disembunyikan_pada = now(), alasan_disembunyikan = 'uji' where id = $1", [forumId]);
        assert.equal((await ambil(AKUN.admin, forumId)).kode, "disembunyikan");
        assert.equal(await angka(db, "select count(*) as n from panggilan_ai"), 0);
      });
    });

    test("berhasil: isi dibaca dari tabel, bukan dari pemanggil, dan satu baris 'diminta' tercatat", async () => {
      await transaksi(db, async () => {
        const a = await ambil(AKUN.admin, forumId);
        assert.equal(a.ok, true);
        assert.equal(a.tersimpan, false);
        const [p] = await baris<{ title: string; description: string; category: string }>(db, "select title, description, category from proposals where id = $1", forumId);
        assert.equal(a.judul, p.title);
        assert.equal(a.deskripsi, p.description);
        assert.equal(a.kategori, p.category);
        const [c] = await baris<{ hasil: string; akun_id: string; dihitung: boolean }>(db, "select hasil, akun_id, dihitung from panggilan_ai");
        assert.deepEqual(c, { hasil: "diminta", akun_id: AKUN.admin, dihitung: false });
      });
    });

    test("saran yang sama (isi, versi, model) dipakai ulang tanpa panggilan baru dan tanpa menghabiskan jatah", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        const kedua = await ambil(AKUN.admin2, forumId);
        assert.equal(kedua.ok, true);
        assert.equal(kedua.tersimpan, true);
        assert.equal((kedua.saran as { id: string }).id, saranId);
        assert.equal(await angka(db, "select count(*) as n from panggilan_ai"), 1);
        // model lain atau versi prompt lain: panggilan baru
        const lain = await ambil(AKUN.admin, forumId, "model-lain");
        assert.equal(lain.tersimpan, false, JSON.stringify(lain));
        await panggil(db, "catat_gagal_saran($1, $2, 'kuota', false, 100)", AKUN.admin, lain.panggilan_id);
        const versiLain = await ambil(AKUN.admin2, forumId, MODEL, "2");
        assert.equal(versiLain.tersimpan, false, JSON.stringify(versiLain));
      });
    });

    test("isi usulan berubah: saran lama tidak dipakai lagi", async () => {
      await transaksi(db, async () => {
        await buatSaran();
        await db.query("update proposals set description = description || ' Ada tambahan baru.' where id = $1", [forumId]);
        const lagi = await ambil(AKUN.admin, forumId);
        assert.equal(lagi.ok, true);
        assert.equal(lagi.tersimpan, false);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("A-08 batas laju dan klik ganda dijaga di database", () => {
    test("permintaan kedua untuk usulan yang sama saat yang pertama berjalan: sedang_diproses, tidak ada panggilan kedua", async () => {
      await transaksi(db, async () => {
        const a = await ambil(AKUN.admin, forumId);
        assert.equal(a.ok, true);
        const b = await ambil(AKUN.admin, forumId); // klik ganda
        assert.equal(b.kode, "sedang_diproses");
        const c = await ambil(AKUN.admin2, forumId); // admin lain
        assert.equal(c.kode, "sedang_diproses");
        assert.equal(await angka(db, "select count(*) as n from panggilan_ai"), 1);
      });
    });

    test("sesudah yang pertama selesai gagal, usulan boleh dicoba lagi", async () => {
      await transaksi(db, async () => {
        const a = await ambil(AKUN.admin, forumId);
        await panggil(db, "catat_gagal_saran($1, $2, 'kuota', false, 800)", AKUN.admin, a.panggilan_id);
        assert.equal((await ambil(AKUN.admin, forumId)).ok, true);
      });
    });

    const isiPanggilan = (akun: string, n: number, dihitung: boolean, jam = 0) =>
      db.query(
        `insert into panggilan_ai (akun_id, hasil, dihitung, created_at)
         select $1, case when $2 then 'berhasil' else 'gagal' end, $2, now() - ($3 || ' minutes')::interval + (g || ' seconds')::interval
           from generate_series(1, $4) g`,
        [akun, dihitung, String(jam), n],
      );

    test("10 per jam per admin: yang ke-11 ditolak dengan ulang_detik; admin lain tidak terpengaruh", async () => {
      await transaksi(db, async () => {
        await isiPanggilan(AKUN.admin, 10, true, 30);
        const h = await ambil(AKUN.admin, forumId);
        assert.equal(h.kode, "batas_laju");
        assert.ok(typeof h.ulang_detik === "number" && h.ulang_detik > 0 && h.ulang_detik <= 3600, String(h.ulang_detik));
        assert.equal((await ambil(AKUN.admin2, forumId)).ok, true);
      });
    });

    test("9 per jam masih boleh; panggilan lebih dari satu jam lalu tidak dihitung", async () => {
      await transaksi(db, async () => {
        await isiPanggilan(AKUN.admin, 9, true, 30);
        await isiPanggilan(AKUN.admin, 5, true, 90);
        assert.equal((await ambil(AKUN.admin, forumId)).ok, true);
      });
    });

    test("gangguan (kuota, jaringan, batas waktu) tidak menghabiskan jatah, walau banyak", async () => {
      await transaksi(db, async () => {
        await isiPanggilan(AKUN.admin, 30, false, 10);
        assert.equal((await ambil(AKUN.admin, forumId)).ok, true);
      });
    });

    test("catat_gagal_saran dengan p_hitung = true menghabiskan jatah (AI sudah menjawab, jawabannya tidak bisa dipakai)", async () => {
      await transaksi(db, async () => {
        for (let i = 0; i < 10; i++) {
          const a = await ambil(AKUN.admin, forumId);
          assert.equal(a.ok, true, `panggilan ${i}`);
          await panggil(db, "catat_gagal_saran($1, $2, 'kutipan_palsu', true, 900)", AKUN.admin, a.panggilan_id);
        }
        assert.equal((await ambil(AKUN.admin, forumId)).kode, "batas_laju");
      });
    });

    test("100 per 24 jam untuk seluruh desa: batas_harian, dari banyak admin", async () => {
      await transaksi(db, async () => {
        await isiPanggilan(AKUN.admin, 50, true, 120);
        await isiPanggilan(AKUN.admin2, 50, true, 120);
        const h = await ambil(AKUN.admin, forumId);
        assert.equal(h.kode, "batas_harian");
        assert.ok(typeof h.ulang_detik === "number" && h.ulang_detik > 0 && h.ulang_detik <= 86400);
      });
    });

    test("99 per 24 jam masih boleh", async () => {
      await transaksi(db, async () => {
        await isiPanggilan(AKUN.admin2, 99, true, 120);
        assert.equal((await ambil(AKUN.admin, forumId)).ok, true);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("simpan_saran: pertahanan berlapis", () => {
    test("hanya admin aktif, hanya panggilan miliknya, hanya sekali", async () => {
      await transaksi(db, async () => {
        const a = await ambil(AKUN.admin, forumId);
        const id = a.panggilan_id as string;
        const sidik = a.sidik as string;
        assert.equal((await simpan(AKUN.warga, id, forumId, sidik)).kode, "bukan_admin");
        assert.equal((await simpan(AKUN.admin2, id, forumId, sidik)).kode, "saran_tidak_valid"); // panggilan milik admin lain
        assert.equal((await simpan(AKUN.admin, TIDAK_ADA, forumId, sidik)).kode, "saran_tidak_valid");
        assert.equal((await simpan(AKUN.admin, id, votingId, sidik)).kode, "saran_tidak_valid"); // usulan lain
        assert.equal((await simpan(AKUN.admin, id, forumId, sidik)).ok, true);
        assert.equal((await simpan(AKUN.admin, id, forumId, sidik)).kode, "saran_tidak_valid"); // sudah berhasil
      });
    });

    test("isi berubah selama panggilan berjalan: ditolak", async () => {
      await transaksi(db, async () => {
        const a = await ambil(AKUN.admin, forumId);
        await db.query("update proposals set title = title || ' (revisi)' where id = $1", [forumId]);
        assert.equal((await simpan(AKUN.admin, a.panggilan_id as string, forumId, a.sidik as string)).kode, "saran_tidak_valid");
        assert.equal(await angka(db, "select count(*) as n from saran_urgensi"), 0);
      });
    });

    test("nilai, keyakinan, alasan, dan pertanyaan di luar aturan ditolak", async () => {
      await transaksi(db, async () => {
        const a = await ambil(AKUN.admin, forumId);
        const id = a.panggilan_id as string;
        const sidik = a.sidik as string;
        for (const nilai of [0, 11, -1]) assert.equal((await simpan(AKUN.admin, id, forumId, sidik, { nilai })).bidang, "nilai");
        assert.equal((await simpan(AKUN.admin, id, forumId, sidik, { keyakinan: "pasti" })).bidang, "keyakinan");
        assert.equal((await simpan(AKUN.admin, id, forumId, sidik, { alasan: [] })).bidang, "alasan");
        const empat = Array.from({ length: 4 }, () => SARAN.alasan[0]);
        assert.equal((await simpan(AKUN.admin, id, forumId, sidik, { alasan: empat })).bidang, "alasan");
        assert.equal((await simpan(AKUN.admin, id, forumId, sidik, { pertanyaan: ["a", "b", "c", "d"] })).bidang, "pertanyaan");
        assert.equal(await angka(db, "select count(*) as n from saran_urgensi"), 0);
      });
    });

    test("berhasil: panggilan berubah menjadi 'berhasil' dan dihitung", async () => {
      await transaksi(db, async () => {
        await buatSaran();
        const [c] = await baris<{ hasil: string; dihitung: boolean; durasi_ms: number }>(db, "select hasil, dihitung, durasi_ms from panggilan_ai");
        assert.deepEqual(c, { hasil: "berhasil", dihitung: true, durasi_ms: 1234 });
      });
    });

    test("panggilan_ai tidak menyimpan isi usulan, isi jawaban, atau teks apa pun selain kode", async () => {
      const kolom = (await baris<{ column_name: string }>(db, "select column_name from information_schema.columns where table_name = 'panggilan_ai' order by ordinal_position")).map((k) => k.column_name);
      assert.deepEqual(kolom, ["id", "akun_id", "proposal_id", "created_at", "hasil", "kode", "dihitung", "model", "durasi_ms"]);
    });
  });

  // -------------------------------------------------------------------------
  describe("A-10 pindahkan_status", () => {
    test("tanpa saran: perilaku sama seperti sebelumnya, tanpa jejak AI", async () => {
      await transaksi(db, async () => {
        const h = await pindah(forumId);
        assert.equal(h.ok, true);
        const [p] = await baris<{ status: string; urgency_score: number; saran_dibuka_id: string | null }>(db, "select status, urgency_score, saran_dibuka_id from proposals where id = $1", forumId);
        assert.deepEqual(p, { status: "voting", urgency_score: 8, saran_dibuka_id: null });
        const [log] = await baris<{ message: string; detail: Record<string, unknown> }>(db, "select message, detail from accountability_logs where proposal_id = $1 order by created_at desc limit 1", forumId);
        assert.equal(log.message, `Usulan dimasukkan ke hitungan anggaran dengan urgensi 8 dari 10. Alasan: ${ALASAN}`);
        assert.equal(log.detail.saran_ai, undefined);
        assert.ok(!/AI/.test(log.message));
      });
    });

    test("dengan saran: nilai dibaca dari tabel, tercatat di usulan, detail jejak, dan kalimat jejak", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        const h = await pindah(forumId, { urgensi: 6, saran: saranId });
        assert.equal(h.ok, true, JSON.stringify(h));
        const [p] = await baris<{ saran_dibuka_id: string; urgency_score: number }>(db, "select saran_dibuka_id, urgency_score from proposals where id = $1", forumId);
        assert.equal(p.saran_dibuka_id, saranId);
        assert.equal(p.urgency_score, 6); // nilai admin tetap yang berlaku
        const [log] = await baris<{ message: string; detail: { saran_ai: { nilai: number; model: string; keyakinan: string } } }>(db, "select message, detail from accountability_logs where proposal_id = $1 order by created_at desc limit 1", forumId);
        assert.match(log.message, /urgensi 6 dari 10/);
        assert.match(log.message, /Saran AI yang dibuka admin sebelumnya: 7 dari 10\./);
        assert.equal(log.detail.saran_ai.nilai, 7);
        assert.equal(log.detail.saran_ai.model, MODEL);
        assert.equal(log.detail.saran_ai.keyakinan, "sedang");
      });
    });

    test("A-11 v_usulan menampilkan saran yang dibuka, bukan saran terakhir yang tersimpan", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        await pindah(forumId, { saran: saranId });
        // saran lain (model lain) dibuat belakangan: tidak boleh menggantikan yang dibuka
        await db.query(
          `insert into saran_urgensi (proposal_id, nilai, keyakinan, alasan, model, versi_prompt, sidik_isi)
           select id, 3, 'tinggi', '[{"teks":"lain","kutipan":"lain"}]'::jsonb, 'model-lain', '1',
                  sidik_isi_usulan(title, description, category) from proposals where id = $1`,
          [forumId],
        );
        const [v] = await baris<{ saran_nilai: number; saran_model: string; saran_keyakinan: string; saran_alasan: unknown }>(
          db, "select saran_nilai, saran_model, saran_keyakinan, saran_alasan from v_usulan where id = $1", forumId,
        );
        assert.equal(v.saran_nilai, 7);
        assert.equal(v.saran_model, MODEL);
        assert.equal(v.saran_keyakinan, "sedang");
        assert.deepEqual(v.saran_alasan, SARAN.alasan);
      });
    });

    test("saran yang ada tetapi tidak dibuka tidak tampil di v_usulan", async () => {
      await transaksi(db, async () => {
        await buatSaran();
        await pindah(forumId); // tanpa p_saran
        const [v] = await baris<{ saran_nilai: number | null }>(db, "select saran_nilai from v_usulan where id = $1", forumId);
        assert.equal(v.saran_nilai, null);
      });
    });

    test("usulan disembunyikan: saran dikosongkan di v_usulan", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        await pindah(forumId, { saran: saranId });
        await db.query("update proposals set disembunyikan_pada = now(), alasan_disembunyikan = 'uji' where id = $1", [forumId]);
        const [v] = await baris<{ saran_nilai: number | null; saran_alasan: unknown; saran_model: string | null }>(db, "select saran_nilai, saran_alasan, saran_model from v_usulan where id = $1", forumId);
        assert.deepEqual(v, { saran_nilai: null, saran_alasan: null, saran_model: null });
      });
    });

    test("saran milik usulan lain ditolak", async () => {
      await transaksi(db, async () => {
        const lain = (await baris<{ id: string }>(db, "select id from proposals where status = 'forum' and source = 'forum' and rw is not null and disembunyikan_pada is null and id <> $1 order by id limit 1", forumId))[0].id;
        const { saranId } = await buatSaran(AKUN.admin, lain);
        const h = await pindah(forumId, { saran: saranId });
        assert.equal(h.kode, "saran_tidak_valid");
        assert.equal((await baris<{ status: string }>(db, "select status from proposals where id = $1", forumId))[0].status, "forum");
      });
    });

    test("saran yang basi (isi berubah sejak dibuat) ditolak", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        await db.query("update proposals set description = description || ' Tambahan.' where id = $1", [forumId]);
        assert.equal((await pindah(forumId, { saran: saranId })).kode, "saran_tidak_valid");
      });
    });

    test("id saran yang tidak ada, atau saran dengan tujuan selain voting, ditolak", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        assert.equal((await pindah(forumId, { saran: TIDAK_ADA })).kode, "saran_tidak_valid");
        assert.equal((await pindah(forumId, { ke: "rejected", saran: saranId, alasanKeputusan: "Tidak termasuk prioritas desa tahun ini." })).kode, "saran_tidak_valid");
      });
    });

    test("tanpa admin aktif: ditolak seperti biasa, usulan tidak berubah", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        assert.equal((await pindah(forumId, { akun: AKUN.warga, saran: saranId })).kode, "bukan_admin");
        assert.equal((await pindah(forumId, { akun: AKUN.nonaktif, saran: saranId })).kode, "akun_tidak_aktif");
      });
    });

    test("dikembalikan ke forum: saran dibuka dikosongkan bersama urgensinya", async () => {
      await transaksi(db, async () => {
        const { saranId } = await buatSaran();
        await pindah(forumId, { saran: saranId });
        const h = await pindah(forumId, { ke: "forum", dibaca: "voting", alasanKeputusan: "Dikembalikan untuk dibahas lagi bersama warga." });
        assert.equal(h.ok, true, JSON.stringify(h));
        const [p] = await baris<{ saran_dibuka_id: string | null; urgency_score: number | null }>(db, "select saran_dibuka_id, urgency_score from proposals where id = $1", forumId);
        assert.deepEqual(p, { saran_dibuka_id: null, urgency_score: null });
        // saran tetap tersimpan sebagai cache
        assert.equal(await angka(db, "select count(*) as n from saran_urgensi"), 1);
      });
    });

    test("baseline rekomendasi tidak berubah oleh saran: skor memakai nilai admin, bukan saran", async () => {
      await transaksi(db, async () => {
        const sebelum = await sidikRekomendasi(db);
        await buatSaran(AKUN.admin, forumId);
        assert.equal(await sidikRekomendasi(db), sebelum);
      });
    });
  });
});
