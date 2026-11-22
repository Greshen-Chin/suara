import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bisaDidukung, penjelasanDukungan, tentukanKeadaanDukungan } from "./aturan-dukungan.ts";

const warga = { peran: "warga", punyaWarga: true } as const;

describe("tentukanKeadaanDukungan", () => {
  it("warga dengan data warga bisa mendukung usulan forum dan voting", () => {
    for (const status of ["forum", "voting"]) {
      assert.deepEqual(tentukanKeadaanDukungan({ pengguna: warga, status, dataCadangan: false }), { jenis: "bisa" });
    }
  });

  it("pengunjung tanpa sesi diarahkan masuk", () => {
    assert.deepEqual(tentukanKeadaanDukungan({ pengguna: null, status: "forum", dataCadangan: false }), {
      jenis: "perlu-masuk",
    });
  });

  it("admin tidak memberi dukungan", () => {
    const k = tentukanKeadaanDukungan({ pengguna: { peran: "admin", punyaWarga: false }, status: "voting", dataCadangan: false });
    assert.equal(k.jenis, "admin");
    assert.match(penjelasanDukungan(k)!, /Admin desa tidak memberi dukungan/);
  });

  it("warga tanpa warga_id diberi penjelasan dan arahan menghubungi admin", () => {
    const k = tentukanKeadaanDukungan({ pengguna: { peran: "warga", punyaWarga: false }, status: "forum", dataCadangan: false });
    assert.equal(k.jenis, "tanpa-warga");
    assert.match(penjelasanDukungan(k)!, /Hubungi admin desa/);
  });

  it("usulan yang sudah diputuskan: dukungan ditutup untuk siapa pun, juga pengunjung", () => {
    for (const status of ["approved", "rejected", "done"]) {
      assert.equal(tentukanKeadaanDukungan({ pengguna: warga, status, dataCadangan: false }).jenis, "ditutup");
      assert.equal(tentukanKeadaanDukungan({ pengguna: null, status, dataCadangan: false }).jenis, "ditutup");
    }
  });

  it("data cadangan mematikan aksi tulis, dengan alasan", () => {
    const k = tentukanKeadaanDukungan({ pengguna: warga, status: "forum", dataCadangan: true });
    assert.equal(k.jenis, "data-cadangan");
    assert.match(penjelasanDukungan(k)!, /data tidak bisa dimuat/);
  });

  it("keadaan yang boleh tidak punya penjelasan", () => {
    assert.equal(penjelasanDukungan({ jenis: "bisa" }), null);
    assert.equal(penjelasanDukungan({ jenis: "perlu-masuk" }), null);
  });

  it("bisaDidukung hanya untuk forum dan voting", () => {
    assert.ok(bisaDidukung("forum"));
    assert.ok(bisaDidukung("voting"));
    assert.ok(!bisaDidukung("approved"));
    assert.ok(!bisaDidukung(""));
  });
});
