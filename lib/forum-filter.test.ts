import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BATAS_AWAL,
  BATAS_MAKS,
  FILTER_AWAL,
  adaFilterAktif,
  bacaFilter,
  bangunQuery,
  terapkanFilter,
  type BisaDisaring,
} from "./forum-filter.ts";

function usulan(id: string, ubah: Partial<BisaDisaring> = {}): BisaDisaring {
  return { id, status: "forum", rw: 1, category: "infrastruktur", created_at: "2026-11-01T00:00:00Z", vote_count: 0, suara_per_1000: 0, ...ubah };
}

describe("bacaFilter", () => {
  it("tanpa parameter: semua bawaan", () => {
    assert.deepEqual(bacaFilter({}), FILTER_AWAL);
  });

  it("membaca semua parameter yang sah", () => {
    assert.deepEqual(
      bacaFilter({ status: "voting", rw: "7", kategori: "lingkungan", urut: "dukungan", batas: "40" }),
      { status: "voting", rw: 7, kategori: "lingkungan", urut: "dukungan", batas: 40 },
    );
  });

  it("nilai tak dikenal atau jahat jatuh ke bawaan, tidak melempar", () => {
    assert.deepEqual(
      bacaFilter({ status: "'; drop", rw: "-1", kategori: "x", urut: "acak", batas: "abc" }),
      FILTER_AWAL,
    );
    assert.equal(bacaFilter({ rw: "7.5" }).rw, null);
    assert.equal(bacaFilter({ rw: "99999" }).rw, null);
  });

  it("parameter ganda memakai yang pertama", () => {
    assert.equal(bacaFilter({ status: ["voting", "forum"] }).status, "voting");
  });

  it("batas dijepit antara 20 dan 200", () => {
    assert.equal(bacaFilter({ batas: "5" }).batas, BATAS_AWAL);
    assert.equal(bacaFilter({ batas: "9999" }).batas, BATAS_MAKS);
    assert.equal(bacaFilter({ batas: "60" }).batas, 60);
  });
});

describe("bangunQuery", () => {
  it("bawaan tidak ditulis ke URL", () => {
    assert.equal(bangunQuery(FILTER_AWAL), "");
  });

  it("hanya yang berubah dari bawaan", () => {
    assert.equal(bangunQuery({ ...FILTER_AWAL, status: "voting", urut: "dukungan" }), "?status=voting&urut=dukungan");
  });

  it("ubah sebagian tanpa mengubah aslinya", () => {
    const f = { ...FILTER_AWAL, rw: 7 };
    assert.equal(bangunQuery(f, { batas: 40 }), "?rw=7&batas=40");
    assert.equal(f.batas, BATAS_AWAL);
  });

  it("bolak-balik: hasil bangunQuery dibaca kembali menjadi filter yang sama", () => {
    const f = { status: "diputuskan", rw: 3, kategori: "sosial", urut: "per-seribu", batas: 60 } as const;
    const params = Object.fromEntries(new URLSearchParams(bangunQuery(f)));
    assert.deepEqual(bacaFilter(params), f);
  });

  it("adaFilterAktif tidak menghitung urutan dan batas", () => {
    assert.ok(!adaFilterAktif({ ...FILTER_AWAL, urut: "dukungan", batas: 60 }));
    assert.ok(adaFilterAktif({ ...FILTER_AWAL, rw: 1 }));
  });
});

describe("terapkanFilter", () => {
  const daftar = [
    usulan("a", { status: "forum", rw: 1, created_at: "2026-11-03T00:00:00Z", vote_count: 10, suara_per_1000: 3.33 }),
    usulan("b", { status: "voting", rw: 7, created_at: "2026-11-01T00:00:00Z", vote_count: 6, suara_per_1000: 15, category: "lingkungan" }),
    usulan("c", { status: "approved", rw: 3, created_at: "2026-11-02T00:00:00Z", vote_count: 20, suara_per_1000: 10 }),
    usulan("d", { status: "forum", rw: 7, created_at: "2026-11-04T00:00:00Z", vote_count: 8, suara_per_1000: 20 }),
    usulan("e", { status: "done", rw: null, created_at: "2026-10-01T00:00:00Z", vote_count: 1, suara_per_1000: null }),
  ];
  const ids = (f: Partial<typeof FILTER_AWAL>) => terapkanFilter(daftar, { ...FILTER_AWAL, ...f }).tampil.map((u) => u.id);

  it("urutan terbaru adalah bawaan", () => {
    assert.deepEqual(ids({}), ["d", "a", "c", "b", "e"]);
  });

  it("urut dukungan terbanyak", () => {
    assert.deepEqual(ids({ urut: "dukungan" }), ["c", "a", "d", "b", "e"]);
  });

  it("urut dukungan per 1.000 penduduk; yang tanpa RW paling bawah", () => {
    assert.deepEqual(ids({ urut: "per-seribu" }), ["d", "b", "c", "a", "e"]);
  });

  it("filter status: forum, voting, diputuskan (approved, rejected, done)", () => {
    assert.deepEqual(ids({ status: "forum" }), ["d", "a"]);
    assert.deepEqual(ids({ status: "voting" }), ["b"]);
    assert.deepEqual(ids({ status: "diputuskan" }), ["c", "e"]);
  });

  it("filter RW dan kategori digabung", () => {
    assert.deepEqual(ids({ rw: 7 }), ["d", "b"]);
    assert.deepEqual(ids({ rw: 7, kategori: "lingkungan" }), ["b"]);
    assert.deepEqual(ids({ rw: 99 }), []);
  });

  it("'muat lebih banyak': memotong sesuai batas dan menandai masih ada sisa", () => {
    const banyak = Array.from({ length: 45 }, (_, i) =>
      usulan(`u${String(i).padStart(2, "0")}`, { created_at: `2026-10-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z` }),
    );
    const a = terapkanFilter(banyak, FILTER_AWAL);
    assert.deepEqual([a.tampil.length, a.total, a.adaLagi], [20, 45, true]);
    const b = terapkanFilter(banyak, { ...FILTER_AWAL, batas: 40 });
    assert.deepEqual([b.tampil.length, b.adaLagi], [40, true]);
    const c = terapkanFilter(banyak, { ...FILTER_AWAL, batas: 60 });
    assert.deepEqual([c.tampil.length, c.adaLagi], [45, false]);
  });

  it("urutan stabil untuk waktu yang sama (tidak melompat antar muat)", () => {
    const sama = ["x3", "x1", "x2"].map((id) => usulan(id));
    assert.deepEqual(terapkanFilter(sama, FILTER_AWAL).tampil.map((u) => u.id), ["x1", "x2", "x3"]);
  });

  it("tidak mengubah daftar aslinya", () => {
    const salinan = daftar.map((u) => u.id);
    ids({ urut: "dukungan" });
    assert.deepEqual(daftar.map((u) => u.id), salinan);
  });
});
