// Tes SQL untuk migrasi 0005 (halaman admin), dijalankan di PGlite. Jalankan lewat `npm test`.
// Tidak menyentuh database Supabase. Urutan memuat sama dengan yang dijalankan pemilik proyek:
// 0001 -> 0002 -> seed.sql -> 0003 -> 0004 -> akun demo -> seed_forum.sql -> 0005.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { hitungPratinjau, hitungRekomendasi, type DasarHitung, type Perubahan, type UsulanHitung } from "../../lib/pratinjau.ts";
import { buatDatabase, muat, SEBELUM_FORUM, sidikRekomendasi } from "./pglite.ts";

const baseline = JSON.parse(
  readFileSync(new URL("./baseline-rekomendasi.json", import.meta.url), "utf8"),
) as { jumlahUsulan: number; jumlahDukungan: number; rekomendasi: unknown };

// Hash uji: hanya mengisi format; tidak ada yang masuk lewat akun ini.
const HASH = "$scrypt$ln=17,r=8,p=1$c2VlZC1ha3Vu$c2VlZC1ha3VuLXRhbnBhLXNhbmRp";
const HASH_BARU = "$scrypt$ln=17,r=8,p=1$c2FsdC1iYXJ1$a3VuY2ktYmFydS10YW5wYS1zYW5kaQ";

const AKUN = {
  warga: "00000000-0000-4000-8000-0000000000a1", // warga RW 07 nomor 69
  wargaKedua: "00000000-0000-4000-8000-0000000000a2", // warga RW 01 nomor 3
  tanpaWarga: "00000000-0000-4000-8000-0000000000a3",
  admin: "00000000-0000-4000-8000-0000000000a4",
  nonaktif: "00000000-0000-4000-8000-0000000000a5",
  admin2: "00000000-0000-4000-8000-0000000000a7",
} as const;
const TIDAK_ADA = "00000000-0000-4000-8000-00000000ffff";

const U = (n: number) => `6f1b3d0a-1001-4c8e-9a10-00000000000${n}`;
const LAMPU_GANG = U(1); // forum, RW 07, Rp 25 jt, 8 dukungan
const POSYANDU = U(2); // forum, RW 03, Rp 12,5 jt
const ATAP = U(3); // forum, RW 01, Rp 8 jt
const TONG_SAMPAH = U(4); // forum, RW 03, ada komentar tersembunyi
const MENJAHIT = U(5); // forum, RW 01, Rp 18 jt
const KOMENTAR_SPAM = "6f1b3d0a-3001-4c8e-9a10-000000000010";

const ALASAN_URGENSI = "Gang gelap dan berlubang; anak pengajian dan ibu-ibu rawan terjatuh tiap malam.";
const ALASAN = "Alasan yang cukup panjang untuk dibaca warga.";

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

const pindah = (
  db: PGlite,
  akun: string,
  usulan: string,
  ke: string,
  dibaca: string,
  o: { urgensi?: number | null; alasanUrgensi?: string | null; singkat?: string | null; alasan?: string | null } = {},
) =>
  panggil(
    db,
    "pindahkan_status($1, $2, $3, $4, $5, $6, $7, $8)",
    akun,
    usulan,
    ke,
    dibaca,
    o.urgensi ?? null,
    o.alasanUrgensi ?? null,
    o.singkat ?? null,
    o.alasan ?? null,
  );
const masukkan = (db: PGlite, usulan: string, urgensi = 8, akun: string = AKUN.admin) =>
  pindah(db, akun, usulan, "voting", "forum", { urgensi, alasanUrgensi: ALASAN_URGENSI });
const kembalikan = (db: PGlite, usulan: string, akun: string = AKUN.admin) =>
  pindah(db, akun, usulan, "forum", "voting", { alasan: ALASAN });

const ubahPagu = (db: PGlite, akun: string, pagu: number | null, versi: number, alasan = ALASAN) =>
  panggil(db, "ubah_pagu($1, $2, $3, $4)", akun, pagu, versi, alasan);
const ubahBobot = (db: PGlite, akun: string, p: number | null, u: number | null, m: number | null, versi: number, alasan = ALASAN) =>
  panggil(db, "ubah_bobot($1, $2, $3, $4, $5, $6)", akun, p, u, m, versi, alasan);
const sembunyikan = (db: PGlite, akun: string, jenis: string, id: string, alasan = ALASAN) =>
  panggil(db, "sembunyikan($1, $2, $3, $4)", akun, jenis, id, alasan);
const tampilkan = (db: PGlite, akun: string, jenis: string, id: string, alasan = ALASAN) =>
  panggil(db, "tampilkan_kembali($1, $2, $3, $4)", akun, jenis, id, alasan);
const buatAkun = (db: PGlite, akun: string, nama: string, hash: string, warga: string) =>
  panggil(db, "buat_akun_warga($1, $2, $3, $4)", akun, nama, hash, warga);

async function idWarga(db: PGlite, nomor: number): Promise<string> {
  return (await baris<{ id: string }>(db, "select id from warga where nomor = $1", nomor))[0].id;
}

async function siapkan(): Promise<PGlite> {
  const db = await buatDatabase();
  await muat(db, ...SEBELUM_FORUM, "m0004");
  await db.exec(`
    insert into akun (id, nama_pengguna, hash_kata_sandi, peran, warga_id, aktif) values
      ('${AKUN.warga}',      'uji-warga',    '${HASH}', 'warga', (select id from warga where nomor = 69), true),
      ('${AKUN.wargaKedua}', 'uji-warga-2',  '${HASH}', 'warga', (select id from warga where nomor = 3),  true),
      ('${AKUN.tanpaWarga}', 'uji-tanpa',    '${HASH}', 'warga', null, true),
      ('${AKUN.admin}',      'uji-admin',    '${HASH}', 'admin', null, true),
      ('${AKUN.nonaktif}',   'uji-nonaktif', '${HASH}', 'warga', (select id from warga where nomor = 4), false),
      ('${AKUN.admin2}',     'uji-admin-2',  '${HASH}', 'admin', null, true),
      ('00000000-0000-4000-8000-0000000000a6', 'warga', '${HASH}', 'warga', null, true);
  `);
  await muat(db, "seedForum");
  await muat(db, "m0005");
  return db;
}

