// Tes SQL untuk migrasi 0004 dan seed_forum.sql, dijalankan di PGlite.
// Jalankan lewat `npm test`. Tidak menyentuh database Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { buatDatabase, muat, SEBELUM_FORUM, sidikRekomendasi } from "./pglite.ts";

const baseline = JSON.parse(
  readFileSync(new URL("./baseline-rekomendasi.json", import.meta.url), "utf8"),
) as { jumlahUsulan: number; jumlahDukungan: number; rekomendasi: unknown };

// Akun uji. Hash-nya hanya mengisi format; tidak ada yang masuk lewat akun ini.
const HASH = "$scrypt$ln=17,r=8,p=1$c2VlZC1ha3Vu$c2VlZC1ha3VuLXRhbnBhLXNhbmRp";
const AKUN = {
  warga: "00000000-0000-4000-8000-0000000000a1", // warga RW 07 nomor 69
  wargaKedua: "00000000-0000-4000-8000-0000000000a2", // warga RW 01 nomor 3
  tanpaWarga: "00000000-0000-4000-8000-0000000000a3",
  admin: "00000000-0000-4000-8000-0000000000a4",
  nonaktif: "00000000-0000-4000-8000-0000000000a5",
  demo: "00000000-0000-4000-8000-0000000000a6", // bernama 'warga', belum tertaut
};
const USULAN_LAMPU_GANG = "6f1b3d0a-1001-4c8e-9a10-000000000001";
const USULAN_TONG_SAMPAH = "6f1b3d0a-1001-4c8e-9a10-000000000004";
const KOMENTAR_SPAM = "6f1b3d0a-3001-4c8e-9a10-000000000010";

interface Hasil {
  ok: boolean;
  kode?: string;
  bidang?: string;
  jumlah?: number;
  didukung?: boolean;
  id?: string;
  ulang_detik?: number;
}

async function panggil(db: PGlite, sql: string, ...param: unknown[]): Promise<Hasil> {
  const { rows } = await db.query<{ r: Hasil }>(`select ${sql} as r`, param);
  return rows[0].r;
}

async function angka(db: PGlite, sql: string, ...param: unknown[]): Promise<number> {
  const { rows } = await db.query<{ n: number | string | bigint }>(sql, param);
  return Number(rows[0].n);
}

async function idUsulan(db: PGlite, judul: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>("select id from proposals where title = $1", [judul]);
  assert.equal(rows.length, 1, `usulan '${judul}' tidak ditemukan`);
  return rows[0].id;
}

const dukung = (db: PGlite, akun: string, usulan: string) =>
  panggil(db, "dukung_usulan($1, $2)", akun, usulan);
const batal = (db: PGlite, akun: string, usulan: string) =>
  panggil(db, "batal_dukung($1, $2)", akun, usulan);
const ajukan = (db: PGlite, akun: string, judul: string, biaya = 50_000_000, rw = 7) =>
  panggil(
    db,
    "ajukan_usulan($1, $2, null, $3, 'infrastruktur', $4, $5)",
    akun,
    judul,
    "Deskripsi yang cukup panjang untuk lolos pemeriksaan panjang minimal.",
    rw,
    biaya,
  );
const komentari = (db: PGlite, akun: string, usulan: string, isi: string) =>
  panggil(db, "tambah_komentar($1, $2, $3)", akun, usulan, isi);
const sembunyikan = (db: PGlite, akun: string, jenis: string, id: string, alasan: string) =>
  panggil(db, "sembunyikan($1, $2, $3, $4)", akun, jenis, id, alasan);

/** Memundurkan waktu supaya batas laju bisa diuji tanpa menunggu. */
async function mundurkanWaktu(db: PGlite): Promise<void> {
  await db.exec(`
    update komentar set created_at = created_at - interval '1 minute'
     where akun_id in ('${AKUN.warga}', '${AKUN.admin}');
    update proposals set created_at = created_at - interval '25 hours'
     where title like 'Uji batas%';
  `);
}

