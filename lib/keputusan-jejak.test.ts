import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bacaFilterJejak, bangunQueryJejak, BATAS_JEJAK_AWAL, BATAS_JEJAK_MAKS, FILTER_JEJAK_AWAL } from "./keputusan-jejak.ts";

describe("bacaFilterJejak", () => {
  test("tanpa parameter: semua jenis, batas awal", () => {
    assert.deepEqual(bacaFilterJejak({}), FILTER_JEJAK_AWAL);
  });
  test("jenis yang dikenal dibaca, yang tidak dikenal jatuh ke semua", () => {
    assert.equal(bacaFilterJejak({ jenis: "decision" }).jenis, "decision");
    assert.equal(bacaFilterJejak({ jenis: "moderation" }).jenis, "moderation");
    assert.equal(bacaFilterJejak({ jenis: "<script>" }).jenis, null);
    assert.equal(bacaFilterJejak({ jenis: "" }).jenis, null);
    assert.equal(bacaFilterJejak({ jenis: ["decision", "note"] }).jenis, "decision");
  });
  test("batas dibatasi 20 sampai 200 dan harus bilangan bulat", () => {
    assert.equal(bacaFilterJejak({ batas: "40" }).batas, 40);
    assert.equal(bacaFilterJejak({ batas: "5" }).batas, BATAS_JEJAK_AWAL);
    assert.equal(bacaFilterJejak({ batas: "-3" }).batas, BATAS_JEJAK_AWAL);
    assert.equal(bacaFilterJejak({ batas: "99999" }).batas, BATAS_JEJAK_MAKS);
    assert.equal(bacaFilterJejak({ batas: "2.5" }).batas, BATAS_JEJAK_AWAL);
    assert.equal(bacaFilterJejak({ batas: "abc" }).batas, BATAS_JEJAK_AWAL);
  });
});

describe("bangunQueryJejak", () => {
  test("nilai bawaan tidak ditulis", () => {
    assert.equal(bangunQueryJejak(FILTER_JEJAK_AWAL), "");
    assert.equal(bangunQueryJejak({ jenis: "decision", batas: 20 }), "?jenis=decision");
    assert.equal(bangunQueryJejak({ jenis: null, batas: 40 }), "?batas=40");
    assert.equal(bangunQueryJejak({ jenis: "decision", batas: 40 }), "?jenis=decision&batas=40");
  });
  test("mengubah satu bagian", () => {
    assert.equal(bangunQueryJejak({ jenis: "decision", batas: 60 }, { jenis: null, batas: 20 }), "");
  });
});