describe("migrasi 0005", () => {
  let db: PGlite;

  before(async () => {
    db = await siapkan();
  });
  after(async () => {
    await db.close();
  });

  describe("angka halaman utama tidak berubah", () => {
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

    test("migrasi tidak menambah atau menghapus usulan, dukungan, komentar, atau akun", async () => {
      assert.equal(await angka(db, "select count(*) as n from proposals"), 13);
      assert.equal(await angka(db, "select count(*) as n from komentar"), 15);
      // 7 akun uji (termasuk demo 'warga') + 7 akun seed-* dari seed_forum.sql.
      assert.equal(await angka(db, "select count(*) as n from akun"), 14);
    });
  });

  describe("struktur", () => {
    test("pengaturan_anggaran: satu baris Rp 300 juta, versi 1", async () => {
      const r = await baris<{ pagu: string; versi: number }>(db, "select pagu::text, versi from pengaturan_anggaran");
      assert.deepEqual(r, [{ pagu: "300000000", versi: 1 }]);
    });

    test("pengaturan_anggaran hanya boleh satu baris dan pagunya dibatasi Rp 10 juta sampai Rp 10 miliar", async () => {
      await assert.rejects(db.query("insert into pengaturan_anggaran (id, pagu) values (2, 300000000)"), /check|violates/);
      await assert.rejects(db.query("update pengaturan_anggaran set pagu = 9999999"), /check|violates/);
      await assert.rejects(db.query("update pengaturan_anggaran set pagu = 10000000001"), /check|violates/);
      await db.query("update pengaturan_anggaran set pagu = 10000000"); // batas bawah sah
      await db.query("update pengaturan_anggaran set pagu = 300000000");
      await db.query("update pengaturan_anggaran set versi = 1"); // dikembalikan
    });

    test("scoring_weights punya versi 1", async () => {
      assert.equal(await angka(db, "select versi as n from scoring_weights"), 1);
    });

    test("entri pagu awal dari seed menjadi budget_change", async () => {
      const r = await baris<{ log_type: string; message: string }>(
        db,
        "select log_type, message from accountability_logs where message like 'Pagu anggaran tahun berjalan%'",
      );
      assert.deepEqual(r.map((x) => x.log_type), ["budget_change"]);
    });

    test("log_type mengenal budget_change dan tetap menolak jenis lain", async () => {
      await db.query("insert into accountability_logs (log_type, message) values ('budget_change', 'uji')");
      await assert.rejects(db.query("insert into accountability_logs (log_type, message) values ('lain', 'uji')"), /check|violates/);
      await db.query("delete from accountability_logs where message = 'uji'");
    });

    test("akun: kolom baru berbawaan false/null dan akun lama tidak berubah", async () => {
      const r = await baris<{ n: number }>(db, "select count(*)::int as n from akun where harus_ganti_sandi or dibuat_oleh is not null");
      assert.equal(r[0].n, 0);
    });

    test("satu warga paling banyak satu akun (indeks unik parsial)", async () => {
      await assert.rejects(
        db.query(
          `insert into akun (nama_pengguna, hash_kata_sandi, peran, warga_id)
           values ('ganda', $1, 'warga', (select warga_id from akun where id = $2))`,
          [HASH, AKUN.warga],
        ),
        /akun_warga_unik|unique|duplicate/,
      );
      // Akun tanpa warga boleh banyak (admin, akun belum tertaut).
      await db.query("insert into akun (nama_pengguna, hash_kata_sandi, peran) values ('tanpa-1', $1, 'admin'), ('tanpa-2', $1, 'admin')", [HASH]);
      await db.query("delete from akun where nama_pengguna in ('tanpa-1', 'tanpa-2')");
    });

    test("RLS aktif di tabel baru dan tanpa policy", async () => {
      for (const t of ["pengaturan_anggaran", "jejak_admin"]) {
        const r = await baris<{ relrowsecurity: boolean }>(db, "select relrowsecurity from pg_class where relname = $1", t);
        assert.equal(r[0].relrowsecurity, true, t);
        assert.equal(await angka(db, "select count(*) as n from pg_policies where tablename = $1", t), 0, t);
      }
    });

    test("anon tidak bisa membaca tabel baru maupun view admin", async () => {
      await db.exec("set role anon");
      try {
        for (const t of ["pengaturan_anggaran", "jejak_admin", "v_admin_akun", "v_admin_usulan", "v_admin_komentar", "v_jejak_admin"]) {
          const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from ${t}`);
          assert.equal(rows[0].n, 0, `${t} terbaca oleh anon`);
        }
      } finally {
        await db.exec("reset role");
      }
    });
  });

  describe("hak akses fungsi", () => {
    const FUNGSI = [
      "galat_bidang(text)",
      "rupiah_teks(bigint)",
      "pindahkan_status(uuid, uuid, text, text, integer, text, text, text)",
      "ubah_pagu(uuid, bigint, integer, text)",
      "ubah_bobot(uuid, integer, integer, integer, integer, text)",
      "tampilkan_kembali(uuid, text, uuid, text)",
      "sembunyikan(uuid, text, uuid, text)",
      "cari_warga_bebas(uuid, text, integer)",
      "buat_akun_warga(uuid, text, text, uuid)",
      "atur_ulang_sandi(uuid, uuid, text)",
      "atur_aktif(uuid, uuid, boolean)",
      "ganti_sandi_sendiri(uuid, text)",
    ];

    test("anon, authenticated, dan public tidak punya hak execute", async () => {
      for (const f of FUNGSI) {
        for (const peran of ["anon", "authenticated", "public"]) {
          const r = await baris<{ ok: boolean }>(db, `select has_function_privilege('${peran}', '${f}', 'execute') as ok`);
          assert.equal(r[0].ok, false, `${peran} masih bisa menjalankan ${f}`);
        }
      }
    });

    test("service_role tetap bisa", async () => {
      for (const f of FUNGSI) {
        const r = await baris<{ ok: boolean }>(db, `select has_function_privilege('service_role', '${f}', 'execute') as ok`);
        assert.equal(r[0].ok, true, `service_role tidak bisa menjalankan ${f}`);
      }
    });

    test("anon benar-benar ditolak saat memanggil fungsi admin", async () => {
      await db.exec("set role anon");
      try {
        await assert.rejects(db.query("select ubah_pagu($1, 300000000, 1, 'alasan yang cukup')", [AKUN.admin]), /permission denied/);
        await assert.rejects(db.query("select atur_aktif($1, $2, false)", [AKUN.admin, AKUN.warga]), /permission denied/);
      } finally {
        await db.exec("reset role");
      }
    });
  });

  describe("setiap fungsi menolak yang bukan admin aktif", () => {
    const kasus: [string, (akun: string) => Promise<Hasil>][] = [
      ["pindahkan_status", (a) => masukkan(db, LAMPU_GANG, 8, a)],
      ["ubah_pagu", (a) => ubahPagu(db, a, 350_000_000, 1)],
      ["ubah_bobot", (a) => ubahBobot(db, a, 25, 45, 30, 1)],
      ["tampilkan_kembali", (a) => tampilkan(db, a, "komentar", KOMENTAR_SPAM)],
      ["cari_warga_bebas", (a) => panggil(db, "cari_warga_bebas($1, 'agus')", a)],
      ["buat_akun_warga", (a) => buatAkun(db, a, "uji-baru", HASH_BARU, AKUN.warga)],
      ["atur_ulang_sandi", (a) => panggil(db, "atur_ulang_sandi($1, $2, $3)", a, AKUN.wargaKedua, HASH_BARU)],
      ["atur_aktif", (a) => panggil(db, "atur_aktif($1, $2, false)", a, AKUN.wargaKedua)],
      ["sembunyikan", (a) => sembunyikan(db, a, "komentar", KOMENTAR_SPAM)],
    ];

    for (const [nama, jalankan] of kasus) {
      test(nama, async () => {
        assert.equal((await jalankan(AKUN.warga)).kode, "bukan_admin", "warga");
        assert.equal((await jalankan(AKUN.tanpaWarga)).kode, "bukan_admin", "warga tanpa warga_id");
        assert.equal((await jalankan(AKUN.nonaktif)).kode, "akun_tidak_aktif", "akun nonaktif");
        assert.equal((await jalankan(TIDAK_ADA)).kode, "akun_tidak_aktif", "akun yang tidak ada");
      });
    }

    test("tidak ada yang berubah akibat panggilan yang ditolak", async () => {
      assert.equal(await angka(db, "select count(*) as n from proposals where status = 'voting'"), 7);
      assert.equal(await angka(db, "select versi as n from pengaturan_anggaran"), 1);
      assert.equal(await angka(db, "select versi as n from scoring_weights"), 1);
      assert.equal(await angka(db, "select count(*) as n from jejak_admin"), 0);
      assert.equal(await angka(db, "select count(*) as n from akun where dibuat_oleh is not null"), 0);
    });

    test("ganti_sandi_sendiri menolak akun nonaktif dan yang tidak ada", async () => {
      assert.equal((await panggil(db, "ganti_sandi_sendiri($1, $2)", AKUN.nonaktif, HASH_BARU)).kode, "akun_tidak_aktif");
      assert.equal((await panggil(db, "ganti_sandi_sendiri($1, $2)", TIDAK_ADA, HASH_BARU)).kode, "akun_tidak_aktif");
    });
  });

  describe("pindahkan_status", () => {
    test("forum -> voting: status, urgensi, alasan, dan nama singkat tersimpan", async () => {
      const h = await pindah(db, AKUN.admin, LAMPU_GANG, "voting", "forum", {
        urgensi: 8,
        alasanUrgensi: `  ${ALASAN_URGENSI}  `,
        singkat: "  Lampu gang  ",
      });
      assert.deepEqual([h.ok, h.status, h.proposal_id], [true, "voting", LAMPU_GANG]);
      const [p] = await baris<{ status: string; urgency_score: number; urgency_reason: string; nama_singkat: string }>(
        db,
        "select status, urgency_score, urgency_reason, nama_singkat from proposals where id = $1",
        LAMPU_GANG,
      );
      assert.deepEqual(p, { status: "voting", urgency_score: 8, urgency_reason: ALASAN_URGENSI, nama_singkat: "Lampu gang" });
    });

    test("menulis status_change dengan nama pengguna admin, bukan 'admin' tertanam", async () => {
      const [l] = await baris<{ log_type: string; actor: string; message: string; proposal_id: string; detail: Record<string, unknown> }>(
        db,
        "select log_type, actor, message, proposal_id, detail from accountability_logs where proposal_id = $1 and log_type = 'status_change' order by id desc limit 1",
        LAMPU_GANG,
      );
      assert.equal(l.actor, "uji-admin");
      assert.equal(l.message, `Usulan dimasukkan ke hitungan anggaran dengan urgensi 8 dari 10. Alasan: ${ALASAN_URGENSI}`);
      assert.deepEqual(l.detail, { dari: "forum", ke: "voting", urgensi: 8, alasan: ALASAN_URGENSI });
    });

    test("usulan baru ikut dihitung: rekomendasi_resmi kini berisi delapan usulan", async () => {
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000)"), 8);
    });

    test("perpindahan status tidak menulis jejak admin tertutup", async () => {
      assert.equal(await angka(db, "select count(*) as n from jejak_admin"), 0);
    });

    test("forum -> voting tanpa urgensi atau alasan urgensi ditolak per bidang", async () => {
      const dasar = { urgensi: 8, alasanUrgensi: ALASAN_URGENSI };
      const kasus: [string, Parameters<typeof pindah>[5]][] = [
        ["urgensi", { ...dasar, urgensi: null }],
        ["urgensi", { ...dasar, urgensi: 0 }],
        ["urgensi", { ...dasar, urgensi: 11 }],
        ["alasan_urgensi", { ...dasar, alasanUrgensi: null }],
        ["alasan_urgensi", { ...dasar, alasanUrgensi: "terlalu pendek" }],
        ["alasan_urgensi", { ...dasar, alasanUrgensi: "x".repeat(501) }],
        ["alasan_urgensi", { ...dasar, alasanUrgensi: "                              " }],
        ["nama_singkat", { ...dasar, singkat: "x" }],
        ["nama_singkat", { ...dasar, singkat: "x".repeat(25) }],
      ];
      for (const [bidang, o] of kasus) {
        const h = await pindah(db, AKUN.admin, POSYANDU, "voting", "forum", o);
        assert.deepEqual([h.ok, h.kode, h.bidang], [false, "tidak_valid", bidang], JSON.stringify(o).slice(0, 80));
      }
      assert.equal(await angka(db, "select count(*) as n from proposals where id = $1 and status = 'forum'", POSYANDU), 1);
    });

    test("status yang dibaca sudah berubah: ditolak dengan status sekarang (bentrok)", async () => {
      const h = await pindah(db, AKUN.admin2, LAMPU_GANG, "rejected", "forum", { alasan: ALASAN });
      assert.deepEqual([h.ok, h.kode, h.status_sekarang], [false, "bentrok", "voting"]);
      assert.equal(await angka(db, "select count(*) as n from proposals where id = $1 and status = 'voting'", LAMPU_GANG), 1);
    });

    test("transisi yang tidak diizinkan ditolak", async () => {
      // voting -> rejected dan voting -> voting
      assert.equal((await pindah(db, AKUN.admin, LAMPU_GANG, "rejected", "voting", { alasan: ALASAN })).kode, "transisi_tidak_diizinkan");
      assert.equal((await pindah(db, AKUN.admin, LAMPU_GANG, "voting", "voting", { urgensi: 5, alasanUrgensi: ALASAN_URGENSI })).kode, "transisi_tidak_diizinkan");
      // forum -> forum
      assert.equal((await pindah(db, AKUN.admin, POSYANDU, "forum", "forum", { alasan: ALASAN })).kode, "transisi_tidak_diizinkan");
      // status tujuan di luar yang dikenal: approved, done, ngawur
      for (const ke of ["approved", "done", "ngawur"]) {
        const h = await pindah(db, AKUN.admin, POSYANDU, ke, "forum", { alasan: ALASAN });
        assert.deepEqual([h.kode, h.bidang], ["tidak_valid", "ke"], ke);
      }
      // approved -> forum / voting
      const { rows } = await db.query<{ id: string }>(
        `insert into proposals (title, category, estimated_budget, status, source, rw, urgency_score)
         values ('Uji approved', 'sosial', 10000000, 'approved', 'admin', 1, 5) returning id`,
      );
      assert.equal((await pindah(db, AKUN.admin, rows[0].id, "forum", "approved", { alasan: ALASAN })).kode, "transisi_tidak_diizinkan");
      assert.equal((await pindah(db, AKUN.admin, rows[0].id, "voting", "approved", { urgensi: 5, alasanUrgensi: ALASAN_URGENSI })).kode, "transisi_tidak_diizinkan");
      await db.query("delete from proposals where id = $1", [rows[0].id]);
    });

    test("forum -> rejected ('Tidak dilanjutkan') wajib alasan, urgensi tetap kosong", async () => {
      assert.deepEqual(
        [(await pindah(db, AKUN.admin, TONG_SAMPAH, "rejected", "forum", { alasan: "pendek" })).bidang],
        ["alasan"],
      );
      const h = await pindah(db, AKUN.admin, TONG_SAMPAH, "rejected", "forum", { alasan: `  ${ALASAN}  ` });
      assert.equal(h.ok, true);
      const [p] = await baris<{ status: string; urgency_score: number | null }>(db, "select status, urgency_score from proposals where id = $1", TONG_SAMPAH);
      assert.deepEqual(p, { status: "rejected", urgency_score: null });
      const [l] = await baris<{ actor: string; message: string; detail: Record<string, unknown> }>(
        db,
        "select actor, message, detail from accountability_logs where proposal_id = $1 and log_type = 'status_change'",
        TONG_SAMPAH,
      );
      assert.equal(l.actor, "uji-admin");
      assert.equal(l.message, `Usulan tidak dilanjutkan oleh admin desa. Alasan: ${ALASAN}`);
      assert.deepEqual(l.detail, { dari: "forum", ke: "rejected", alasan: ALASAN });
    });

    test("usulan yang sudah tidak dilanjutkan tidak bisa dipindahkan lagi dari sini", async () => {
      assert.equal((await pindah(db, AKUN.admin, TONG_SAMPAH, "forum", "rejected", { alasan: ALASAN })).kode, "transisi_tidak_diizinkan");
    });

    test("batasan urgensi hanya longgar untuk rejected: voting, approved, dan done tetap wajib bernilai", async () => {
      for (const status of ["voting", "approved", "done"]) {
        await assert.rejects(
          db.query(`insert into proposals (title, category, estimated_budget, status, rw) values ('Uji', 'sosial', 1000000, $1, 1)`, [status]),
          /proposals_urgensi_wajib_setelah_forum|violates/,
          status,
        );
      }
      await db.query(`insert into proposals (title, category, estimated_budget, status, rw) values ('Uji tolak', 'sosial', 1000000, 'rejected', 1)`);
      await db.query("delete from proposals where title = 'Uji tolak'");
    });

    test("voting -> forum: urgensi dikosongkan, jejaknya mencatat nilai sebelumnya, usulan keluar dari hitungan", async () => {
      const h = await kembalikan(db, LAMPU_GANG);
      assert.equal(h.ok, true);
      const [p] = await baris<{ status: string; urgency_score: number | null; urgency_reason: string | null }>(
        db,
        "select status, urgency_score, urgency_reason from proposals where id = $1",
        LAMPU_GANG,
      );
      assert.deepEqual(p, { status: "forum", urgency_score: null, urgency_reason: null });
      const [l] = await baris<{ actor: string; message: string; detail: Record<string, unknown> }>(
        db,
        "select actor, message, detail from accountability_logs where proposal_id = $1 and log_type = 'status_change' order by id desc limit 1",
        LAMPU_GANG,
      );
      assert.equal(l.actor, "uji-admin");
      assert.equal(l.message, `Usulan dikembalikan ke pembahasan warga dan tidak lagi dihitung dalam anggaran. Alasan: ${ALASAN}`);
      assert.deepEqual(l.detail, { dari: "voting", ke: "forum", alasan: ALASAN, urgensi_sebelumnya: 8 });
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000)"), 7);
    });

    test("voting -> forum tanpa alasan ditolak", async () => {
      await masukkan(db, LAMPU_GANG);
      assert.deepEqual([(await pindah(db, AKUN.admin, LAMPU_GANG, "forum", "voting", { alasan: "pendek" })).bidang], ["alasan"]);
      assert.deepEqual([(await pindah(db, AKUN.admin, LAMPU_GANG, "forum", "voting", {})).bidang], ["alasan"]);
      await kembalikan(db, LAMPU_GANG);
    });

    test("usulan tersembunyi, yang tidak ada, dan yang tanpa RW ditolak", async () => {
      await sembunyikan(db, AKUN.admin, "usulan", ATAP);
      assert.equal((await masukkan(db, ATAP)).kode, "disembunyikan");
      assert.equal((await masukkan(db, TIDAK_ADA)).kode, "tidak_ditemukan");
      const { rows } = await db.query<{ id: string }>(
        `insert into proposals (title, category, estimated_budget, source) values ('Uji tanpa RW', 'sosial', 5000000, 'admin') returning id`,
      );
      assert.equal((await masukkan(db, rows[0].id)).kode, "tanpa_rw");
      await db.query("delete from proposals where id = $1", [rows[0].id]);
      await tampilkan(db, AKUN.admin, "usulan", ATAP);
    });

    test("satu perpindahan menulis tepat satu log publik", async () => {
      const sebelum = await angka(db, "select count(*) as n from accountability_logs");
      await masukkan(db, POSYANDU, 7);
      assert.equal(await angka(db, "select count(*) as n from accountability_logs"), sebelum + 1);
      await kembalikan(db, POSYANDU);
    });

    test("usulan ke-17 ditolak; yang tersembunyi tidak dihitung; ruang terbuka lagi setelah dikembalikan", async () => {
      // Isi hingga 16 usulan voting (tidak tersembunyi) lewat usulan tambahan langsung.
      const sekarang = await angka(db, "select count(*) as n from proposals where status = 'voting' and disembunyikan_pada is null");
      assert.equal(sekarang, 7);
      for (let i = 0; i < 16 - sekarang; i++) {
        await db.query(
          `insert into proposals (title, category, estimated_budget, status, source, rw, urgency_score)
           values ($1, 'sosial', 5000000, 'voting', 'admin', 1, 4)`,
          [`Uji penuh ${i}`],
        );
      }
      const penuh = await masukkan(db, LAMPU_GANG);
      assert.deepEqual([penuh.ok, penuh.kode, penuh.jumlah, penuh.batas], [false, "batas_voting", 16, 16]);
      assert.equal(await angka(db, "select count(*) as n from proposals where id = $1 and status = 'forum'", LAMPU_GANG), 1, "tidak ada yang berubah");

      // Satu usulan tersembunyi tidak dihitung terhadap batas, jadi ruang terbuka.
      const [uji0] = await baris<{ id: string }>(db, "select id from proposals where title = 'Uji penuh 0'");
      await sembunyikan(db, AKUN.admin, "usulan", uji0.id);
      assert.equal((await masukkan(db, LAMPU_GANG)).ok, true);

      // Menampilkan kembali yang tersembunyi akan membuatnya 17: ditolak dengan alasan yang sama.
      const lagi = await tampilkan(db, AKUN.admin, "usulan", uji0.id);
      assert.deepEqual([lagi.ok, lagi.kode, lagi.jumlah], [false, "batas_voting", 16]);

      // Dikembalikan satu, baru bisa ditampilkan.
      assert.equal((await kembalikan(db, LAMPU_GANG)).ok, true);
      assert.equal((await tampilkan(db, AKUN.admin, "usulan", uji0.id)).ok, true);

      // Tepat 16 yang dihitung, tidak lebih: pilih_optimal akan galat bila 17. (skor_usulan dipanggil
      // langsung: rekomendasi_resmi dengan 16 usulan mencoba 65.536 kombinasi dan lambat di PGlite.)
      assert.equal(await angka(db, "select count(*) as n from skor_usulan(30, 40, 30)"), 16);

      await db.query("delete from accountability_logs where proposal_id in (select id from proposals where title like 'Uji penuh%')");
      await db.query("delete from proposals where title like 'Uji penuh%'");
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000)"), 7);
    });

    test("angka halaman utama kembali ke baseline setelah semua perpindahan dikembalikan", async () => {
      assert.deepEqual(JSON.parse(await sidikRekomendasi(db)), baseline.rekomendasi);
    });
  });

  describe("ubah_pagu", () => {
    test("pagu tidak sah ditolak: di luar rentang, kosong", async () => {
      for (const p of [9_999_999, 10_000_000_001, 0, -1, null]) {
        const h = await ubahPagu(db, AKUN.admin, p, 1);
        assert.deepEqual([h.ok, h.kode, h.bidang], [false, "tidak_valid", "pagu"], String(p));
      }
      assert.deepEqual([(await ubahPagu(db, AKUN.admin, 350_000_000, 1, "pendek")).bidang], ["alasan"]);
      assert.equal(await angka(db, "select versi as n from pengaturan_anggaran"), 1);
    });

    test("menyimpan: pagu baru, versi naik, log budget_change dengan nama admin dan alasannya", async () => {
      const h = await ubahPagu(db, AKUN.admin, 350_000_000, 1, `  ${ALASAN}  `);
      assert.deepEqual([h.ok, h.versi, h.pagu], [true, 2, 350_000_000]);
      const [s] = await baris<{ pagu: string; versi: number }>(db, "select pagu::text, versi from pengaturan_anggaran");
      assert.deepEqual(s, { pagu: "350000000", versi: 2 });

      const [l] = await baris<{ log_type: string; actor: string; message: string; proposal_id: string | null; detail: Record<string, unknown> }>(
        db,
        "select log_type, actor, message, proposal_id, detail from accountability_logs where log_type = 'budget_change' order by id desc limit 1",
      );
      assert.equal(l.actor, "uji-admin");
      assert.equal(l.proposal_id, null);
      assert.equal(l.message, `Pagu anggaran diubah dari Rp 300.000.000 menjadi Rp 350.000.000. Alasan: ${ALASAN}`);
      assert.deepEqual(l.detail, { pagu_lama: 300_000_000, pagu_baru: 350_000_000, alasan: ALASAN });
    });

    test("versi yang dibaca sudah berubah: ditolak dengan nilai terbaru dan jamnya, tidak menimpa", async () => {
      const h = await ubahPagu(db, AKUN.admin2, 200_000_000, 1);
      assert.deepEqual([h.ok, h.kode, h.versi, h.pagu], [false, "bentrok", 2, 350_000_000]);
      assert.ok(typeof h.diubah_pada === "string" && !Number.isNaN(Date.parse(h.diubah_pada as string)));
      assert.equal(await angka(db, "select pagu as n from pengaturan_anggaran"), 350_000_000);
    });

    test("pagu yang sama dengan yang berlaku: tidak_berubah, tanpa log", async () => {
      const sebelum = await angka(db, "select count(*) as n from accountability_logs where log_type = 'budget_change'");
      assert.equal((await ubahPagu(db, AKUN.admin, 350_000_000, 2)).kode, "tidak_berubah");
      assert.equal(await angka(db, "select count(*) as n from accountability_logs where log_type = 'budget_change'"), sebelum);
    });

    test("perubahan pagu tidak mengubah rekomendasi_resmi(300000000) (pagu diberikan sebagai argumen)", async () => {
      assert.deepEqual(JSON.parse(await sidikRekomendasi(db)), baseline.rekomendasi);
    });

    test("dikembalikan ke Rp 300 juta (versi 3)", async () => {
      assert.equal((await ubahPagu(db, AKUN.admin, 300_000_000, 2)).versi, 3);
    });
  });

  describe("ubah_bobot", () => {
    test("bobot tidak sah ditolak per bidang", async () => {
      const kasus: [number | null, number | null, number | null, string][] = [
        [null, 40, 30, "popularitas"],
        [30, null, 30, "urgensi"],
        [30, 40, null, "pemerataan"],
        [-1, 71, 30, "popularitas"],
        [30, 101, 0, "urgensi"],
        [30, 40, 25, "jumlah"],
        [30, 40, 35, "jumlah"],
        [0, 0, 0, "jumlah"],
      ];
      for (const [p, u, m, bidang] of kasus) {
        const h = await ubahBobot(db, AKUN.admin, p, u, m, 1);
        assert.deepEqual([h.ok, h.kode, h.bidang], [false, "tidak_valid", bidang], `${p}/${u}/${m}`);
      }
      assert.deepEqual([(await ubahBobot(db, AKUN.admin, 25, 45, 30, 1, "pendek")).bidang], ["alasan"]);
      assert.equal(await angka(db, "select versi as n from scoring_weights"), 1);
    });

    test("menyimpan: bobot dan versi berubah, log jujur soal pelaku dan alasan", async () => {
      const h = await ubahBobot(db, AKUN.admin, 25, 45, 30, 1, `  ${ALASAN}  `);
      assert.deepEqual([h.ok, h.versi], [true, 2]);
      const [w] = await baris<{ w_popularitas: number; w_urgensi: number; w_pemerataan: number; catatan: string; versi: number }>(
        db,
        "select w_popularitas::int, w_urgensi::int, w_pemerataan::int, catatan, versi from scoring_weights",
      );
      assert.deepEqual(w, { w_popularitas: 25, w_urgensi: 45, w_pemerataan: 30, catatan: ALASAN, versi: 2 });

      const log = await baris<{ actor: string; message: string; detail: Record<string, unknown> }>(
        db,
        "select actor, message, detail from accountability_logs where log_type = 'weight_change' order by id desc",
      );
      assert.equal(log[0].actor, "uji-admin", "pelaku sebenarnya, bukan 'admin' tertanam");
      assert.equal(
        log[0].message,
        `Bobot penilaian diubah: popularitas 30 menjadi 25, urgensi 40 menjadi 45, pemerataan 30 menjadi 30. Alasan: ${ALASAN}`,
      );
      assert.deepEqual(log[0].detail, {
        sebelum: { popularitas: 30, urgensi: 40, pemerataan: 30 },
        sesudah: { popularitas: 25, urgensi: 45, pemerataan: 30 },
        alasan: ALASAN,
      });
      assert.equal(log.length, 2, "tepat satu log baru (plus entri seed)");
    });

    test("versi lama ditolak dengan bobot terbaru", async () => {
      const h = await ubahBobot(db, AKUN.admin2, 10, 80, 10, 1);
      assert.deepEqual([h.ok, h.kode, h.versi, h.popularitas, h.urgensi, h.pemerataan], [false, "bentrok", 2, 25, 45, 30]);
      assert.ok(typeof h.diubah_pada === "string");
    });

    test("bobot yang sama: tidak_berubah, tanpa log", async () => {
      const sebelum = await angka(db, "select count(*) as n from accountability_logs where log_type = 'weight_change'");
      assert.equal((await ubahBobot(db, AKUN.admin, 25, 45, 30, 2)).kode, "tidak_berubah");
      assert.equal(await angka(db, "select count(*) as n from accountability_logs where log_type = 'weight_change'"), sebelum);
    });

    test("pelaku tidak bocor ke perubahan berikutnya: perubahan lewat SQL tetap dicatat seperti dulu", async () => {
      const { rows } = await db.query<{ p: string | null; a: string | null }>(
        "select current_setting('suara.pelaku', true) as p, current_setting('suara.alasan', true) as a",
      );
      assert.ok(!rows[0].p && !rows[0].a, "set_config lokal tidak tersisa");

      await db.query("update scoring_weights set w_popularitas = 35, w_urgensi = 35, w_pemerataan = 30, catatan = 'Diubah lewat SQL Editor'");
      const [l] = await baris<{ actor: string; message: string }>(
        db,
        "select actor, message from accountability_logs where log_type = 'weight_change' order by id desc limit 1",
      );
      assert.deepEqual(l, { actor: "admin", message: "Diubah lewat SQL Editor" });
    });

    test("bobot yang jumlahnya bukan 100 ditolak juga oleh batasan tabel", async () => {
      await assert.rejects(db.query("update scoring_weights set w_popularitas = 50"), /scoring_weights_jumlah_100|violates/);
    });

    test("dikembalikan ke 30/40/30 tanpa mengubah baseline", async () => {
      assert.equal((await ubahBobot(db, AKUN.admin, 30, 40, 30, 2)).ok, true);
      assert.deepEqual(JSON.parse(await sidikRekomendasi(db)), baseline.rekomendasi);
    });
  });

  describe("sembunyikan dan tampilkan_kembali", () => {
    test("sembunyikan mencatat siapa di jejak tertutup; jejak publik tetap hanya 'admin'", async () => {
      const h = await sembunyikan(db, AKUN.admin, "komentar", "6f1b3d0a-3001-4c8e-9a10-000000000001", "Berisi data pribadi warga.");
      assert.equal(h.ok, true);
      const [l] = await baris<{ actor: string; detail: Record<string, unknown> }>(
        db,
        "select actor, detail from accountability_logs where log_type = 'moderation' order by id desc limit 1",
      );
      assert.equal(l.actor, "admin");
      assert.deepEqual(l.detail, { jenis: "komentar", id: "6f1b3d0a-3001-4c8e-9a10-000000000001", alasan: "Berisi data pribadi warga." });
      const [j] = await baris<{ akun_id: string; aksi: string; detail: Record<string, unknown> }>(
        db,
        "select akun_id, aksi, detail from jejak_admin order by id desc limit 1",
      );
      assert.deepEqual(j, { akun_id: AKUN.admin, aksi: "sembunyikan", detail: { jenis: "komentar", id: "6f1b3d0a-3001-4c8e-9a10-000000000001" } });
    });

    test("tampilkan_kembali membalik sembunyikan: isi tampil lagi, alasan dibersihkan, log dan jejak tercatat", async () => {
      const id = "6f1b3d0a-3001-4c8e-9a10-000000000001";
      assert.equal((await baris<{ isi: string | null }>(db, "select isi from v_komentar where id = $1", id))[0].isi, null);

      const h = await tampilkan(db, AKUN.admin2, "komentar", id, "  Ternyata tidak memuat data pribadi.  ");
      assert.deepEqual([h.ok, h.proposal_id], [true, U(1)]);

      const [k] = await baris<{ disembunyikan_pada: string | null; alasan_disembunyikan: string | null }>(
        db,
        "select disembunyikan_pada, alasan_disembunyikan from komentar where id = $1",
        id,
      );
      assert.deepEqual(k, { disembunyikan_pada: null, alasan_disembunyikan: null });
      assert.ok((await baris<{ isi: string | null }>(db, "select isi from v_komentar where id = $1", id))[0].isi);

      const [l] = await baris<{ actor: string; message: string; proposal_id: string; detail: Record<string, unknown> }>(
        db,
        "select actor, message, proposal_id, detail from accountability_logs where log_type = 'moderation' order by id desc limit 1",
      );
      assert.equal(l.actor, "admin");
      assert.equal(l.proposal_id, U(1));
      assert.equal(l.message, "Satu komentar ditampilkan kembali oleh admin desa. Alasan: Ternyata tidak memuat data pribadi.");
      assert.deepEqual(l.detail, { jenis: "komentar", id, alasan: "Ternyata tidak memuat data pribadi.", aksi: "tampilkan" });

      const [j] = await baris<{ akun_id: string; aksi: string }>(db, "select akun_id, aksi from jejak_admin order by id desc limit 1");
      assert.deepEqual(j, { akun_id: AKUN.admin2, aksi: "tampilkan" });
    });

    test("menampilkan kembali usulan: kolom moderasi bersih, pesan menyebut alasan", async () => {
      await sembunyikan(db, AKUN.admin, "usulan", MENJAHIT, "Duplikat dengan usulan lain.");
      assert.equal((await baris<{ title: string | null }>(db, "select title from v_usulan where id = $1", MENJAHIT))[0].title, null);
      const h = await tampilkan(db, AKUN.admin, "usulan", MENJAHIT, "Ternyata bukan duplikat.");
      assert.equal(h.ok, true);
      const [p] = await baris<{ disembunyikan_pada: string | null; alasan_disembunyikan: string | null }>(
        db,
        "select disembunyikan_pada, alasan_disembunyikan from proposals where id = $1",
        MENJAHIT,
      );
      assert.deepEqual(p, { disembunyikan_pada: null, alasan_disembunyikan: null });
      const [l] = await baris<{ message: string }>(db, "select message from accountability_logs where log_type = 'moderation' order by id desc limit 1");
      assert.equal(l.message, "Usulan ditampilkan kembali oleh admin desa. Alasan: Ternyata bukan duplikat.");
    });

    test("usulan voting yang ditampilkan kembali dicatat kembali dihitung, dan ikut skor lagi", async () => {
      const [jalan] = await baris<{ id: string }>(db, "select id from proposals where title like 'Perbaikan jalan%'");
      await sembunyikan(db, AKUN.admin, "usulan", jalan.id);
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000)"), 6);
      await tampilkan(db, AKUN.admin, "usulan", jalan.id);
      assert.equal(await angka(db, "select count(*) as n from rekomendasi_resmi(300000000)"), 7);
      const [l] = await baris<{ message: string }>(db, "select message from accountability_logs where log_type = 'moderation' order by id desc limit 1");
      assert.match(l.message, /Usulan ini kembali dihitung dalam anggaran\.$/);
      assert.deepEqual(JSON.parse(await sidikRekomendasi(db)), baseline.rekomendasi);
    });

    test("alasan wajib, jenis dikenal, dan konten harus memang sedang tersembunyi", async () => {
      assert.deepEqual([(await tampilkan(db, AKUN.admin, "komentar", KOMENTAR_SPAM, "pendek")).bidang], ["alasan"]);
      assert.deepEqual([(await tampilkan(db, AKUN.admin, "lainnya", KOMENTAR_SPAM)).bidang], ["jenis"]);
      assert.equal((await tampilkan(db, AKUN.admin, "komentar", TIDAK_ADA)).kode, "tidak_ditemukan");
      assert.equal((await tampilkan(db, AKUN.admin, "usulan", TIDAK_ADA)).kode, "tidak_ditemukan");
      assert.equal((await tampilkan(db, AKUN.admin, "usulan", LAMPU_GANG)).kode, "tidak_disembunyikan");
      const h = await tampilkan(db, AKUN.admin, "komentar", "6f1b3d0a-3001-4c8e-9a10-000000000001");
      assert.equal(h.kode, "tidak_disembunyikan");
    });
  });

  describe("akun warga", () => {
    let wargaBaru: string;
    let wargaKedua: string;

    before(async () => {
      wargaBaru = await idWarga(db, 20);
      wargaKedua = await idWarga(db, 21);
    });

    test("cari_warga_bebas: hanya warga tanpa akun, lewat nama atau nomor", async () => {
      const lewatNama = await panggil(db, "cari_warga_bebas($1, 'agus')", AKUN.admin);
      const daftar = lewatNama.warga as { id: string; nomor: number; nama: string; rt: number; rw: number }[];
      assert.equal(lewatNama.ok, true);
      assert.ok(daftar.length > 0 && daftar.every((w) => w.nama.toLowerCase().includes("agus")));
      assert.deepEqual(Object.keys(daftar[0]).sort(), ["id", "nama", "nomor", "rt", "rw"]);

      // Warga bernomor 69 sudah punya akun (uji-warga): tidak boleh muncul.
      const lewatNomor = await panggil(db, "cari_warga_bebas($1, '69')", AKUN.admin);
      assert.deepEqual(lewatNomor.warga, []);
      const bebas = await panggil(db, "cari_warga_bebas($1, '20')", AKUN.admin);
      assert.deepEqual((bebas.warga as { nomor: number }[]).map((w) => w.nomor), [20]);
    });

    test("cari_warga_bebas: kurang dari dua karakter kosong, batas hasil dipatuhi, karakter khusus aman", async () => {
      assert.deepEqual((await panggil(db, "cari_warga_bebas($1, 'a')", AKUN.admin)).warga, []);
      assert.deepEqual((await panggil(db, "cari_warga_bebas($1, '')", AKUN.admin)).warga, []);
      assert.deepEqual((await panggil(db, "cari_warga_bebas($1, '%%')", AKUN.admin)).warga, []);
      assert.equal(((await panggil(db, "cari_warga_bebas($1, 'wi', 3)", AKUN.admin)).warga as unknown[]).length, 3);
    });

    test("buat_akun_warga: akun tertaut, wajib ganti sandi, dibuat oleh admin, jejak tertutup tercatat", async () => {
      const logSebelum = await angka(db, "select count(*) as n from accountability_logs");
      const h = await buatAkun(db, AKUN.admin, "agus.santoso", HASH_BARU, wargaBaru);
      assert.deepEqual([h.ok, h.nama_pengguna], [true, "agus.santoso"]);

      const [a] = await baris<{ peran: string; warga_id: string; aktif: boolean; harus_ganti_sandi: boolean; dibuat_oleh: string; hash_kata_sandi: string; versi_sesi: number }>(
        db,
        "select peran, warga_id, aktif, harus_ganti_sandi, dibuat_oleh, hash_kata_sandi, versi_sesi from akun where nama_pengguna = 'agus.santoso'",
      );
      assert.deepEqual(a, { peran: "warga", warga_id: wargaBaru, aktif: true, harus_ganti_sandi: true, dibuat_oleh: AKUN.admin, hash_kata_sandi: HASH_BARU, versi_sesi: 1 });

      const [j] = await baris<{ akun_id: string; aksi: string; sasaran_akun_id: string; detail: Record<string, unknown> }>(
        db,
        "select akun_id, aksi, sasaran_akun_id, detail from jejak_admin where aksi = 'buat_akun'",
      );
      assert.equal(j.akun_id, AKUN.admin);
      assert.equal(j.sasaran_akun_id, h.akun_id);
      assert.deepEqual(j.detail, { nama_pengguna: "agus.santoso", warga_nomor: 20 });

      assert.equal(await angka(db, "select count(*) as n from accountability_logs"), logSebelum, "tidak ada log publik untuk akun");
    });

    test("akun yang baru dibuat bisa mendukung (tertaut ke warga)", async () => {
      const [a] = await baris<{ id: string }>(db, "select id from akun where nama_pengguna = 'agus.santoso'");
      const h = await panggil(db, "dukung_usulan($1, $2)", a.id, POSYANDU);
      assert.equal(h.ok, true);
      await panggil(db, "batal_dukung($1, $2)", a.id, POSYANDU);
    });

    test("satu warga satu akun: akun kedua untuk warga yang sama ditolak", async () => {
      assert.equal((await buatAkun(db, AKUN.admin, "agus.dua", HASH_BARU, wargaBaru)).kode, "warga_sudah_punya_akun");
      assert.equal(await angka(db, "select count(*) as n from akun where warga_id = $1", wargaBaru), 1);
    });

    test("nama pengguna yang sudah dipakai ditolak", async () => {
      assert.equal((await buatAkun(db, AKUN.admin, "agus.santoso", HASH_BARU, wargaKedua)).kode, "nama_dipakai");
      assert.equal((await buatAkun(db, AKUN.admin, "uji-admin", HASH_BARU, wargaKedua)).kode, "nama_dipakai");
    });

    test("masukan tidak sah ditolak per bidang; warga yang tidak ada ditolak", async () => {
      for (const nama of ["Agus", "ab", "agus santoso", "x".repeat(33), "agus@desa", ""]) {
        const h = await buatAkun(db, AKUN.admin, nama, HASH_BARU, wargaKedua);
        assert.deepEqual([h.kode, h.bidang], ["tidak_valid", "nama_pengguna"], nama);
      }
      for (const hash of ["kata sandi biasa", "", "$bcrypt$x"]) {
        const h = await buatAkun(db, AKUN.admin, "uji-hash", hash, wargaKedua);
        assert.deepEqual([h.kode, h.bidang], ["tidak_valid", "kata_sandi"], hash);
      }
      assert.equal((await buatAkun(db, AKUN.admin, "uji-hantu", HASH_BARU, TIDAK_ADA)).kode, "tidak_ditemukan");
    });

    test("akun yang dibuat dari sini selalu warga: tidak ada jalan membuat admin", async () => {
      assert.equal(await angka(db, "select count(*) as n from akun where dibuat_oleh is not null and peran <> 'warga'"), 0);
    });

    test("batas laju: 30 akun per jam per admin; yang lebih dari sejam tidak dihitung", async () => {
      await db.query("delete from jejak_admin where aksi = 'buat_akun'");
      await db.query(
        "insert into jejak_admin (akun_id, aksi, created_at) select $1, 'buat_akun', now() - interval '2 hours' from generate_series(1, 30)",
        [AKUN.admin],
      );
      assert.equal((await buatAkun(db, AKUN.admin, "uji-laju-1", HASH_BARU, wargaKedua)).ok, true, "30 entri lama tidak menghalangi");

      await db.query(
        "insert into jejak_admin (akun_id, aksi, created_at) select $1, 'buat_akun', now() - interval '10 minutes' from generate_series(1, 29)",
        [AKUN.admin],
      );
      const h = await buatAkun(db, AKUN.admin, "uji-laju-2", HASH_BARU, await idWarga(db, 22));
      assert.deepEqual([h.ok, h.kode], [false, "batas_laju"]);
      // Entri tertua dalam sejam terakhir berumur 10 menit, jadi slot kosong lagi sekitar 50 menit.
      assert.ok(Number(h.ulang_detik) >= 2990 && Number(h.ulang_detik) <= 3010, `ulang_detik ${h.ulang_detik}`);

      // Admin lain punya jatah sendiri.
      assert.equal((await buatAkun(db, AKUN.admin2, "uji-laju-3", HASH_BARU, await idWarga(db, 22))).ok, true);
      await db.query("delete from jejak_admin where aksi = 'buat_akun' and detail = '{}'::jsonb");
      await db.query("delete from jejak_admin where sasaran_akun_id in (select id from akun where nama_pengguna like 'uji-laju-%')");
      await db.query("delete from akun where nama_pengguna like 'uji-laju-%'");
    });

    test("atur_ulang_sandi: hash baru, wajib ganti sandi, sesi dicabut, jejak tercatat", async () => {
      const [sebelum] = await baris<{ id: string; versi_sesi: number }>(db, "select id, versi_sesi from akun where nama_pengguna = 'uji-warga-2'");
      await db.query("update akun set harus_ganti_sandi = false where id = $1", [sebelum.id]);
      const logSebelum = await angka(db, "select count(*) as n from accountability_logs");

      const h = await panggil(db, "atur_ulang_sandi($1, $2, $3)", AKUN.admin, sebelum.id, HASH_BARU);
      assert.deepEqual([h.ok, h.nama_pengguna], [true, "uji-warga-2"]);
      const [sesudah] = await baris<{ hash_kata_sandi: string; harus_ganti_sandi: boolean; versi_sesi: number }>(
        db,
        "select hash_kata_sandi, harus_ganti_sandi, versi_sesi from akun where id = $1",
        sebelum.id,
      );
      assert.deepEqual(sesudah, { hash_kata_sandi: HASH_BARU, harus_ganti_sandi: true, versi_sesi: sebelum.versi_sesi + 1 });
      const [j] = await baris<{ akun_id: string; aksi: string; sasaran_akun_id: string }>(db, "select akun_id, aksi, sasaran_akun_id from jejak_admin where aksi = 'atur_ulang_sandi'");
      assert.deepEqual(j, { akun_id: AKUN.admin, aksi: "atur_ulang_sandi", sasaran_akun_id: sebelum.id });
      assert.equal(await angka(db, "select count(*) as n from accountability_logs"), logSebelum);
    });

    test("atur_ulang_sandi: diri sendiri, akun yang tidak ada, dan hash rusak ditolak", async () => {
      assert.equal((await panggil(db, "atur_ulang_sandi($1, $1, $2)", AKUN.admin, HASH_BARU)).kode, "diri_sendiri");
      assert.equal((await panggil(db, "atur_ulang_sandi($1, $2, $3)", AKUN.admin, TIDAK_ADA, HASH_BARU)).kode, "tidak_ditemukan");
      const h = await panggil(db, "atur_ulang_sandi($1, $2, $3)", AKUN.admin, AKUN.wargaKedua, "bukan hash");
      assert.deepEqual([h.kode, h.bidang], ["tidak_valid", "kata_sandi"]);
    });

    test("atur_aktif: menonaktifkan mencabut sesi; mengaktifkan kembali tidak; keduanya tercatat", async () => {
      const [a] = await baris<{ versi_sesi: number }>(db, "select versi_sesi from akun where id = $1", AKUN.wargaKedua);
      const mati = await panggil(db, "atur_aktif($1, $2, false)", AKUN.admin, AKUN.wargaKedua);
      assert.deepEqual([mati.ok, mati.aktif], [true, false]);
      assert.deepEqual(
        await baris(db, "select aktif, versi_sesi from akun where id = $1", AKUN.wargaKedua),
        [{ aktif: false, versi_sesi: a.versi_sesi + 1 }],
      );

      assert.equal((await panggil(db, "atur_aktif($1, $2, false)", AKUN.admin, AKUN.wargaKedua)).kode, "tidak_berubah");

      const hidup = await panggil(db, "atur_aktif($1, $2, true)", AKUN.admin, AKUN.wargaKedua);
      assert.deepEqual([hidup.ok, hidup.aktif], [true, true]);
      assert.deepEqual(
        await baris(db, "select aktif, versi_sesi from akun where id = $1", AKUN.wargaKedua),
        [{ aktif: true, versi_sesi: a.versi_sesi + 1 }],
        "versi sesi tidak naik lagi saat diaktifkan",
      );
      const jejak = await baris<{ aksi: string }>(db, "select aksi from jejak_admin where sasaran_akun_id = $1 order by id", AKUN.wargaKedua);
      assert.deepEqual(jejak.map((x) => x.aksi), ["atur_ulang_sandi", "nonaktifkan", "aktifkan"]);
    });

    test("atur_aktif: admin tidak bisa menonaktifkan dirinya sendiri", async () => {
      assert.equal((await panggil(db, "atur_aktif($1, $1, false)", AKUN.admin)).kode, "diri_sendiri");
      assert.equal(await angka(db, "select count(*) as n from akun where id = $1 and aktif", AKUN.admin), 1);
    });

    test("atur_aktif: admin bisa menonaktifkan admin lain, dan admin yang sudah nonaktif tidak bisa berbuat apa pun", async () => {
      assert.equal((await panggil(db, "atur_aktif($1, $2, false)", AKUN.admin, AKUN.admin2)).ok, true);
      assert.equal((await panggil(db, "atur_aktif($1, $2, false)", AKUN.admin2, AKUN.admin)).kode, "akun_tidak_aktif");
      assert.equal((await ubahPagu(db, AKUN.admin2, 350_000_000, 3)).kode, "akun_tidak_aktif");
      // Admin aktif terakhir (satu-satunya) tetap tidak bisa menonaktifkan diri.
      assert.equal(await angka(db, "select count(*) as n from akun where peran = 'admin' and aktif"), 1);
      assert.equal((await panggil(db, "atur_aktif($1, $1, false)", AKUN.admin)).kode, "diri_sendiri");
      await panggil(db, "atur_aktif($1, $2, true)", AKUN.admin, AKUN.admin2);
    });

    test("atur_aktif: akun yang tidak ada ditolak; nilai kosong ditolak", async () => {
      assert.equal((await panggil(db, "atur_aktif($1, $2, false)", AKUN.admin, TIDAK_ADA)).kode, "tidak_ditemukan");
      assert.deepEqual([(await panggil(db, "atur_aktif($1, $2, null)", AKUN.admin, AKUN.warga)).bidang], ["aktif"]);
    });

    test("ganti_sandi_sendiri: hash baru, tidak wajib ganti lagi, sesi lama dicabut, versi baru dikembalikan", async () => {
      const [a] = await baris<{ id: string; versi_sesi: number }>(db, "select id, versi_sesi from akun where nama_pengguna = 'agus.santoso'");
      const h = await panggil(db, "ganti_sandi_sendiri($1, $2)", a.id, HASH);
      assert.deepEqual([h.ok, h.versi_sesi], [true, a.versi_sesi + 1]);
      assert.deepEqual(
        await baris(db, "select hash_kata_sandi, harus_ganti_sandi, versi_sesi from akun where id = $1", a.id),
        [{ hash_kata_sandi: HASH, harus_ganti_sandi: false, versi_sesi: a.versi_sesi + 1 }],
      );
      const [j] = await baris<{ akun_id: string; aksi: string; sasaran_akun_id: string }>(
        db,
        "select akun_id, aksi, sasaran_akun_id from jejak_admin where aksi = 'ganti_sandi'",
      );
      assert.deepEqual(j, { akun_id: a.id, aksi: "ganti_sandi", sasaran_akun_id: a.id });
    });

    test("ganti_sandi_sendiri berlaku untuk admin juga, dan menolak hash rusak", async () => {
      assert.equal((await panggil(db, "ganti_sandi_sendiri($1, $2)", AKUN.admin, HASH)).ok, true);
      const h = await panggil(db, "ganti_sandi_sendiri($1, $2)", AKUN.admin, "bukan hash");
      assert.deepEqual([h.kode, h.bidang], ["tidak_valid", "kata_sandi"]);
    });

    test("jejak admin tidak pernah memuat kata sandi atau hash", async () => {
      assert.equal(await angka(db, "select count(*) as n from jejak_admin where detail::text like '%scrypt%' or detail::text like '%sandi%'"), 0);
      assert.equal(await angka(db, "select count(*) as n from accountability_logs where message like '%scrypt%' or detail::text like '%scrypt%'"), 0);
    });
  });

  describe("view admin", () => {
    test("v_admin_usulan memuat semua usulan termasuk yang tersembunyi, dengan judul asli", async () => {
      await sembunyikan(db, AKUN.admin, "usulan", ATAP, "Berisi tuduhan terhadap warga tertentu.");
      assert.equal(await angka(db, "select count(*) as n from v_admin_usulan"), await angka(db, "select count(*) as n from proposals"));
      const [a] = await baris<{ title: string; description: string; alasan_disembunyikan: string; pengusul_nama_depan: string }>(
        db,
        "select title, description, alasan_disembunyikan, pengusul_nama_depan from v_admin_usulan where id = $1",
        ATAP,
      );
      assert.equal(a.title, "Atap pos ronda RW 01 bocor saat hujan");
      assert.ok(a.description.length > 20);
      assert.match(a.alasan_disembunyikan, /tuduhan/);
      assert.match(a.pengusul_nama_depan, /^\S+$/);
      // Versi publik tetap mengosongkan judulnya.
      assert.equal((await baris<{ title: string | null }>(db, "select title from v_usulan where id = $1", ATAP))[0].title, null);
      await tampilkan(db, AKUN.admin, "usulan", ATAP);
    });

    test("v_admin_usulan: jumlah dukungan, komentar (tanpa yang tersembunyi), dan dukungan per 1.000", async () => {
      const [t] = await baris<{ vote_count: number; jumlah_komentar: number }>(db, "select vote_count, jumlah_komentar from v_admin_usulan where id = $1", TONG_SAMPAH);
      assert.equal(t.vote_count, await angka(db, "select count(*) as n from votes where proposal_id = $1", TONG_SAMPAH));
      assert.equal(t.jumlah_komentar, 2, "tiga komentar, satu tersembunyi");
      const [lampu] = await baris<{ suara_per_1000: string }>(db, "select suara_per_1000::text from v_admin_usulan where title like 'Talud%'");
      assert.equal(lampu.suara_per_1000, "20.00");
    });

    test("v_admin_akun: nama lengkap dan nomor warga, pembuat akun, dan tanpa hash kata sandi", async () => {
      const kolom = await baris<{ column_name: string }>(db, "select column_name from information_schema.columns where table_name = 'v_admin_akun'");
      assert.ok(!kolom.some((k) => k.column_name.includes("hash") || k.column_name === "versi_sesi"));
      const [a] = await baris<{ warga_nama: string; warga_nomor: number; warga_rt: number; warga_rw: number; dibuat_oleh_nama: string; harus_ganti_sandi: boolean }>(
        db,
        "select warga_nama, warga_nomor, warga_rt, warga_rw, dibuat_oleh_nama, harus_ganti_sandi from v_admin_akun where nama_pengguna = 'agus.santoso'",
      );
      assert.equal(a.warga_nomor, 20);
      assert.match(a.warga_nama, /^\S+ \S+$/);
      assert.equal(a.dibuat_oleh_nama, "uji-admin");
      assert.equal(a.harus_ganti_sandi, false, "sudah mengganti kata sandi di tes sebelumnya");
      const [admin] = await baris<{ warga_nama: string | null }>(db, "select warga_nama from v_admin_akun where nama_pengguna = 'uji-admin'");
      assert.equal(admin.warga_nama, null);
    });

    test("v_admin_komentar: isi komentar tersembunyi terbaca admin; penulis hanya nama depan dan RW", async () => {
      const [k] = await baris<{ isi: string; alasan_disembunyikan: string; penulis_nama_depan: string | null; penulis_rw: number | null; proposal_judul: string }>(
        db,
        "select isi, alasan_disembunyikan, penulis_nama_depan, penulis_rw, proposal_judul from v_admin_komentar where id = $1",
        KOMENTAR_SPAM,
      );
      assert.match(k.isi, /contoh\.invalid/);
      assert.match(k.alasan_disembunyikan, /tautan promosi/);
      assert.equal(k.proposal_judul, "Tong sampah terpilah di pasar RW 03");
      const kolom = await baris<{ column_name: string }>(db, "select column_name from information_schema.columns where table_name = 'v_admin_komentar'");
      assert.ok(!kolom.some((c) => ["akun_id", "nomor", "warga_id", "nama"].includes(c.column_name)));
    });

    test("v_jejak_admin menyebut pelaku dan sasaran dengan nama pengguna", async () => {
      const r = await baris<{ aksi: string; pelaku_nama: string; sasaran_nama: string | null }>(
        db,
        "select aksi, pelaku_nama, sasaran_nama from v_jejak_admin where aksi = 'nonaktifkan' order by id limit 1",
      );
      assert.deepEqual(r, [{ aksi: "nonaktifkan", pelaku_nama: "uji-admin", sasaran_nama: "uji-warga-2" }]);
    });

    test("view publik tidak ikut berubah: tidak ada kolom akun atau warga yang bocor", async () => {
      const r = await baris<{ column_name: string }>(
        db,
        `select column_name from information_schema.columns
          where table_name in ('v_forum', 'v_usulan', 'v_komentar')
            and column_name in ('nomor', 'warga_id', 'akun_id', 'proposer_id', 'nama', 'hash_kata_sandi', 'nama_pengguna')`,
      );
      assert.deepEqual(r, []);
    });
  });
});

describe("migrasi 0005 berhenti bila data melanggar aturan satu warga satu akun", () => {
  test("pesan jelas, dan tidak ada yang tersisa karena satu transaksi", async () => {
    const db = await buatDatabase();
    try {
      await muat(db, ...SEBELUM_FORUM, "m0004");
      await db.exec(`
        insert into akun (nama_pengguna, hash_kata_sandi, peran, warga_id) values
          ('ganda-1', '${HASH}', 'warga', (select id from warga where nomor = 7)),
          ('ganda-2', '${HASH}', 'warga', (select id from warga where nomor = 7));
      `);
      await assert.rejects(muat(db, "m0005"), /lebih dari satu akun/);
      // SQL Editor Supabase membatalkan skrip yang gagal; PGlite menunggu rollback eksplisit.
      await db.exec("rollback");
      const { rows } = await db.query<{ ada: boolean }>("select to_regclass('pengaturan_anggaran') is not null as ada");
      assert.equal(rows[0].ada, false, "tabel pengaturan_anggaran tidak boleh tersisa");
      const { rows: log } = await db.query<{ n: number }>(
        "select count(*)::int as n from pg_constraint where conname = 'accountability_logs_log_type_check' and pg_get_constraintdef(oid) like '%budget_change%'",
      );
      assert.equal(log[0].n, 0, "perubahan batasan log juga dibatalkan");
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Satu sumber kebenaran: pratinjau TypeScript sama dengan rekomendasi_resmi sesudah disimpan.
// ---------------------------------------------------------------------------

describe("pratinjau sama dengan rekomendasi_resmi setelah perubahan disimpan", () => {
  let db: PGlite;

  before(async () => {
    db = await siapkan();
  });
  after(async () => {
    await db.close();
  });

  /** Data yang dibaca halaman admin, dibaca langsung dari database seperti lib/admin-data.ts. */
  async function bacaDasar(): Promise<DasarHitung> {
    const usulan = await baris<{
      id: string; title: string; nama_singkat: string; category: string; rw: number;
      estimated_budget: string; urgency_score: number; created_at: Date; vote_count: number;
    }>(
      db,
      `select id, title, coalesce(nama_singkat, title) as nama_singkat, category, rw, estimated_budget::text,
              urgency_score, created_at, vote_count
         from v_admin_usulan
        where status = 'voting' and disembunyikan_pada is null and rw is not null
        order by created_at, id`,
    );
    const wilayah = await baris<{ rw: number; nama: string; penduduk: number; anggaran_lalu: string }>(db, "select rw, nama, penduduk, anggaran_lalu::text from wilayah order by rw");
    const [w] = await baris<{ w_popularitas: string; w_urgensi: string; w_pemerataan: string }>(db, "select w_popularitas::text, w_urgensi::text, w_pemerataan::text from scoring_weights");
    const [s] = await baris<{ pagu: string }>(db, "select pagu::text from pengaturan_anggaran");
    return {
      usulan: usulan.map((u) => ({
        id: u.id, title: u.title, namaSingkat: u.nama_singkat, category: u.category, rw: u.rw,
        estimatedBudget: Number(u.estimated_budget), voteCount: u.vote_count, urgencyScore: u.urgency_score,
        dibuat: u.created_at.toISOString(),
      })),
      wilayah: wilayah.map((r) => ({ rw: r.rw, nama: r.nama, penduduk: r.penduduk, anggaranLalu: Number(r.anggaran_lalu) })),
      pagu: Number(s.pagu),
      bobot: { popularitas: Number(w.w_popularitas), urgensi: Number(w.w_urgensi), pemerataan: Number(w.w_pemerataan) },
    };
  }

  async function resmi(pagu: number) {
    const rows = await baris<{ peringkat: number; id: string; selected: boolean; skor: string; total_berjalan: string }>(
      db,
      "select peringkat, id, selected, skor::text, total_berjalan::text from rekomendasi_resmi($1) order by peringkat",
      String(pagu),
    );
    return rows.map((r) => ({ peringkat: r.peringkat, id: r.id, selected: r.selected, skor: Number(r.skor), totalBerjalan: Number(r.total_berjalan) }));
  }

  /** Pratinjau dihitung SEBELUM disimpan; `simpan` menjalankan fungsi SQL; lalu keduanya dibandingkan. */
  async function buktikan(nama: string, perubahan: (d: DasarHitung) => Perubahan, simpan: (d: DasarHitung) => Promise<void>) {
    const sebelum = await bacaDasar();
    const rencana = perubahan(sebelum);
    const pratinjau = hitungPratinjau(sebelum, rencana);

    await simpan(sebelum);

    const sesudah = await bacaDasar();
    const sungguhan = await resmi(sesudah.pagu);
    const ts = hitungRekomendasi(sesudah);

    assert.equal(pratinjau.paguSesudah, sesudah.pagu, `${nama}: pagu`);
    assert.equal(sungguhan.length, ts.length, `${nama}: jumlah usulan`);
    for (const [i, baris] of sungguhan.entries()) {
      assert.equal(ts[i].id, baris.id, `${nama}: urutan peringkat ${i + 1}`);
      assert.equal(ts[i].peringkat, baris.peringkat, `${nama}: peringkat`);
      assert.equal(ts[i].selected, baris.selected, `${nama}: terpilih ${baris.id}`);
      assert.ok(Math.abs(ts[i].skor - baris.skor) <= 0.00011, `${nama}: skor ${ts[i].skor} vs ${baris.skor}`);
      assert.equal(ts[i].totalBerjalan, baris.totalBerjalan, `${nama}: total berjalan`);
    }
    // Yang tampil di batang "Sesudah disimpan" persis yang terbiayai di halaman utama setelah disimpan.
    assert.deepEqual(
      pratinjau.sesudah.terpilih.map((t) => t.id).sort(),
      sungguhan.filter((r) => r.selected).map((r) => r.id).sort(),
      `${nama}: batang sesudah`,
    );
    const biaya = new Map(sesudah.usulan.map((u) => [u.id, u.estimatedBudget]));
    const terbiayai = sungguhan.filter((r) => r.selected).reduce((n, r) => n + (biaya.get(r.id) ?? 0), 0);
    assert.equal(pratinjau.sesudah.tata.sisa.rupiah, sesudah.pagu - terbiayai, `${nama}: sisa pagu`);
  }

  test("kondisi awal: 'sekarang' pada pratinjau sama dengan rekomendasi_resmi", async () => {
    const dasar = await bacaDasar();
    const p = hitungPratinjau(dasar, { jenis: "pagu", pagu: dasar.pagu });
    const sungguhan = await resmi(dasar.pagu);
    assert.deepEqual(p.sekarang.terpilih.map((t) => t.id).sort(), sungguhan.filter((r) => r.selected).map((r) => r.id).sort());
    assert.equal(p.banding.berubah.length, 0);
  });

  test("kombinasi 1: bobot 20/60/20", async () => {
    await buktikan(
      "bobot 20/60/20",
      () => ({ jenis: "bobot", bobot: { popularitas: 20, urgensi: 60, pemerataan: 20 } }),
      async () => assert.equal((await ubahBobot(db, AKUN.admin, 20, 60, 20, 1)).ok, true),
    );
  });

  test("kombinasi 2: pagu Rp 400 juta", async () => {
    await buktikan(
      "pagu 400 juta",
      () => ({ jenis: "pagu", pagu: 400_000_000 }),
      async () => assert.equal((await ubahPagu(db, AKUN.admin, 400_000_000, 1)).ok, true),
    );
  });

  test("kombinasi 3: bobot 70/10/20 dengan pagu Rp 250 juta", async () => {
    await buktikan(
      "bobot 70/10/20",
      () => ({ jenis: "bobot", bobot: { popularitas: 70, urgensi: 10, pemerataan: 20 } }),
      async () => assert.equal((await ubahBobot(db, AKUN.admin, 70, 10, 20, 2)).ok, true),
    );
    await buktikan(
      "pagu 250 juta",
      () => ({ jenis: "pagu", pagu: 250_000_000 }),
      async () => assert.equal((await ubahPagu(db, AKUN.admin, 250_000_000, 2)).ok, true),
    );
  });

  test("kombinasi 4: memasukkan usulan forum ke hitungan dengan urgensi 8, lalu mengembalikannya", async () => {
    // Usulan forum dibaca dari database seperti yang dilakukan halaman admin: dukungan dan waktu
    // dibuatnya ikut, supaya urutan seri sama dengan pilih_optimal.
    const [u] = await baris<{ title: string; nama_singkat: string; category: string; rw: number; estimated_budget: string; vote_count: number; created_at: Date }>(
      db,
      "select title, nama_singkat, category, rw, estimated_budget::text, vote_count, created_at from v_admin_usulan where id = $1",
      LAMPU_GANG,
    );
    const lampu: UsulanHitung = {
      id: LAMPU_GANG,
      title: u.title,
      namaSingkat: u.nama_singkat,
      category: u.category,
      rw: u.rw,
      estimatedBudget: Number(u.estimated_budget),
      voteCount: u.vote_count,
      urgencyScore: 8,
      dibuat: u.created_at.toISOString(),
    };
    await buktikan(
      "masuk",
      () => ({ jenis: "masuk", usulan: lampu }),
      async () => assert.equal((await masukkan(db, LAMPU_GANG, 8)).ok, true),
    );
    await buktikan(
      "keluar",
      () => ({ jenis: "keluar", id: LAMPU_GANG }),
      async () => assert.equal((await kembalikan(db, LAMPU_GANG)).ok, true),
    );
  });
});
