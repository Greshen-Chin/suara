import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bacaBerhasilKeputusan, bacaTahun, urlBerhasilKeputusan } from "./keputusan-pesan.ts";

const ID = "6f1b3d0a-1001-4c8e-9a10-000000000001";

describe("bacaBerhasilKeputusan", () => {
  test("kode tertutup, tahun, dan id dibaca", () => {
    assert.deepEqual(bacaBerhasilKeputusan({ berhasil: "ditetapkan", tahun: "2027" }), { kode: "ditetapkan", tahun: 2027, id: null });
    assert.deepEqual(bacaBerhasilKeputusan({ berhasil: "selesai", tahun: "2027", id: ID }), { kode: "selesai", tahun: 2027, id: ID });
  });
  test("kode di luar daftar, atau tanpa kode, ditolak: tidak ada teks bebas dari alamat", () => {
    for (const kode of ["<script>", "voting", "", undefined, "DITETAPKAN"]) {
      assert.equal(bacaBerhasilKeputusan({ berhasil: kode }), null, String(kode));
    }
  });
  test("tahun dan id yang rusak jadi null, bukan galat", () => {
    assert.equal(bacaBerhasilKeputusan({ berhasil: "dibatalkan", tahun: "20x7" })!.tahun, null);
    assert.equal(bacaBerhasilKeputusan({ berhasil: "dibatalkan", tahun: "1999" })!.tahun, null);
    assert.equal(bacaBerhasilKeputusan({ berhasil: "selesai", id: "bukan-uuid" })!.id, null);
  });
  test("bacaTahun", () => {
    assert.equal(bacaTahun("2027"), 2027);
    for (const x of ["", "27", "20270", "abcd", "2027.5", "-2027", undefined]) assert.equal(bacaTahun(x), null, String(x));
  });
});

describe("urlBerhasilKeputusan", () => {
  test("bolak-balik dengan bacaBerhasilKeputusan", () => {
    const url = urlBerhasilKeputusan("selesai", { tahun: 2027, id: ID });
    assert.equal(url, `/admin/keputusan?berhasil=selesai&tahun=2027&id=${ID}`);
    const q = Object.fromEntries(new URL(url, "http://x").searchParams);
    assert.deepEqual(bacaBerhasilKeputusan(q), { kode: "selesai", tahun: 2027, id: ID });
    assert.equal(urlBerhasilKeputusan("dibatalkan"), "/admin/keputusan?berhasil=dibatalkan");
  });
});
