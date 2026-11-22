import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fallback from "./fallback-data.json" with { type: "json" };
import { susunRingkasan, teksMenunggu, type MasukanRingkasan } from "./admin-ringkasan.ts";
import { pilihOptimal } from "./seleksi.ts";

const SEKARANG = new Date("2026-11-22T10:00:00.000Z");
const hariLalu = (n: number) => new Date(SEKARANG.getTime() - n * 86_400_000).toISOString();

const hasil = pilihOptimal(
  fallback.usulan_voting.map((u) => ({
    id: u.id,
    title: u.title,
    namaSingkat: u.nama_singkat,
    category: u.category,
    rw: u.rw,
    estimatedBudget: u.estimated_budget,
    voteCount: u.vote_count,
    urgencyScore: u.urgency_score,
  })),
  fallback.wilayah.map((w) => ({ rw: w.rw, nama: w.nama, penduduk: w.penduduk, anggaranLalu: w.anggaran_lalu })),
  300_000_000,
  fallback.bobot_resmi,
);

const dasar: MasukanRingkasan = {
  usulan: [
    { id: "f1", title: "Lampu gang", status: "forum", rw: 7, created_at: hariLalu(2), disembunyikan_pada: null },
    { id: "f2", title: "Atap pos ronda", status: "forum", rw: 1, created_at: hariLalu(12), disembunyikan_pada: null },
    { id: "f3", title: "Timbangan posyandu", status: "forum", rw: 3, created_at: hariLalu(5), disembunyikan_pada: null },
    { id: "f4", title: "Tong sampah", status: "forum", rw: 3, created_at: hariLalu(9), disembunyikan_pada: null },
    { id: "f5", title: null, status: "forum", rw: 1, created_at: hariLalu(30), disembunyikan_pada: hariLalu(1) },
    ...fallback.usulan_voting.map((u) => ({ id: u.id, title: u.title, status: "voting", rw: u.rw, created_at: hariLalu(14), disembunyikan_pada: null })),
  ],
  akun: [
    { nama_pengguna: "admin", peran: "admin", aktif: true, harus_ganti_sandi: false },
    { nama_pengguna: "agus.santoso", peran: "warga", aktif: true, harus_ganti_sandi: true },
    { nama_pengguna: "budi.wijaya", peran: "warga", aktif: true, harus_ganti_sandi: true },
    { nama_pengguna: "lama", peran: "warga", aktif: false, harus_ganti_sandi: true },
    { nama_pengguna: "warga", peran: "warga", aktif: true, harus_ganti_sandi: false },
  ],
  komentar: [
    { created_at: new Date(SEKARANG.getTime() - 3 * 3_600_000).toISOString(), disembunyikan_pada: null },
    { created_at: new Date(SEKARANG.getTime() - 23 * 3_600_000).toISOString(), disembunyikan_pada: null },
    { created_at: new Date(SEKARANG.getTime() - 25 * 3_600_000).toISOString(), disembunyikan_pada: null },
    { created_at: new Date(SEKARANG.getTime() - 2 * 3_600_000).toISOString(), disembunyikan_pada: hariLalu(0) },
    { created_at: hariLalu(5), disembunyikan_pada: hariLalu(3) },
  ],
  hasil,
  pagu: 300_000_000,
  sekarang: SEKARANG,
};

describe("susunRingkasan", () => {
  const r = susunRingkasan(dasar);

  it("usulan menunggu: jumlah (tanpa yang tersembunyi) dan tiga yang paling lama", () => {
    assert.equal(r.menunggu.jumlah, 4);
    assert.deepEqual(r.menunggu.tertua.map((t) => [t.id, t.umurHari]), [["f2", 12], ["f4", 9], ["f3", 5]]);
    assert.equal(r.menunggu.tertua[0].judul, "Atap pos ronda");
  });

  it("hitungan anggaran: 7 dari maksimal 16", () => {
    assert.deepEqual(r.hitungan, { jumlah: 7, batas: 16, penuh: false });
  });

  it("status pagu: 4 terbiayai, 1 ditunda, 2 tidak terpilih, sisa Rp 15 juta (data demo)", () => {
    assert.deepEqual(r.anggaran, { pagu: 300_000_000, terbiayai: 4, ditunda: 1, tidakTerpilih: 2, sisa: 15_000_000 });
  });

  it("akun belum ganti kata sandi: hanya warga aktif", () => {
    assert.equal(r.belumGantiSandi.jumlah, 2);
    assert.deepEqual(r.belumGantiSandi.nama, ["agus.santoso", "budi.wijaya"]);
  });

  it("komentar 24 jam terakhir tidak menghitung yang tersembunyi", () => {
    assert.equal(r.komentar24Jam, 2);
  });

  it("konten tersembunyi: usulan dan komentar dihitung terpisah", () => {
    assert.deepEqual(r.tersembunyi, { usulan: 1, komentar: 2 });
  });

  it("ada pekerjaan bila ada yang menunggu atau akun yang belum ganti kata sandi", () => {
    assert.equal(r.adaPekerjaan, true);
  });
});

describe("susunRingkasan tanpa pekerjaan", () => {
  it("tidak ada yang menunggu dan semua akun sudah ganti kata sandi: tidak ada pekerjaan, tanpa mengarang angka", () => {
    const r = susunRingkasan({
      ...dasar,
      usulan: dasar.usulan.filter((u) => u.status !== "forum"),
      akun: dasar.akun.map((a) => ({ ...a, harus_ganti_sandi: false })),
    });
    assert.equal(r.adaPekerjaan, false);
    assert.equal(r.menunggu.jumlah, 0);
    assert.deepEqual(r.menunggu.tertua, []);
    assert.equal(r.belumGantiSandi.jumlah, 0);
  });

  it("rekomendasi yang tidak bisa dihitung: anggaran null, bukan angka palsu", () => {
    assert.equal(susunRingkasan({ ...dasar, hasil: null }).anggaran, null);
  });

  it("tepat 16 usulan voting: hitungan penuh", () => {
    const enambelas = Array.from({ length: 16 }, (_, i) => ({ id: `v${i}`, title: `V${i}`, status: "voting", rw: 1, created_at: hariLalu(1), disembunyikan_pada: null }));
    assert.equal(susunRingkasan({ ...dasar, usulan: enambelas, hasil: null }).hitungan.penuh, true);
  });

  it("usulan voting yang tersembunyi tidak dihitung terhadap batas", () => {
    const u = [{ id: "v", title: null, status: "voting", rw: 1, created_at: hariLalu(1), disembunyikan_pada: hariLalu(0) }];
    assert.equal(susunRingkasan({ ...dasar, usulan: u, hasil: null }).hitungan.jumlah, 0);
  });
});

describe("teksMenunggu", () => {
  it("umur dalam hari penuh", () => {
    assert.equal(teksMenunggu(12), "menunggu 12 hari");
    assert.equal(teksMenunggu(1), "menunggu 1 hari");
    assert.equal(teksMenunggu(0), "menunggu sejak hari ini");
  });
});
