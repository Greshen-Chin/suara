import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FILTER_AKUN_AWAL,
  FILTER_USULAN_AWAL,
  PER_HALAMAN,
  adaFilterAkunAktif,
  adaFilterUsulanAktif,
  bacaFilterAkun,
  bacaFilterUsulan,
  bangunQueryAkun,
  bangunQueryUsulan,
  potongHalaman,
  terapkanFilterAkun,
  terapkanFilterUsulan,
  type BisaDisaringAkun,
  type BisaDisaringUsulan,
} from "./admin-filter.ts";

const usulan = (id: string, o: Partial<BisaDisaringUsulan> = {}): BisaDisaringUsulan => ({
  id,
  title: `Usulan ${id}`,
  status: "forum",
  rw: 1,
  category: "infrastruktur",
  created_at: "2026-11-10T00:00:00.000Z",
  vote_count: 1,
  disembunyikan_pada: null,
  ...o,
});

const DAFTAR: BisaDisaringUsulan[] = [
  usulan("a", { status: "forum", created_at: "2026-11-12T00:00:00.000Z", title: "Lampu jalan gang" }),
  usulan("b", { status: "forum", created_at: "2026-11-01T00:00:00.000Z", title: "Atap pos ronda", rw: 3 }),
  usulan("c", { status: "voting", created_at: "2026-11-05T00:00:00.000Z", vote_count: 60, category: "fasilitas" }),
  usulan("d", { status: "voting", created_at: "2026-11-08T00:00:00.000Z", vote_count: 8 }),
  usulan("e", { status: "rejected", created_at: "2026-11-03T00:00:00.000Z" }),
  usulan("f", { status: "forum", created_at: "2026-10-20T00:00:00.000Z", disembunyikan_pada: "2026-11-02T00:00:00.000Z", title: null }),
  usulan("g", { status: "approved", created_at: "2026-10-01T00:00:00.000Z" }),
];

const idDari = (h: { tampil: { id: string }[] }) => h.tampil.map((u) => u.id);

describe("bacaFilterUsulan dan bangunQueryUsulan", () => {
  it("nilai yang tidak dikenal jatuh ke bawaan", () => {
    assert.deepEqual(
      bacaFilterUsulan({ status: "ngawur", urut: "x", rw: "abc", kategori: "tidak-ada", halaman: "-4", q: "  " }),
      FILTER_USULAN_AWAL,
    );
  });

  it("membaca semua parameter yang sah, dan parameter berulang diambil yang pertama", () => {
    assert.deepEqual(
      bacaFilterUsulan({ status: ["menunggu", "voting"], rw: "7", kategori: "sosial", q: "  lampu   gang ", urut: "dukungan", halaman: "3" }),
      { status: "menunggu", rw: 7, kategori: "sosial", q: "lampu gang", urut: "dukungan", halaman: 3 },
    );
  });

  it("query tanpa nilai bawaan; kosong bila semuanya bawaan", () => {
    assert.equal(bangunQueryUsulan(FILTER_USULAN_AWAL), "");
    assert.equal(bangunQueryUsulan({ ...FILTER_USULAN_AWAL, status: "menunggu", halaman: 2 }), "?status=menunggu&halaman=2");
    assert.equal(bangunQueryUsulan({ ...FILTER_USULAN_AWAL, q: "lampu gang" }), "?q=lampu+gang");
  });

  it("bolak-balik: query yang dibangun dibaca kembali menjadi filter yang sama", () => {
    const f = { status: "voting" as const, rw: 3, kategori: "kesehatan" as const, q: "posyandu", urut: "terbaru" as const, halaman: 2 };
    const params = Object.fromEntries(new URLSearchParams(bangunQueryUsulan(f)));
    assert.deepEqual(bacaFilterUsulan(params), f);
  });

  it("ubah menimpa sebagian dan tidak mengubah filter asalnya", () => {
    const f = { ...FILTER_USULAN_AWAL, status: "voting" as const, halaman: 4 };
    assert.equal(bangunQueryUsulan(f, { halaman: 1 }), "?status=voting");
    assert.equal(f.halaman, 4);
  });

  it("adaFilterUsulanAktif tidak menghitung urutan atau halaman", () => {
    assert.equal(adaFilterUsulanAktif({ ...FILTER_USULAN_AWAL, urut: "terbaru", halaman: 3 }), false);
    assert.equal(adaFilterUsulanAktif({ ...FILTER_USULAN_AWAL, q: "x" }), true);
    assert.equal(adaFilterUsulanAktif({ ...FILTER_USULAN_AWAL, status: "menunggu" }), true);
  });
});

describe("terapkanFilterUsulan", () => {
  it("semua: semua usulan, termasuk yang tersembunyi", () => {
    assert.equal(terapkanFilterUsulan(DAFTAR, FILTER_USULAN_AWAL).total, 7);
  });

  it("menunggu = status forum yang tidak tersembunyi", () => {
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, status: "menunggu" })), ["b", "a"]);
  });

  it("masuk hitungan anggaran, tidak dilanjutkan, dan disembunyikan", () => {
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, status: "voting" })).sort(), ["c", "d"]);
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, status: "tidak-dilanjutkan" })), ["e"]);
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, status: "disembunyikan" })), ["f"]);
  });

  it("RW, kategori, dan pencarian judul (tanpa membedakan huruf besar kecil) bisa digabung", () => {
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, rw: 3 })), ["b"]);
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, kategori: "fasilitas" })), ["c"]);
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, q: "LAMPU" })), ["a"]);
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, q: "usulan", status: "voting", rw: 1 })).sort(), ["c", "d"]);
  });

  it("judul yang dikosongkan (tersembunyi) tidak membuat pencarian galat", () => {
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, q: "tidak ada" })), []);
  });

  it("urutan bawaan (antrean): yang menunggu paling lama di atas, lalu masuk hitungan, lalu yang diputuskan, tersembunyi terakhir", () => {
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, FILTER_USULAN_AWAL)), ["b", "a", "d", "c", "e", "g", "f"]);
  });

  it("terbaru dan dukungan terbanyak", () => {
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, urut: "terbaru" }))[0], "a");
    assert.deepEqual(idDari(terapkanFilterUsulan(DAFTAR, { ...FILTER_USULAN_AWAL, urut: "dukungan" }))[0], "c");
  });

  it("tidak mengubah daftar masukan", () => {
    const salinan = JSON.stringify(DAFTAR);
    terapkanFilterUsulan(DAFTAR, FILTER_USULAN_AWAL);
    assert.equal(JSON.stringify(DAFTAR), salinan);
  });
});