describe("migrasi 0004 dan seed_forum.sql", () => {
  let db: PGlite;

  before(async () => {
    db = await buatDatabase();
    await muat(db, ...SEBELUM_FORUM, "m0004");

    // Akun uji. Satu akun bernama 'warga' belum tertaut, seperti hasil `npm run akun:buat`.
    await db.exec(`
      insert into akun (id, nama_pengguna, hash_kata_sandi, peran, warga_id, aktif) values
        ('${AKUN.warga}',      'uji-warga',   '${HASH}', 'warga', (select id from warga where nomor = 69), true),
        ('${AKUN.wargaKedua}', 'uji-warga-2', '${HASH}', 'warga', (select id from warga where nomor = 3),  true),
        ('${AKUN.tanpaWarga}', 'uji-tanpa',   '${HASH}', 'warga', null, true),
        ('${AKUN.admin}',      'uji-admin',   '${HASH}', 'admin', null, true),
        ('${AKUN.nonaktif}',   'uji-nonaktif','${HASH}', 'warga', (select id from warga where nomor = 4), false),
        ('${AKUN.demo}',       'warga',       '${HASH}', 'warga', null, true);
    `);
    await muat(db, "seedForum");
  });

  after(async () => {
    await db.close();
  });

  describe("angka halaman utama tidak berubah", () => {
    test("rekomendasi_resmi(300000000) sama persis dengan sebelum migrasi", async () => {
      const sekarang = JSON.parse(await sidikRekomendasi(db));
      assert.deepEqual(sekarang, baseline.rekomendasi);
    });

    test("tujuh usulan voting dan 162 dukungannya utuh", async () => {
      assert.equal(await angka(db, "select count(*) as n from proposals where status = 'voting'"), baseline.jumlahUsulan);
      assert.equal(
        await angka(
          db,
          `select count(*) as n from votes v join proposals p on p.id = v.proposal_id where p.status = 'voting'`,
        ),
        baseline.jumlahDukungan,
      );
      assert.equal(baseline.jumlahDukungan, 162);
    });

    test("seed_forum tidak menyentuh baris usulan voting", async () => {
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n from proposals
          where status = 'voting' and (disembunyikan_pada is not null or source <> 'musrenbang')`,
      );
      assert.equal(rows[0].n, 0);
    });

    test("v_wilayah memberi angka yang sama seperti sebelumnya", async () => {
      const { rows } = await db.query<{ rw: number; jumlah_usulan: number; jumlah_suara: number }>(
        "select rw, jumlah_usulan, jumlah_suara from v_wilayah order by rw",
      );
      assert.deepEqual(
        rows.map((r) => [r.rw, r.jumlah_usulan, r.jumlah_suara]),
        [[1, 2, 105], [3, 1, 30], [7, 4, 27]],
      );
    });
  });

  describe("seed_forum.sql", () => {
    test("enam usulan forum, dukungan tersebar di tiga RW", async () => {
      assert.equal(await angka(db, "select count(*) as n from proposals where status = 'forum'"), 6);
      const { rows } = await db.query<{ rw: number }>(
        `select distinct w.rw from votes v
           join proposals p on p.id = v.proposal_id and p.status = 'forum'
           join warga w on w.id = v.warga_id order by w.rw`,
      );
      assert.deepEqual(rows.map((r) => r.rw), [1, 3, 7]);
    });

    test("15 komentar, tepat satu tersembunyi, dengan log moderasi", async () => {
      assert.equal(await angka(db, "select count(*) as n from komentar"), 15);
      assert.equal(await angka(db, "select count(*) as n from komentar where disembunyikan_pada is not null"), 1);
      const { rows } = await db.query<{ proposal_id: string; message: string }>(
        "select proposal_id, message from accountability_logs where log_type = 'moderation'",
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].proposal_id, USULAN_TONG_SAMPAH);
      assert.match(rows[0].message, /Alasan: Berisi tautan promosi/);
    });

    test("dijalankan ulang tanpa gagal dan tanpa data ganda", async () => {
      const sebelum = await db.query<{ a: number; b: number; c: number; d: number; e: number }>(
        `select (select count(*) from proposals)::int a, (select count(*) from votes)::int b,
                (select count(*) from komentar)::int c, (select count(*) from accountability_logs)::int d,
                (select count(*) from akun)::int e`,
      );
      await muat(db, "seedForum");
      const sesudah = await db.query<{ a: number; b: number; c: number; d: number; e: number }>(
        `select (select count(*) from proposals)::int a, (select count(*) from votes)::int b,
                (select count(*) from komentar)::int c, (select count(*) from accountability_logs)::int d,
                (select count(*) from akun)::int e`,
      );
      assert.deepEqual(sesudah.rows[0], sebelum.rows[0]);
    });

    test("akun demo 'warga' tertaut ke warga RW 07", async () => {
      const { rows } = await db.query<{ rw: number }>(
        "select w.rw from akun a join warga w on w.id = a.warga_id where a.nama_pengguna = 'warga'",
      );
      assert.deepEqual(rows.map((r) => r.rw), [7]);
    });

    test("akun seed-* nonaktif", async () => {
      assert.equal(await angka(db, "select count(*) as n from akun where nama_pengguna like 'seed-%' and aktif"), 0);
    });

    test("ada usulan forum yang sengaja mirip usulan voting (untuk demo gabung)", async () => {
      assert.equal(await angka(db, "select count(*) as n from proposals where title = 'Lampu jalan gang RW 07 gelap'"), 1);
      assert.equal(await angka(db, "select count(*) as n from proposals where title = 'Lampu PJU jalan setapak RW 07'"), 1);
    });
  });

  describe("v_forum, v_usulan, v_komentar", () => {
    test("v_forum memuat forum dan voting dalam satu daftar", async () => {
      const { rows } = await db.query<{ status: string; n: number }>(
        "select status, count(*)::int as n from v_forum group by status order by status",
      );
      assert.deepEqual(rows, [{ status: "forum", n: 6 }, { status: "voting", n: 7 }]);
    });

    test("tidak ada nomor, warga_id, atau akun_id yang keluar lewat view", async () => {
      const { rows } = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name in ('v_forum', 'v_usulan', 'v_komentar')
            and column_name in ('nomor', 'warga_id', 'akun_id', 'proposer_id', 'nama', 'hash_kata_sandi')`,
      );
      assert.deepEqual(rows, []);
    });

    test("pengusul hanya nama depan dan RW", async () => {
      const { rows } = await db.query<{ pengusul_nama_depan: string; pengusul_rw: number }>(
        "select pengusul_nama_depan, pengusul_rw from v_forum where id = $1",
        [USULAN_LAMPU_GANG],
      );
      assert.equal(rows.length, 1);
      assert.match(rows[0].pengusul_nama_depan, /^\S+$/);
      assert.equal(rows[0].pengusul_rw, 7);
    });

    test("komentar admin berlabel admin tanpa nama; komentar warga hanya nama depan + RW", async () => {
      const { rows } = await db.query<{ dari_admin: boolean; penulis_nama_depan: string | null; penulis_rw: number | null }>(
        "select dari_admin, penulis_nama_depan, penulis_rw from v_komentar where proposal_id = $1 order by created_at",
        [USULAN_LAMPU_GANG],
      );
      assert.equal(rows.length, 3);
      const admin = rows.find((r) => r.dari_admin);
      assert.deepEqual(admin && [admin.penulis_nama_depan, admin.penulis_rw], [null, null]);
      for (const r of rows.filter((x) => !x.dari_admin)) assert.match(r.penulis_nama_depan ?? "", /^\S+$/);
    });

    test("isi komentar tersembunyi tidak keluar dari view, alasannya keluar", async () => {
      const { rows } = await db.query<{ isi: string | null; alasan_disembunyikan: string }>(
        "select isi, alasan_disembunyikan from v_komentar where id = $1",
        [KOMENTAR_SPAM],
      );
      assert.equal(rows[0].isi, null);
      assert.match(rows[0].alasan_disembunyikan, /tautan promosi/);
    });

    test("jumlah komentar tidak menghitung yang tersembunyi", async () => {
      const { rows } = await db.query<{ jumlah_komentar: number }>(
        "select jumlah_komentar from v_forum where id = $1",
        [USULAN_TONG_SAMPAH],
      );
      assert.equal(rows[0].jumlah_komentar, 2);
    });
  });

  describe("dukung_usulan dan batal_dukung", () => {
    test("dukung menambah satu, mendukung lagi tidak menambah (idempoten)", async () => {
      const awal = await angka(db, "select count(*) as n from votes where proposal_id = $1", USULAN_LAMPU_GANG);
      const a = await dukung(db, AKUN.warga, USULAN_LAMPU_GANG);
      const b = await dukung(db, AKUN.warga, USULAN_LAMPU_GANG);
      assert.deepEqual([a.ok, a.didukung, a.jumlah], [true, true, awal + 1]);
      assert.deepEqual([b.ok, b.didukung, b.jumlah], [true, true, awal + 1]);
    });

    test("batal mengurangi satu, membatalkan lagi tidak mengurangi (idempoten)", async () => {
      const dengan = (await dukung(db, AKUN.wargaKedua, USULAN_LAMPU_GANG)).jumlah!;
      const a = await batal(db, AKUN.wargaKedua, USULAN_LAMPU_GANG);
      const b = await batal(db, AKUN.wargaKedua, USULAN_LAMPU_GANG);
      assert.deepEqual([a.ok, a.didukung, a.jumlah], [true, false, dengan - 1]);
      assert.deepEqual([b.ok, b.didukung, b.jumlah], [true, false, dengan - 1]);
    });

    test("dukungan masuk ke usulan voting dan mengubah jumlah suaranya", async () => {
      const jalan = await idUsulan(db, "Perbaikan jalan berlubang depan SDN 03");
      const sebelum = await angka(db, "select count(*) as n from votes where proposal_id = $1", jalan);
      const h = await dukung(db, AKUN.wargaKedua, jalan);
      assert.equal(h.jumlah, sebelum + 1);
      // Dikembalikan supaya tes lain tetap melihat 162 dukungan.
      await batal(db, AKUN.wargaKedua, jalan);
      assert.equal(await angka(db, "select count(*) as n from votes where proposal_id = $1", jalan), sebelum);
    });

    test("admin ditolak", async () => {
      assert.deepEqual(await dukung(db, AKUN.admin, USULAN_LAMPU_GANG), { ok: false, kode: "bukan_warga" });
      assert.deepEqual(await batal(db, AKUN.admin, USULAN_LAMPU_GANG), { ok: false, kode: "bukan_warga" });
    });

    test("akun warga tanpa warga_id ditolak", async () => {
      assert.deepEqual(await dukung(db, AKUN.tanpaWarga, USULAN_LAMPU_GANG), { ok: false, kode: "tanpa_warga" });
    });

    test("akun nonaktif dan akun yang tidak ada ditolak", async () => {
      assert.deepEqual(await dukung(db, AKUN.nonaktif, USULAN_LAMPU_GANG), { ok: false, kode: "akun_tidak_aktif" });
      assert.deepEqual(
        await dukung(db, "00000000-0000-4000-8000-00000000ffff", USULAN_LAMPU_GANG),
        { ok: false, kode: "akun_tidak_aktif" },
      );
    });

    test("usulan yang tidak ada ditolak", async () => {
      assert.deepEqual(
        await dukung(db, AKUN.warga, "00000000-0000-4000-8000-00000000ffff"),
        { ok: false, kode: "tidak_ditemukan" },
      );
    });

    test("usulan approved, rejected, done: dukungan ditutup (tidak bisa ditambah atau ditarik)", async () => {
      for (const status of ["approved", "rejected", "done"]) {
        const { rows } = await db.query<{ id: string }>(
          `insert into proposals (title, category, estimated_budget, status, source, rw, urgency_score)
           values ($1, 'sosial', 10000000, $2, 'admin', 1, 5) returning id`,
          [`Uji tertutup ${status}`, status],
        );
        const id = rows[0].id;
        await db.query("insert into votes (proposal_id, warga_id) select $1, warga_id from akun where id = $2", [
          id,
          AKUN.warga,
        ]);
        assert.deepEqual(await dukung(db, AKUN.wargaKedua, id), { ok: false, kode: "ditutup" }, status);
        assert.deepEqual(await batal(db, AKUN.warga, id), { ok: false, kode: "ditutup" }, status);
        assert.equal(await angka(db, "select count(*) as n from votes where proposal_id = $1", id), 1, status);
      }
    });

    test("usulan tersembunyi tidak bisa didukung", async () => {
      const { rows } = await db.query<{ id: string }>(
        `insert into proposals (title, category, estimated_budget, rw, disembunyikan_pada, alasan_disembunyikan)
         values ('Uji tersembunyi', 'sosial', 10000000, 1, now(), 'Uji.') returning id`,
      );
      assert.deepEqual(await dukung(db, AKUN.warga, rows[0].id), { ok: false, kode: "disembunyikan" });
    });
  });

  describe("ajukan_usulan", () => {
    test("usulan baru berstatus forum, urgensi kosong, dan pengusul otomatis mendukung", async () => {
      const h = await ajukan(db, AKUN.warga, "Uji batas satu usulan pertama");
      assert.equal(h.ok, true);
      const { rows } = await db.query<{ status: string; source: string; urgency_score: number | null; vote_count: number }>(
        `select p.status, p.source, p.urgency_score,
                (select count(*)::int from votes v where v.proposal_id = p.id) as vote_count
           from proposals p where p.id = $1`,
        [h.id],
      );
      assert.deepEqual(rows[0], { status: "forum", source: "forum", urgency_score: null, vote_count: 1 });
    });

    test("pengusul diambil dari akun, bukan dari masukan", async () => {
      const { rows } = await db.query<{ nomor: number }>(
        `select w.nomor from proposals p join warga w on w.id = p.proposer_id where p.title = 'Uji batas satu usulan pertama'`,
      );
      assert.equal(rows[0].nomor, 69);
    });

    test("masukan tidak valid ditolak per bidang", async () => {
      const kasus: [string, () => Promise<Hasil>][] = [
        ["judul", () => ajukan(db, AKUN.warga, "pendek")],
        ["judul", () => ajukan(db, AKUN.warga, "x".repeat(81))],
        ["biaya", () => ajukan(db, AKUN.warga, "Judul yang cukup panjang", 99_999)],
        ["biaya", () => ajukan(db, AKUN.warga, "Judul yang cukup panjang", 5_000_000_001)],
        ["biaya", () => ajukan(db, AKUN.warga, "Judul yang cukup panjang", -5)],
        ["rw", () => ajukan(db, AKUN.warga, "Judul yang cukup panjang", 50_000_000, 99)],
        [
          "kategori",
          () => panggil(db, "ajukan_usulan($1, 'Judul yang cukup panjang', null, $2, 'bukan-kategori', 7, 50000000)", AKUN.warga, "d".repeat(30)),
        ],
        [
          "deskripsi",
          () => panggil(db, "ajukan_usulan($1, 'Judul yang cukup panjang', null, 'terlalu pendek', 'sosial', 7, 50000000)", AKUN.warga),
        ],
        [
          "nama_singkat",
          () => panggil(db, "ajukan_usulan($1, 'Judul yang cukup panjang', 'x', $2, 'sosial', 7, 50000000)", AKUN.warga, "d".repeat(30)),
        ],
      ];
      for (const [bidang, jalankan] of kasus) {
        const h = await jalankan();
        assert.deepEqual([h.ok, h.kode, h.bidang], [false, "tidak_valid", bidang]);
      }
    });

    test("admin dan akun tanpa warga_id ditolak", async () => {
      assert.equal((await ajukan(db, AKUN.admin, "Judul yang cukup panjang")).kode, "bukan_warga");
      assert.equal((await ajukan(db, AKUN.tanpaWarga, "Judul yang cukup panjang")).kode, "tanpa_warga");
    });

    test("batas laju: tiga usulan per 24 jam, yang keempat ditolak dengan waktu tunggu", async () => {
      assert.equal((await ajukan(db, AKUN.warga, "Uji batas dua usulan kedua")).ok, true);
      assert.equal((await ajukan(db, AKUN.warga, "Uji batas tiga usulan ketiga")).ok, true);
      const ditolak = await ajukan(db, AKUN.warga, "Uji batas empat usulan keempat");
      assert.equal(ditolak.ok, false);
      assert.equal(ditolak.kode, "batas_laju");
      assert.ok(ditolak.ulang_detik! > 0 && ditolak.ulang_detik! <= 24 * 3600, `ulang_detik=${ditolak.ulang_detik}`);
      assert.equal(await angka(db, "select count(*) as n from proposals where title like 'Uji batas%'"), 3);
    });

    test("batas laju dihitung per warga: warga lain tidak terkena", async () => {
      assert.equal((await ajukan(db, AKUN.wargaKedua, "Uji batas milik warga lain", 50_000_000, 1)).ok, true);
    });

    test("setelah 24 jam, warga bisa mengajukan lagi", async () => {
      await mundurkanWaktu(db);
      const h = await ajukan(db, AKUN.warga, "Uji batas lima setelah sehari");
      assert.equal(h.ok, true);
    });
  });

  describe("tambah_komentar", () => {
    test("komentar tersimpan terpangkas dan tampil di v_komentar", async () => {
      const h = await komentari(db, AKUN.warga, USULAN_LAMPU_GANG, "   Sudah saya cek, tiangnya ada.  ");
      assert.equal(h.ok, true);
      const { rows } = await db.query<{ isi: string }>("select isi from komentar where id = $1", [h.id]);
      assert.equal(rows[0].isi, "Sudah saya cek, tiangnya ada.");
    });

    test("batas laju: satu komentar per 20 detik per akun", async () => {
      const h = await komentari(db, AKUN.warga, USULAN_LAMPU_GANG, "Komentar kedua terlalu cepat.");
      assert.equal(h.ok, false);
      assert.equal(h.kode, "batas_laju");
      assert.ok(h.ulang_detik! >= 1 && h.ulang_detik! <= 20, `ulang_detik=${h.ulang_detik}`);
      await mundurkanWaktu(db);
      assert.equal((await komentari(db, AKUN.warga, USULAN_LAMPU_GANG, "Sekarang boleh.")).ok, true);
    });

    test("admin boleh berkomentar", async () => {
      assert.equal((await komentari(db, AKUN.admin, USULAN_LAMPU_GANG, "Dicatat, terima kasih.")).ok, true);
    });

    test("warga tanpa warga_id boleh berkomentar", async () => {
      assert.equal((await komentari(db, AKUN.tanpaWarga, USULAN_LAMPU_GANG, "Saya setuju dengan usulan ini.")).ok, true);
    });

    test("kosong, hanya spasi, dan lebih dari 1.000 karakter ditolak", async () => {
      for (const isi of ["", "    ", "a".repeat(1001)]) {
        const h = await komentari(db, AKUN.wargaKedua, USULAN_LAMPU_GANG, isi);
        assert.deepEqual([h.ok, h.kode, h.bidang], [false, "tidak_valid", "isi"]);
      }
      assert.equal((await komentari(db, AKUN.wargaKedua, USULAN_LAMPU_GANG, "a".repeat(1000))).ok, true);
    });

    test("akun nonaktif ditolak; usulan yang tidak ada atau tersembunyi ditolak", async () => {
      assert.equal((await komentari(db, AKUN.nonaktif, USULAN_LAMPU_GANG, "Halo")).kode, "akun_tidak_aktif");
      assert.equal(
        (await komentari(db, AKUN.warga, "00000000-0000-4000-8000-00000000ffff", "Halo")).kode,
        "tidak_ditemukan",
      );
      const { rows } = await db.query<{ id: string }>(
        "select id from proposals where title = 'Uji tersembunyi'",
      );
      await mundurkanWaktu(db);
      assert.equal((await komentari(db, AKUN.warga, rows[0].id, "Halo")).kode, "disembunyikan");
    });

    test("komentar tetap bisa ditambah di usulan yang sudah diputuskan", async () => {
      const { rows } = await db.query<{ id: string }>("select id from proposals where title = 'Uji tertutup done'");
      await mundurkanWaktu(db);
      assert.equal((await komentari(db, AKUN.warga, rows[0].id, "Terima kasih, sudah selesai.")).ok, true);
    });
  });

  describe("sembunyikan", () => {
    test("warga ditolak; admin dengan alasan terlalu pendek ditolak", async () => {
      assert.equal((await sembunyikan(db, AKUN.warga, "usulan", USULAN_LAMPU_GANG, "Alasan yang cukup panjang")).kode, "bukan_admin");
      const h = await sembunyikan(db, AKUN.admin, "usulan", USULAN_LAMPU_GANG, "pendek");
      assert.deepEqual([h.ok, h.kode, h.bidang], [false, "tidak_valid", "alasan"]);
      const j = await sembunyikan(db, AKUN.admin, "usulan", USULAN_LAMPU_GANG, "    ");
      assert.equal(j.bidang, "alasan");
    });

    test("menyembunyikan komentar menulis log moderasi, isi hilang dari view", async () => {
      const { rows: k } = await db.query<{ id: string }>(
        "select id from komentar where proposal_id = $1 and disembunyikan_pada is null order by created_at limit 1",
        [USULAN_LAMPU_GANG],
      );
      const logSebelum = await angka(db, "select count(*) as n from accountability_logs where log_type = 'moderation'");
      const h = await sembunyikan(db, AKUN.admin, "komentar", k[0].id, "  Mengandung data pribadi warga.  ");
      assert.equal(h.ok, true);

      const { rows: log } = await db.query<{ actor: string; message: string; proposal_id: string; detail: { jenis: string; id: string; alasan: string } }>(
        "select actor, message, proposal_id, detail from accountability_logs where log_type = 'moderation' order by id desc limit 1",
      );
      assert.equal(await angka(db, "select count(*) as n from accountability_logs where log_type = 'moderation'"), logSebelum + 1);
      assert.equal(log[0].actor, "admin");
      assert.equal(log[0].proposal_id, USULAN_LAMPU_GANG);
      assert.match(log[0].message, /Alasan: Mengandung data pribadi warga\.$/);
      assert.deepEqual(log[0].detail, { jenis: "komentar", id: k[0].id, alasan: "Mengandung data pribadi warga." });
      // Nama akun admin tidak ikut tercatat di jejak publik.
      assert.doesNotMatch(JSON.stringify(log[0]), /uji-admin/);

      const { rows: v } = await db.query<{ isi: string | null; alasan_disembunyikan: string }>(
        "select isi, alasan_disembunyikan from v_komentar where id = $1",
        [k[0].id],
      );
      assert.equal(v[0].isi, null);
      assert.equal(v[0].alasan_disembunyikan, "Mengandung data pribadi warga.");
    });

    test("menyembunyikan dua kali dan id yang tidak ada ditolak", async () => {
      assert.equal((await sembunyikan(db, AKUN.admin, "komentar", KOMENTAR_SPAM, "Alasan yang cukup panjang")).kode, "sudah_disembunyikan");
      assert.equal(
        (await sembunyikan(db, AKUN.admin, "komentar", "00000000-0000-4000-8000-00000000ffff", "Alasan yang cukup panjang")).kode,
        "tidak_ditemukan",
      );
      assert.equal((await sembunyikan(db, AKUN.admin, "lainnya", KOMENTAR_SPAM, "Alasan yang cukup panjang")).bidang, "jenis");
    });

    test("usulan tersembunyi: hilang dari daftar, judul dikosongkan di v_usulan, jejak tetap", async () => {
      const id = "6f1b3d0a-1001-4c8e-9a10-000000000006";
      const h = await sembunyikan(db, AKUN.admin, "usulan", id, "Berisi tuduhan terhadap warga tertentu.");
      assert.equal(h.ok, true);
      assert.equal(await angka(db, "select count(*) as n from v_forum where id = $1", id), 0);
      const { rows } = await db.query<{ title: string | null; description: string | null; alasan_disembunyikan: string; disembunyikan_pada: string }>(
        "select title, description, alasan_disembunyikan, disembunyikan_pada from v_usulan where id = $1",
        [id],
      );
      assert.equal(rows[0].title, null);
      assert.equal(rows[0].description, null);
      assert.match(rows[0].alasan_disembunyikan, /tuduhan/);
      assert.ok(rows[0].disembunyikan_pada);
      const { rows: log } = await db.query<{ message: string }>(
        "select message from accountability_logs where log_type = 'moderation' and proposal_id = $1",
        [id],
      );
      assert.equal(log.length, 1);
      assert.match(log[0].message, /^Usulan disembunyikan oleh admin desa\. Alasan: Berisi tuduhan/);
    });

    test("usulan voting yang disembunyikan tidak lagi dihitung dalam skor", async () => {
      const lampu = await idUsulan(db, "Lampu PJU jalan setapak RW 07");
      const h = await sembunyikan(db, AKUN.admin, "usulan", lampu, "Duplikat dengan usulan lain di forum.");
      assert.equal(h.ok, true);
      const { rows } = await db.query<{ n: number }>("select count(*)::int as n from rekomendasi_resmi(300000000)");
      assert.equal(rows[0].n, 6);
      const { rows: log } = await db.query<{ message: string }>(
        "select message from accountability_logs where log_type = 'moderation' and proposal_id = $1",
        [lampu],
      );
      assert.match(log[0].message, /tidak lagi dihitung dalam anggaran/);
      // Kembalikan supaya tes sesudahnya melihat data awal.
      await db.query("update proposals set disembunyikan_pada = null, alasan_disembunyikan = null where id = $1", [lampu]);
      assert.equal(JSON.stringify(JSON.parse(await sidikRekomendasi(db))), JSON.stringify(baseline.rekomendasi));
    });
  });

  describe("batasan tabel", () => {
    test("urgency_score boleh kosong untuk forum, wajib untuk status lain", async () => {
      await db.query(
        `insert into proposals (title, category, estimated_budget, status, rw)
         values ('Uji urgensi forum', 'sosial', 10000000, 'forum', 1)`,
      );
      await assert.rejects(
        db.query(
          `insert into proposals (title, category, estimated_budget, status, rw)
           values ('Uji urgensi voting', 'sosial', 10000000, 'voting', 1)`,
        ),
        /proposals_urgensi_wajib_setelah_forum/,
      );
      await assert.rejects(
        db.query(
          `insert into proposals (title, category, estimated_budget, status, rw, urgency_score)
           values ('Uji urgensi 11', 'sosial', 10000000, 'voting', 1, 11)`,
        ),
        /proposals_urgensi_skala/,
      );
    });

    test("log_type 'moderation' diterima, tipe lain yang tidak dikenal ditolak", async () => {
      await db.query("insert into accountability_logs (log_type, message) values ('moderation', 'uji')");
      await assert.rejects(
        db.query("insert into accountability_logs (log_type, message) values ('lainnya', 'uji')"),
        /accountability_logs_log_type_check/,
      );
    });

    test("moderasi harus utuh: waktu dan alasan selalu berpasangan", async () => {
      await assert.rejects(
        db.query("update proposals set disembunyikan_pada = now() where title = 'Uji urgensi forum'"),
        /proposals_moderasi_utuh/,
      );
      await assert.rejects(
        db.query(
          "update komentar set alasan_disembunyikan = 'x' where id = (select id from komentar where disembunyikan_pada is null limit 1)",
        ),
        /komentar_moderasi_utuh/,
      );
    });

    test("komentar: isi harus terpangkas dan 1-1000 karakter, usulan dihapus membawa komentarnya", async () => {
      await assert.rejects(
        db.query(
          `insert into komentar (proposal_id, akun_id, isi) values ($1, $2, ' spasi di depan')`,
          [USULAN_LAMPU_GANG, AKUN.warga],
        ),
        /komentar_isi_check/,
      );
      const { rows } = await db.query<{ id: string }>(
        `insert into proposals (title, category, estimated_budget, rw) values ('Uji cascade', 'sosial', 10000000, 1) returning id`,
      );
      await db.query(`insert into komentar (proposal_id, akun_id, isi) values ($1, $2, 'ikut terhapus')`, [rows[0].id, AKUN.warga]);
      await db.query("delete from proposals where id = $1", [rows[0].id]);
      assert.equal(await angka(db, "select count(*) as n from komentar where isi = 'ikut terhapus'"), 0);
    });

    test("RLS aktif di tabel baru dan tanpa policy", async () => {
      const { rows } = await db.query<{ relrowsecurity: boolean }>(
        "select relrowsecurity from pg_class where relname = 'komentar'",
      );
      assert.equal(rows[0].relrowsecurity, true);
      assert.equal(await angka(db, "select count(*) as n from pg_policies where tablename = 'komentar'"), 0);
    });
  });

  describe("hak akses fungsi", () => {
    const FUNGSI = [
      "galat_forum(text, integer)",
      "dukung_usulan(uuid, uuid)",
      "batal_dukung(uuid, uuid)",
      "ajukan_usulan(uuid, text, text, text, text, integer, bigint, extensions.vector)",
      "tambah_komentar(uuid, uuid, text)",
      "sembunyikan(uuid, text, uuid, text)",
      "cari_usulan_mirip(extensions.vector, integer)",
      "cari_usulan_mirip_teks(text, text, integer)",
    ];

    test("anon, authenticated, dan public tidak punya hak execute", async () => {
      for (const f of FUNGSI) {
        for (const peran of ["anon", "authenticated", "public"]) {
          const { rows } = await db.query<{ ok: boolean }>(
            `select has_function_privilege('${peran}', '${f}', 'execute') as ok`,
          );
          assert.equal(rows[0].ok, false, `${peran} masih bisa menjalankan ${f}`);
        }
      }
    });

    test("service_role tetap bisa", async () => {
      for (const f of FUNGSI) {
        const { rows } = await db.query<{ ok: boolean }>(
          `select has_function_privilege('service_role', '${f}', 'execute') as ok`,
        );
        assert.equal(rows[0].ok, true, `service_role tidak bisa menjalankan ${f}`);
      }
    });

    test("anon benar-benar ditolak saat memanggil fungsi", async () => {
      await db.exec("set role anon");
      try {
        await assert.rejects(
          db.query("select dukung_usulan($1, $2)", [AKUN.warga, USULAN_LAMPU_GANG]),
          /permission denied/,
        );
      } finally {
        await db.exec("reset role");
      }
    });
  });

  describe("pencarian usulan mirip", () => {
    /** Vektor satuan 384 dimensi yang condong ke satu sumbu, untuk uji urutan jarak. */
    const vektor = (sumbu: number, geser = 0): string => {
      const v = new Array<number>(384).fill(0);
      v[sumbu] = 1;
      v[(sumbu + 1) % 384] = geser;
      const norma = Math.hypot(...v);
      return `[${v.map((x) => x / norma).join(",")}]`;
    };

    test("cari_usulan_mirip mengurutkan menurut kosinus dan mengabaikan yang tersembunyi atau tertutup", async () => {
      const lampuGang = USULAN_LAMPU_GANG;
      const lampuPju = await idUsulan(db, "Lampu PJU jalan setapak RW 07");
      const posyandu = "6f1b3d0a-1001-4c8e-9a10-000000000002";
      const tersembunyi = "6f1b3d0a-1001-4c8e-9a10-000000000006"; // disembunyikan di tes sebelumnya
      const { rows: tutup } = await db.query<{ id: string }>("select id from proposals where title = 'Uji tertutup done'");

      await db.query("update proposals set embedding = $2 where id = $1", [lampuGang, vektor(0, 0)]);
      await db.query("update proposals set embedding = $2 where id = $1", [lampuPju, vektor(0, 0.5)]);
      await db.query("update proposals set embedding = $2 where id = $1", [posyandu, vektor(7, 0)]);
      await db.query("update proposals set embedding = $2 where id = $1", [tersembunyi, vektor(0, 0)]);
      await db.query("update proposals set embedding = $2 where id = $1", [tutup[0].id, vektor(0, 0)]);

      const { rows } = await db.query<{ id: string; kosinus: number; vote_count: number }>(
        "select id, kosinus, vote_count from cari_usulan_mirip($1, 10)",
        [vektor(0, 0)],
      );
      assert.deepEqual(rows.map((r) => r.id), [lampuGang, lampuPju, posyandu]);
      assert.ok(Math.abs(rows[0].kosinus - 1) < 1e-6);
      assert.ok(rows[1].kosinus < rows[0].kosinus && rows[1].kosinus > rows[2].kosinus);
      assert.ok(rows[0].vote_count > 0);
    });

    test("cari_usulan_mirip_teks (cadangan) menemukan usulan lampu untuk teks tentang lampu", async () => {
      const { rows } = await db.query<{ title: string }>(
        "select title from cari_usulan_mirip_teks('Lampu jalan gang RW 07 gelap', 'Lampu jalan di gang gelap, warga takut lewat malam.', 3)",
      );
      assert.equal(rows.length, 3);
      assert.match(rows[0].title, /Lampu/);
    });

    test("cari_usulan_mirip_teks menandai usulan yang belum punya embedding (supaya tidak terlewat)", async () => {
      const { rows } = await db.query<{ title: string; punya_embedding: boolean }>(
        "select title, punya_embedding from cari_usulan_mirip_teks('Lampu jalan menjahit', 'Lampu menjahit', 20) where title in ('Lampu jalan gang RW 07 gelap', 'Pelatihan menjahit untuk ibu rumah tangga')",
      );
      const peta = new Map(rows.map((r) => [r.title, r.punya_embedding]));
      assert.equal(peta.get("Lampu jalan gang RW 07 gelap"), true); // diisi di tes sebelumnya
      assert.equal(peta.get("Pelatihan menjahit untuk ibu rumah tangga"), false);
    });
  });
});