const akun = (n: number, o: Partial<BisaDisaringAkun> = {}): BisaDisaringAkun => ({
  id: `id-${String(n).padStart(3, "0")}`,
  nama_pengguna: `akun${n}`,
  peran: "warga",
  aktif: true,
  harus_ganti_sandi: false,
  created_at: `2026-11-${String(n).padStart(2, "0")}T00:00:00.000Z`,
  warga_nama: `Warga ${n}`,
  warga_nomor: n,
  ...o,
});

describe("akun: filter dan query", () => {
  const SEMUA = [
    akun(1, { nama_pengguna: "admin", peran: "admin", warga_nama: null, warga_nomor: null }),
    akun(2, { nama_pengguna: "agus.santoso", warga_nama: "Agus Santoso", warga_nomor: 12, harus_ganti_sandi: true }),
    akun(3, { nama_pengguna: "seed-w01", aktif: false, warga_nama: "Eka Wijaya", warga_nomor: 5 }),
    akun(4, { nama_pengguna: "budi", warga_nama: "Budi Kusuma", warga_nomor: 120, harus_ganti_sandi: true }),
  ];

  it("membaca parameter; nilai asing jatuh ke bawaan", () => {
    assert.deepEqual(bacaFilterAkun({ peran: "x", status: "y", halaman: "0" }), FILTER_AKUN_AWAL);
    assert.deepEqual(bacaFilterAkun({ q: " agus ", peran: "warga", status: "aktif", sandi: "belum", halaman: "2" }), {
      q: "agus", peran: "warga", status: "aktif", belumGanti: true, halaman: 2,
    });
  });

  it("bolak-balik lewat query", () => {
    const f = { q: "agus", peran: "warga" as const, status: "nonaktif" as const, belumGanti: true, halaman: 3 };
    assert.deepEqual(bacaFilterAkun(Object.fromEntries(new URLSearchParams(bangunQueryAkun(f)))), f);
    assert.equal(bangunQueryAkun(FILTER_AKUN_AWAL), "");
  });

  it("pencarian: nama pengguna, nama warga, dan nomor warga (nomor harus persis)", () => {
    const cari = (q: string) => idDari(terapkanFilterAkun(SEMUA, { ...FILTER_AKUN_AWAL, q }));
    assert.deepEqual(cari("agus"), ["id-002"]);
    assert.deepEqual(cari("WIJAYA"), ["id-003"]);
    assert.deepEqual(cari("12"), ["id-002"], "nomor 12 cocok persis; 120 tidak ikut");
    assert.deepEqual(cari("seed"), ["id-003"]);
  });

  it("peran, aktif atau nonaktif, dan belum mengganti kata sandi", () => {
    assert.deepEqual(idDari(terapkanFilterAkun(SEMUA, { ...FILTER_AKUN_AWAL, peran: "admin" })), ["id-001"]);
    assert.deepEqual(idDari(terapkanFilterAkun(SEMUA, { ...FILTER_AKUN_AWAL, status: "nonaktif" })), ["id-003"]);
    assert.deepEqual(idDari(terapkanFilterAkun(SEMUA, { ...FILTER_AKUN_AWAL, belumGanti: true })), ["id-004", "id-002"]);
  });

  it("yang terbaru dibuat di atas", () => {
    assert.deepEqual(idDari(terapkanFilterAkun(SEMUA, FILTER_AKUN_AWAL)), ["id-004", "id-003", "id-002", "id-001"]);
  });

  it("adaFilterAkunAktif", () => {
    assert.equal(adaFilterAkunAktif(FILTER_AKUN_AWAL), false);
    assert.equal(adaFilterAkunAktif({ ...FILTER_AKUN_AWAL, belumGanti: true }), true);
  });
});

describe("potongHalaman", () => {
  const seratus = Array.from({ length: 60 }, (_, i) => i);

  it("25 per halaman", () => {
    assert.equal(PER_HALAMAN, 25);
    const h = potongHalaman(seratus, 1);
    assert.deepEqual([h.tampil.length, h.total, h.halaman, h.jumlahHalaman], [25, 60, 1, 3]);
    assert.deepEqual(potongHalaman(seratus, 3).tampil, seratus.slice(50));
  });

  it("halaman di luar jangkauan dibatasi ke halaman terakhir (bukan daftar kosong)", () => {
    const h = potongHalaman(seratus, 99);
    assert.equal(h.halaman, 3);
    assert.equal(h.tampil.length, 10);
  });

  it("daftar kosong tetap satu halaman", () => {
    assert.deepEqual(potongHalaman([], 1), { tampil: [], total: 0, halaman: 1, jumlahHalaman: 1 });
  });
});
